/**
 * Tests de la ruta GET /api/v1/admin/audit-logs (fase 4, panel admin).
 *
 * Monta las rutas reales (createAdminRoutes) con el authMiddleware real y
 * requireAdmin, y un AuditController stub: aquí se comprueba el guardado
 * (401 sin token, 403 ADMIN_ROLE_REQUIRED para USUARIO) y que la petición
 * llega al controlador con la query intacta. El controlador real y el
 * flujo contra BD se cubren en AuditController.test.ts y en
 * audit.routes.integration.test.ts.
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
    res.status(200).json({ success: true })
  ),
  endImpersonation: jest.fn(async (_req: any, res: any) =>
    res.status(200).json({ success: true })
  ),
  getImpersonationStatus: jest.fn(async (_req: any, res: any) =>
    res.status(200).json({ success: true })
  ),
  getImpersonationAuditLog: jest.fn(async (_req: any, res: any) =>
    res.status(200).json({ success: true })
  ),
  getAdminUsers: jest.fn(async (_req: any, res: any) =>
    res.status(200).json({ success: true })
  ),
  updateUserStatus: jest.fn(async (_req: any, res: any) =>
    res.status(200).json({ success: true })
  ),
});

const createStubAuditController = () => ({
  getAdminAuditLogs: jest.fn(async (req: any, res: any) =>
    res.status(200).json({
      success: true,
      data: {
        entries: [],
        total: 0,
        page: Number(req.query['page'] ?? 1),
        pageSize: Number(req.query['pageSize'] ?? 10),
        totalPages: 0,
        receivedQuery: req.query,
      },
    })
  ),
});

const buildApp = () => {
  const app = express();
  app.use(express.json());
  const tokenService = new JWTTokenService();
  const authMiddleware = createAuthMiddleware({ tokenService });
  const adminController = createStubAdminController();
  const auditController = createStubAuditController();
  app.use(
    '/api/v1/admin',
    createAdminRoutes(adminController as any, authMiddleware, requireAdmin, auditController as any)
  );
  return { app, auditController };
};

const mintToken = async (role: RolUsuario): Promise<string> => {
  const tokenService = new JWTTokenService();
  const result = await tokenService.generateTokenPair({
    userId: '22222222-2222-4222-8222-222222222222',
    email: role === RolUsuario.ADMIN ? 'admin@ejemplo.com' : 'usuario@ejemplo.com',
    role,
  });
  if (result.isFailure) {
    throw new Error(`No se pudo emitir el token de ${role}: ${result.error.message}`);
  }
  return result.value.accessToken;
};

describe('GET /api/v1/admin/audit-logs', () => {
  it('sin token → 401', async () => {
    const { app, auditController } = buildApp();
    const response = await request(app).get('/api/v1/admin/audit-logs');

    expect(response.status).toBe(401);
    expect(auditController.getAdminAuditLogs).not.toHaveBeenCalled();
  });

  it('con USUARIO → 403 ADMIN_ROLE_REQUIRED', async () => {
    const { app, auditController } = buildApp();
    const token = await mintToken(RolUsuario.USUARIO);
    const response = await request(app)
      .get('/api/v1/admin/audit-logs')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('ADMIN_ROLE_REQUIRED');
    expect(auditController.getAdminAuditLogs).not.toHaveBeenCalled();
  });

  it('con ADMIN llega al controlador con sobre {success, data}', async () => {
    const { app, auditController } = buildApp();
    const token = await mintToken(RolUsuario.ADMIN);
    const response = await request(app)
      .get('/api/v1/admin/audit-logs')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.total).toBe(0);
    expect(auditController.getAdminAuditLogs).toHaveBeenCalledTimes(1);
  });

  it('con ADMIN reenvía los filtros de la query al controlador', async () => {
    const { app } = buildApp();
    const token = await mintToken(RolUsuario.ADMIN);
    const response = await request(app)
      .get('/api/v1/admin/audit-logs?entityType=Lista&changeType=UPDATE&page=2&pageSize=5')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.receivedQuery).toMatchObject({
      entityType: 'Lista',
      changeType: 'UPDATE',
      page: '2',
      pageSize: '5',
    });
  });
});
