/**
 * Tests de integración de los endpoints de seguridad del panel de
 * administración (fase 5): GET /admin/security/overview,
 * GET /admin/security/login-attempts y GET /admin/security/alerts.
 *
 * Monta las rutas reales (createAdminRoutes) con el AdminController real y
 * los repositorios en memoria; el authMiddleware y requireAdmin son reales.
 */
import express from 'express';
import request from 'supertest';
import { createAdminRoutes } from '@infrastructure/http/routes/adminRoutes';
import { AdminController } from '@infrastructure/http/controllers/AdminController';
import { ImpersonateUser } from '@application/use-cases/admin/ImpersonateUser';
import { EndImpersonation } from '@application/use-cases/admin/EndImpersonation';
import { GetSecurityOverview } from '@application/use-cases/admin/GetSecurityOverview';
import { GetLoginAttempts } from '@application/use-cases/admin/GetLoginAttempts';
import { GetSecurityAlerts } from '@application/use-cases/admin/GetSecurityAlerts';
import { createAuthMiddleware } from '@infrastructure/http/middlewares/authMiddleware';
import { requireAdmin } from '@infrastructure/http/middlewares/roleMiddleware';
import { JWTTokenService } from '@infrastructure/external-services/auth/JWTTokenService';
import { InMemoryUsuarioRepository } from '@infrastructure/persistence/in-memory/InMemoryUsuarioRepository';
import { InMemoryLoginAttemptRepository } from '@infrastructure/persistence/in-memory/InMemoryLoginAttemptRepository';
import { Usuario, RolUsuario } from '@domain/entities/Usuario';
import { Email } from '@domain/value-objects/Email';

const ADMIN_ID = '11111111-1111-4111-8111-111111111111';
const LUIS_ID = '22222222-2222-4222-8222-222222222222';
const GRACIA_ID = '33333333-3333-4333-8333-333333333333';

const makeUser = (props: {
  id: string;
  email: string;
  rol?: RolUsuario;
  totpEnabled?: boolean;
  eliminacionSolicitadaEn?: Date | null;
}): Usuario => {
  const result = Usuario.create({
    id: props.id,
    email: Email.createUnsafe(props.email),
    password: 'hashed-password-very-long',
    nombre: 'Test',
    apellidos: 'User',
    rol: props.rol ?? RolUsuario.USUARIO,
    activo: true,
    emailVerificado: true,
    totpEnabled: props.totpEnabled ?? false,
    eliminacionSolicitadaEn: props.eliminacionSolicitadaEn ?? null,
  });
  if (result.isFailure) {
    throw result.error;
  }
  return result.value;
};

const buildApp = async (opts: { adminTotpEnabled?: boolean; seedAlerts?: boolean } = {}) => {
  const usuarioRepository = new InMemoryUsuarioRepository();
  const attemptRepository = new InMemoryLoginAttemptRepository();

  await usuarioRepository.save(
    makeUser({
      id: ADMIN_ID,
      email: 'admin@ejemplo.com',
      rol: RolUsuario.ADMIN,
      totpEnabled: opts.adminTotpEnabled ?? false,
    })
  );
  await usuarioRepository.save(makeUser({ id: LUIS_ID, email: 'luis@ejemplo.com' }));
  if (opts.seedAlerts) {
    await usuarioRepository.save(
      makeUser({
        id: GRACIA_ID,
        email: 'gracia@ejemplo.com',
        eliminacionSolicitadaEn: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000),
      })
    );
    await attemptRepository.save({ email: 'luis@ejemplo.com', success: false, reason: 'WRONG_PASSWORD', ipAddress: '1.1.1.1', userAgent: 'ua' });
    await attemptRepository.save({ email: 'luis@ejemplo.com', success: false, reason: 'WRONG_PASSWORD', ipAddress: '1.1.1.1', userAgent: 'ua' });
    await attemptRepository.save({ email: 'luis@ejemplo.com', success: true, reason: null, ipAddress: '1.1.1.1', userAgent: 'ua' });
    for (let i = 0; i < 6; i++) {
      await attemptRepository.save({ email: 'victima@ejemplo.com', success: false, reason: 'WRONG_PASSWORD', ipAddress: '9.9.9.9', userAgent: 'ua' });
    }
  }

  const tokenService = new JWTTokenService();
  const controller = new AdminController(
    new ImpersonateUser(usuarioRepository, tokenService),
    new EndImpersonation(usuarioRepository, tokenService),
    undefined,
    undefined,
    undefined,
    new GetSecurityOverview(attemptRepository, usuarioRepository, {
      enabled: () => false,
      verify: async () => false,
    }),
    new GetLoginAttempts(attemptRepository),
    new GetSecurityAlerts(attemptRepository, usuarioRepository)
  );

  const app = express();
  app.use(express.json());
  app.use(
    '/api/v1/admin',
    createAdminRoutes(controller, createAuthMiddleware({ tokenService }), requireAdmin)
  );
  return app;
};

