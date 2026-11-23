/**
 * Middleware de protección CSRF (Fase 12 - CU-27)
 *
 * Contexto: esta API autentica con JWT por header `Authorization` y NO usa
 * cookies de sesión, por lo que el CSRF clásico (que explota el envío
 * automático de cookies por el navegador) no es explotable hoy.
 *
 * Este middleware añade defensa en profundidad para dos escenarios:
 *
 * 1. Verificación de Origin/Referer en mutaciones (POST/PUT/PATCH/DELETE):
 *    si un navegador envía la petición, siempre incluye `Origin`. Si el origen
 *    no está en la allowlist, se rechaza con 403. Los clientes no-navegador
 *    (Postman, curl, apps móviles) no envían Origin y pasan sin fricción.
 *
 * 2. Double-submit cookie opcional (future-proof): si el cliente envía una
 *    cookie `csrf_token`, el header `x-csrf-token` debe coincidir. Si en el
 *    futuro se introduce autenticación por cookie, la protección ya está.
 *
 * Se salta en NODE_ENV=test (mismo criterio que los rate limiters).
 */

import type { Request, Response, NextFunction } from 'express';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Orígenes permitidos: CORS_ORIGIN (separado por comas) + locales por entorno.
 * Mantiene el mismo criterio que cors.config.ts.
 */
const getAllowedOrigins = (): string[] => {
  const origins: string[] = [];

  const envOrigins = process.env['CORS_ORIGIN'];
  if (envOrigins) {
    origins.push(...envOrigins.split(',').map(o => o.trim()).filter(Boolean));
  }

  const nodeEnv = process.env['NODE_ENV'] || 'development';
  if (nodeEnv === 'production') {
    origins.push(
      'https://listacompra.tudominio.com',
      'https://app.listacompra.tudominio.com',
      'https://www.listacompra.tudominio.com'
    );
  } else {
    origins.push(
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3333',
      'http://localhost:4200',
      'http://localhost:5173',
      'http://localhost:8080',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
      'http://127.0.0.1:3333',
      'http://127.0.0.1:4200',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:8080'
    );
  }

  return origins;
};

const isOriginAllowed = (origin: string): boolean => {
  return getAllowedOrigins().includes(origin);
};

const extractOriginFromReferer = (referer: string): string | null => {
  try {
    const url = new URL(referer);
    return url.origin;
  } catch {
    return null;
  }
};

export const csrfProtection = (req: Request, res: Response, next: NextFunction): void => {
  // Los tests no envían Origin y no representan un navegador real
  if (process.env['NODE_ENV'] === 'test') {
    next();
    return;
  }

  // Métodos seguros no modifican estado: sin riesgo CSRF
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }

  // 1) Verificación de Origin (navegadores siempre lo envían en mutaciones)
  const origin = req.headers['origin'] as string | undefined
    ?? extractOriginFromReferer((req.headers['referer'] as string | undefined) ?? '');

  if (origin && !isOriginAllowed(origin)) {
    console.warn(
      `🛡️ [CSRF] Mutación bloqueada desde origen no permitido: ${origin} ` +
      `(IP: ${req.ip ?? 'unknown'}, ${req.method} ${req.path})`
    );
    res.status(403).json({
      success: false,
      error: 'Origen no permitido para esta operación',
      code: 'CSRF_ORIGIN_REJECTED'
    });
    return;
  }

  // 2) Double-submit cookie (solo si el cliente la usa)
  const cookieHeader = req.headers['cookie'];
  const cookieCsrf = cookieHeader
    ?.split(';')
    .map(c => c.trim())
    .find(c => c.startsWith('csrf_token='))?.split('=')[1];

  if (cookieCsrf) {
    const headerCsrf = req.headers['x-csrf-token'] as string | undefined;

    if (!headerCsrf || headerCsrf !== cookieCsrf) {
      console.warn(
        `🛡️ [CSRF] Token double-submit inválido o ausente ` +
        `(IP: ${req.ip ?? 'unknown'}, ${req.method} ${req.path})`
      );
      res.status(403).json({
        success: false,
        error: 'Token CSRF inválido o ausente',
        code: 'CSRF_TOKEN_MISMATCH'
      });
      return;
    }
  }

  next();
};

export default csrfProtection;
