/**
 * Rutas MFA (TOTP fase 1)
 * Montaje: app.use('/api/v1/auth', createMfaRoutes(...)) — paths finales:
 *   GET  /api/v1/auth/mfa/status          (Bearer)
 *   POST /api/v1/auth/totp/setup          (Bearer + step-up password)
 *   POST /api/v1/auth/totp/verify-enable  (Bearer + step-up password)
 *   POST /api/v1/auth/totp/disable        (Bearer + step-up password + code)
 *   POST /api/v1/auth/login/mfa           (público, challengeId)
 * Rate limiting: mfaRateLimit (express-rate-limit en memoria, IP+UA).
 */

import { Router } from 'express';
import type { MfaController } from '@infrastructure/http/controllers/MfaController';
import type { RequestHandler } from 'express';
import { mfaRateLimit } from '../middlewares/rateLimitMiddleware';

export function createMfaRoutes(
  mfaController: MfaController,
  authMiddleware: RequestHandler
): Router {
  const router = Router();

  // Estado MFA (una query para pintar Seguridad en el frontend)
  router.get('/mfa/status', authMiddleware, mfaController.getStatus.bind(mfaController));

  // Ciclo de vida TOTP (step-up con contraseña dentro del body)
  router.post('/totp/setup', authMiddleware, mfaController.setup.bind(mfaController));
  router.post('/totp/verify-enable', authMiddleware, mfaRateLimit, mfaController.verifyEnable.bind(mfaController));
  router.post('/totp/disable', authMiddleware, mfaRateLimit, mfaController.disable.bind(mfaController));

  // Paso 2 del login (público, rate-limited: 5 intentos/challenge + limiter IP+UA)
  router.post('/login/mfa', mfaRateLimit, mfaController.loginMfa.bind(mfaController));

  return router;
}

/**
 * Ruta dev-only para E2E: revela el secret TOTP en claro para poder calcular
 * códigos en los tests. SE REGISTRA ÚNICAMENTE si NODE_ENV === 'test'.
 * No existe en builds de producción.
 */
export function createMfaDevRoutes(): Router {
  const router = Router();

  router.post('/dev/totp-reveal', async (req, res) => {
    const email = req.body?.email;
    if (!email || typeof email !== 'string') {
      res.status(400).json({
        success: false,
        error: { type: 'VALIDATION_ERROR', message: 'email es obligatorio', timestamp: new Date().toISOString() },
      });
      return;
    }
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();
    try {
      const usuario = await prisma.usuario.findUnique({
        where: { email },
        select: { totpSecret: true, totpEnabled: true },
      });
      if (!usuario || !usuario.totpSecret) {
        res.status(404).json({
          success: false,
          error: { type: 'NOT_FOUND', message: 'Usuario sin secret TOTP pendiente/activo', timestamp: new Date().toISOString() },
        });
        return;
      }
      const { decryptSecret } = await import('@infrastructure/security/mfa-crypto');
      res.status(200).json({
        success: true,
        data: { secret: decryptSecret(usuario.totpSecret), totpEnabled: usuario.totpEnabled },
        message: 'DEV ONLY — secreto TOTP revelado',
        timestamp: new Date().toISOString(),
      });
    } catch {
      res.status(500).json({
        success: false,
        error: { type: 'MFA_ERROR', code: 'MFA_DECRYPT_FAILED', message: 'No se pudo descifrar', timestamp: new Date().toISOString() },
      });
    } finally {
      await prisma.$disconnect();
    }
  });

  return router;
}
