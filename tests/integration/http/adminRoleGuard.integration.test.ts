/**
 * Tests del guardado por rol de las rutas /admin.
 *
 * Monta las rutas reales (createAdminRoutes) con el authMiddleware real y
 * requireAdmin: solo los usuarios con rol ADMIN llegan al controlador en las
 * rutas que lo exigen. DELETE /impersonate y GET /impersonate/status trabajan
 * con el token de impersonación y NO llevan chequeo de rol.
 */
import express from 'express';
import request from 'supertest';
import { createAdminRoutes } from '@infrastructure/http/routes/adminRoutes';
import { createAuthMiddleware } from '@infrastructure/http/middlewares/authMiddleware';
import { requireAdmin } from '@infrastructure/http/middlewares/roleMiddleware';
import { JWTTokenService } from '@infrastructure/external-services/auth/JWTTokenService';
import { RolUsuario } from '@domain/entities/Usuario';

const createStubAdminController = () => ({
  impersonateUser: jest.fn(async (_req: any, res: any) =>
    res.status(200).json({ success: true, reached: 'impersonateUser' })
  ),
  endImpersonation: jest.fn(async (_req: any, res: any) =>
    res.status(200).json({ success: true, reached: 'endImpersonation' })
  ),
  getImpersonationStatus: jest.fn(async (_req: any, res: any) =>
    res.status(200).json({ success: true, reached: 'getImpersonationStatus' })
  ),
  getImpersonationAuditLog: jest.fn(async (_req: any, res: any) =>
    res.status(200).json({ success: true, reached: 'getImpersonationAuditLog' })
  )
});

const buildApp = () => {
  const app = express();
  app.use(express.json());
  const tokenService = new JWTTokenService();
  const authMiddleware = createAuthMiddleware({ tokenService });
  const controller = createStubAdminController();
  app.use(
    '/api/v1/admin',
    createAdminRoutes(controller as any, authMiddleware, requireAdmin)
  );
  return app;
};

const mintToken = async (role: RolUsuario): Promise<string> => {
  const tokenService = new JWTTokenService();
  const result = await tokenService.generateTokenPair({
    userId: '11111111-1111-4111-8111-111111111111',
    email: role === RolUsuario.ADMIN ? 'admin@ejemplo.com' : 'usuario@ejemplo.com',
    role
  });
  if (result.isFailure) {
    throw new Error(`No se pudo emitir el token de ${role}: ${result.error.message}`);
  }
  return result.value.accessToken;
};

describe('Guardado por rol en /api/v1/admin', () => {
  it('POST /impersonate sin token → 401', async () => {
    const app = buildApp();
    const response = await request(app)
      .post('/api/v1/admin/impersonate')
      .send({ targetUserEmail: 'usuario@ejemplo.com', reason: 'Prueba' });

    expect(response.status).toBe(401);
  });

  it('POST /impersonate con USUARIO → 403 ADMIN_ROLE_REQUIRED', async () => {
    const app = buildApp();
    const token = await mintToken(RolUsuario.USUARIO);
    const response = await request(app)
      .post('/api/v1/admin/impersonate')
      .set('Authorization', `Bearer ${token}`)
      .send({ targetUserEmail: 'usuario@ejemplo.com', reason: 'Prueba' });

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('ADMIN_ROLE_REQUIRED');
  });

  it('POST /impersonate con ADMIN llega al controlador', async () => {
    const app = buildApp();
    const token = await mintToken(RolUsuario.ADMIN);
    const response = await request(app)
      .post('/api/v1/admin/impersonate')
      .set('Authorization', `Bearer ${token}`)
      .send({ targetUserEmail: 'usuario@ejemplo.com', reason: 'Prueba de acceso admin' });

    expect(response.status).toBe(200);
    expect(response.body.reached).toBe('impersonateUser');
  });

  it('POST /impersonate con ADMIN pero sin objetivo → 400 (el refine sigue activo)', async () => {
    const app = buildApp();
    const token = await mintToken(RolUsuario.ADMIN);
    const response = await request(app)
      .post('/api/v1/admin/impersonate')
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'Prueba sin objetivo' });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
  });

  it('GET /audit/impersonations con USUARIO → 403 ADMIN_ROLE_REQUIRED', async () => {
    const app = buildApp();
    const token = await mintToken(RolUsuario.USUARIO);
    const response = await request(app)
      .get('/api/v1/admin/audit/impersonations')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('ADMIN_ROLE_REQUIRED');
  });

  it('GET /audit/impersonations con ADMIN llega al controlador', async () => {
    const app = buildApp();
    const token = await mintToken(RolUsuario.ADMIN);
    const response = await request(app)
      .get('/api/v1/admin/audit/impersonations')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.reached).toBe('getImpersonationAuditLog');
  });

  it('GET /security/test con USUARIO → 403 ADMIN_ROLE_REQUIRED', async () => {
    const app = buildApp();
    const token = await mintToken(RolUsuario.USUARIO);
    const response = await request(app)
      .get('/api/v1/admin/security/test')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('ADMIN_ROLE_REQUIRED');
  });

  it('GET /security/test con ADMIN llega al endpoint real', async () => {
    const originalNodeEnv = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'production';
    try {
      const app = buildApp();
      const token = await mintToken(RolUsuario.ADMIN);
      const response = await request(app)
        .get('/api/v1/admin/security/test')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    } finally {
      if (originalNodeEnv === undefined) {
        delete process.env['NODE_ENV'];
      } else {
        process.env['NODE_ENV'] = originalNodeEnv;
      }
    }
  });

  it('DELETE /impersonate con USUARIO llega al controlador (sin chequeo de rol)', async () => {
    const app = buildApp();
    const token = await mintToken(RolUsuario.USUARIO);
    const response = await request(app)
      .delete('/api/v1/admin/impersonate')
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: 'Fin de la prueba' });

    expect(response.status).toBe(200);
    expect(response.body.reached).toBe('endImpersonation');
  });

  it('GET /impersonate/status con USUARIO llega al controlador (sin chequeo de rol)', async () => {
    const app = buildApp();
    const token = await mintToken(RolUsuario.USUARIO);
    const response = await request(app)
      .get('/api/v1/admin/impersonate/status')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.reached).toBe('getImpersonationStatus');
  });
});
