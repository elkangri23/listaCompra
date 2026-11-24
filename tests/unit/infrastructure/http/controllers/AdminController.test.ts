/**
 * Tests unitarios para AdminController (CU-24/25)
 * Impersonación, estado, logs de auditoría.
 */

import { AdminController } from '../../../../../src/infrastructure/http/controllers/AdminController';
import { UnauthorizedError } from '../../../../../src/application/errors/UnauthorizedError';

const makeReq = (overrides: any = {}): any => ({
  body: {}, params: {}, query: {},
  user: { id: 'admin-1', email: 'admin@test.local', rol: 'ADMIN' },
  ip: '127.0.0.1',
  connection: { remoteAddress: '127.0.0.1' },
  get: () => 'jest-agent',
  headers: {},
  ...overrides
});

const makeRes = (): any => {
  const res: any = {
    statusCode: 0,
    body: undefined,
    status(code: number) { res.statusCode = code; return res; },
    json(payload: unknown) { res.body = payload; return res; }
  };
  return res;
};

const makeAuditEntry = (overrides: Record<string, unknown> = {}) => ({
  id: 'audit-1',
  entityType: 'IMPERSONACION',
  entityId: 'target-1',
  changedByUserId: 'admin-1',
  timestamp: new Date('2025-01-01T10:00:00Z'),
  newValue: { adminEmail: 'admin@test.local', reason: 'soporte', status: 'STARTED' },
  ...overrides
} as any);

describe('AdminController', () => {
  let impersonateUseCase: any;
  let endImpersonationUseCase: any;
  let auditRepository: any;
  let controller: AdminController;

  beforeEach(() => {
    impersonateUseCase = { execute: jest.fn() };
    endImpersonationUseCase = { execute: jest.fn() };
    auditRepository = {
      find: jest.fn().mockResolvedValue({ isSuccess: true, value: [makeAuditEntry()] }),
      count: jest.fn().mockResolvedValue({ isSuccess: true, value: 1 })
    };
    controller = new AdminController(impersonateUseCase, endImpersonationUseCase, auditRepository);
  });

  describe('impersonateUser', () => {
    it('sin autenticación → 401', async () => {
      const res = makeRes();
      await controller.impersonateUser(makeReq({ user: undefined }), res);

      expect(res.statusCode).toBe(401);
      expect(res.body.code).toBe('NOT_AUTHENTICATED');
    });

    it('ejecuta la impersonación y devuelve 200', async () => {
      impersonateUseCase.execute.mockResolvedValue({
        isSuccess: true,
        value: { token: 'tok', expiresAt: new Date().toISOString() }
      });

      const res = makeRes();
      await controller.impersonateUser(
        makeReq({ body: { targetUserId: 'u1', reason: 'soporte' } }), res
      );

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(impersonateUseCase.execute).toHaveBeenCalledWith(
        'admin-1',
        expect.objectContaining({ targetUserId: 'u1' }),
        '127.0.0.1',
        'jest-agent'
      );
    });

    it('fallo UnauthorizedError → 401 con code', async () => {
      impersonateUseCase.execute.mockResolvedValue({
        isSuccess: false,
        error: new UnauthorizedError('no permitido')
      });

      const res = makeRes();
      await controller.impersonateUser(makeReq({ body: { targetUserId: 'u1' } }), res);

      expect(res.statusCode).toBe(401);
      expect(res.body.code).toBe('UNAUTHORIZED');
    });

    it('excepción inesperada → 500', async () => {
      impersonateUseCase.execute.mockRejectedValue(new Error('boom'));

      const res = makeRes();
      await controller.impersonateUser(makeReq({ body: {} }), res);

      expect(res.statusCode).toBe(500);
    });
  });

  describe('endImpersonation', () => {
    it('sin header de autorización → 401', async () => {
      const res = makeRes();
      await controller.endImpersonation(makeReq(), res);

      expect(res.statusCode).toBe(401);
      expect(res.body.code).toBe('AUTHORIZATION_REQUIRED');
    });

    it('finaliza con token del header y devuelve 200', async () => {
      endImpersonationUseCase.execute.mockResolvedValue({
        isSuccess: true,
        value: { message: 'Sesión finalizada' }
      });

      const res = makeRes();
      await controller.endImpersonation(
        makeReq({ headers: { authorization: 'Bearer tok-1' } }), res
      );

      expect(res.statusCode).toBe(200);
      expect(endImpersonationUseCase.execute).toHaveBeenCalledWith(
        'tok-1', expect.anything(), '127.0.0.1', 'jest-agent'
      );
    });
  });

  describe('getImpersonationStatus', () => {
    it('sin token → 401', async () => {
      const res = makeRes();
      await controller.getImpersonationStatus(makeReq(), res);

      expect(res.statusCode).toBe(401);
    });

    it('con x-impersonation-active devuelve adminUser del header', async () => {
      const res = makeRes();
      await controller.getImpersonationStatus(
        makeReq({
          headers: {
            authorization: 'Bearer tok',
            'x-impersonation-active': 'true',
            'x-admin-id': 'admin-1',
            'x-admin-email': 'admin@test.local'
          }
        }), res
      );

      expect(res.statusCode).toBe(200);
      expect(res.body.data.isImpersonating).toBe(true);
      expect(res.body.data.adminUser.id).toBe('admin-1');
    });

    it('sin impersonación devuelve adminUser null', async () => {
      const res = makeRes();
      await controller.getImpersonationStatus(
        makeReq({ headers: { authorization: 'Bearer tok' } }), res
      );

      expect(res.body.data.isImpersonating).toBe(false);
      expect(res.body.data.adminUser).toBeNull();
    });
  });

  describe('getImpersonationAuditLog', () => {
    it('sin repositorio de auditoría → 503', async () => {
      const sinAudit = new AdminController(impersonateUseCase, endImpersonationUseCase);

      const res = makeRes();
      await sinAudit.getImpersonationAuditLog(makeReq(), res);

      expect(res.statusCode).toBe(503);
      expect(res.body.code).toBe('AUDIT_SERVICE_UNAVAILABLE');
    });

    it('devuelve entradas mapeadas con filtros', async () => {
      const res = makeRes();
      await controller.getImpersonationAuditLog(
        makeReq({ query: { limit: '10', offset: '0', adminId: 'admin-1' } }), res
      );

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.impersonations).toHaveLength(1);
      expect(res.body.data.impersonations[0].type).toBe('IMPERSONATION_STARTED');
      expect(res.body.data.impersonations[0].reason).toBe('soporte');
      expect(auditRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({ entityType: 'IMPERSONACION', changedByUserId: 'admin-1' })
      );
    });

    it('error del repositorio → 500 AUDIT_FETCH_ERROR', async () => {
      auditRepository.find.mockResolvedValue({ isSuccess: false, error: new Error('db') });

      const res = makeRes();
      await controller.getImpersonationAuditLog(makeReq(), res);

      expect(res.statusCode).toBe(500);
      expect(res.body.code).toBe('AUDIT_FETCH_ERROR');
    });

    it('limit fuera de rango se clampa a 200', async () => {
      await controller.getImpersonationAuditLog(
        makeReq({ query: { limit: '99999' } }), makeRes()
      );

      expect(auditRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({ pageSize: 200 })
      );
    });
  });
});