const mintToken = async (userId: string, email: string, role: RolUsuario): Promise<string> => {
  const tokenService = new JWTTokenService();
  const result = await tokenService.generateTokenPair({ userId, email, role });
  if (result.isFailure) {
    throw new Error(`No se pudo emitir el token: ${result.error.message}`);
  }
  return result.value.accessToken;
};

describe('Endpoints de seguridad del panel admin', () => {
  describe('GET /api/v1/admin/security/overview', () => {
    it('sin token → 401', async () => {
      const app = await buildApp();
      const response = await request(app).get('/api/v1/admin/security/overview');
      expect(response.status).toBe(401);
    });

    it('con USUARIO → 403 ADMIN_ROLE_REQUIRED', async () => {
      const app = await buildApp();
      const token = await mintToken(LUIS_ID, 'luis@ejemplo.com', RolUsuario.USUARIO);
      const response = await request(app)
        .get('/api/v1/admin/security/overview')
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(403);
      expect(response.body.code).toBe('ADMIN_ROLE_REQUIRED');
    });

    it('con ADMIN → 200 con datos reales', async () => {
      const app = await buildApp({ adminTotpEnabled: true, seedAlerts: true });
      const token = await mintToken(ADMIN_ID, 'admin@ejemplo.com', RolUsuario.ADMIN);
      const response = await request(app)
        .get('/api/v1/admin/security/overview')
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      const data = response.body.data;
      expect(data.twoFactor).toEqual({ enabled: 1, total: 3 });
      expect(data.failedLoginsLast24h).toBe(8);
      expect(data.turnstile).toEqual({ enabled: false });
      expect(data.gracePeriod.count).toBe(1);
      expect(data.gracePeriod.accounts[0].email).toBe('gracia@ejemplo.com');
      expect(data.gracePeriod.accounts[0].daysLeft).toBe(5);
    });
  });

  describe('GET /api/v1/admin/security/login-attempts', () => {
    it('sin token → 401', async () => {
      const app = await buildApp({ seedAlerts: true });
      const response = await request(app).get('/api/v1/admin/security/login-attempts');
      expect(response.status).toBe(401);
    });

    it('con ADMIN → 200, paginado y con filtros', async () => {
      const app = await buildApp({ seedAlerts: true });
      const token = await mintToken(ADMIN_ID, 'admin@ejemplo.com', RolUsuario.ADMIN);
      const all = await request(app)
        .get('/api/v1/admin/security/login-attempts')
        .set('Authorization', `Bearer ${token}`);
      expect(all.status).toBe(200);
      expect(all.body.data.total).toBe(9);
      expect(all.body.data.attempts).toHaveLength(9);
      expect(all.body.data.pageSize).toBe(20);

      const failed = await request(app)
        .get('/api/v1/admin/security/login-attempts?success=false&page=1&pageSize=2')
        .set('Authorization', `Bearer ${token}`);
      expect(failed.body.data.total).toBe(8);
      expect(failed.body.data.attempts).toHaveLength(2);
      expect(failed.body.data.totalPages).toBe(4);

      const byEmail = await request(app)
        .get('/api/v1/admin/security/login-attempts?email=victima@ejemplo.com')
        .set('Authorization', `Bearer ${token}`);
      expect(byEmail.body.data.total).toBe(6);
      expect(byEmail.body.data.attempts.every((a: { email: string }) => a.email === 'victima@ejemplo.com')).toBe(true);
    });
  });

  describe('GET /api/v1/admin/security/alerts', () => {
    it('sin token → 401', async () => {
      const app = await buildApp({ seedAlerts: true });
      const response = await request(app).get('/api/v1/admin/security/alerts');
      expect(response.status).toBe(401);
    });

    it('con ADMIN → 200 con las alertas calculadas (fuerza bruta, admin sin 2FA, gracia)', async () => {
      const app = await buildApp({ seedAlerts: true });
      const token = await mintToken(ADMIN_ID, 'admin@ejemplo.com', RolUsuario.ADMIN);
      const response = await request(app)
        .get('/api/v1/admin/security/alerts')
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(200);
      expect(response.body.data.total).toBe(3);
      const types = response.body.data.alerts.map((a: { type: string }) => a.type);
      expect(types).toContain('BRUTE_FORCE_EMAIL');
      expect(types).toContain('ADMIN_WITHOUT_2FA');
      expect(types).toContain('GRACE_PERIOD_ENDING');
      // La de fuerza bruta (alta) va primero
      expect(response.body.data.alerts[0].severity).toBe('high');
    });

    it('sin datos que disparen alertas → lista vacía', async () => {
      const app = await buildApp({ adminTotpEnabled: true });
      const token = await mintToken(ADMIN_ID, 'admin@ejemplo.com', RolUsuario.ADMIN);
      const response = await request(app)
        .get('/api/v1/admin/security/alerts')
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(200);
      expect(response.body.data).toEqual({ alerts: [], total: 0, page: 1, pageSize: 20, totalPages: 1 });
    });
  });
});
