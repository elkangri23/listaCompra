/**
 * Tests unitarios para BlueprintPrivacyMiddleware (CU-22)
 */

import { BlueprintPrivacyMiddleware } from '../../../../../src/infrastructure/http/middlewares/blueprintPrivacyMiddleware';
import type { Result } from '../../../../../src/shared/result';

const ko = (error: Error): Result<unknown, Error> => ({ isSuccess: false, getError: () => error } as unknown as Result<unknown, Error>);
import { Logger } from '../../../../../src/infrastructure/observability/logger/Logger';

jest.mock('../../../../../src/infrastructure/observability/logger/Logger', () => {
  class FakeLogger {
    ai = jest.fn(); http = jest.fn(); error = jest.fn(); warn = jest.fn();
    info = jest.fn(); security = jest.fn(); debug = jest.fn();
    constructor(_context?: string) {}
  }
  return { Logger: FakeLogger };
});

const ok = (value: unknown) => ({ isSuccess: true, getValue: () => value });

const makeBlueprint = (overrides: Record<string, unknown> = {}) => ({
  id: 'bp-1', creadoPorId: 'user-1', publico: true, ...overrides
});

const makeReq = (overrides: any = {}): any => ({
  params: { id: 'bp-1' },
  user: { id: 'user-1', role: 'USUARIO' },
  query: {},
  ip: '1.2.3.4',
  get: () => 'agent',
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

describe('BlueprintPrivacyMiddleware', () => {
  let repository: any;
  let middleware: BlueprintPrivacyMiddleware;

  beforeEach(() => {
    repository = { findById: jest.fn().mockResolvedValue(ok(makeBlueprint())) };
    middleware = new BlueprintPrivacyMiddleware(repository, new Logger('test'));
  });

  describe('checkBlueprintAccess', () => {
    it('sin usuario → 401', async () => {
      const res = makeRes();
      await middleware.checkBlueprintAccess(makeReq({ user: undefined }), res, jest.fn());

      expect(res.statusCode).toBe(401);
    });

    it('sin id de blueprint → 400', async () => {
      const res = makeRes();
      await middleware.checkBlueprintAccess(makeReq({ params: {} }), res, jest.fn());

      expect(res.statusCode).toBe(400);
    });

    it('blueprint inexistente → 404', async () => {
      repository.findById.mockResolvedValue(ko(new Error('db')));

      const res = makeRes();
      await middleware.checkBlueprintAccess(makeReq(), res, jest.fn());

      expect(res.statusCode).toBe(404);
    });

    it('privado de otro usuario → 403 ACCESS_DENIED', async () => {
      repository.findById.mockResolvedValue(ok(makeBlueprint({ publico: false, creadoPorId: 'otro' })));

      const res = makeRes();
      await middleware.checkBlueprintAccess(makeReq(), res, jest.fn());

      expect(res.statusCode).toBe(403);
      expect(res.body.code).toBe('ACCESS_DENIED');
    });

    it('público de otro usuario → pasa y adjunta blueprint al request', async () => {
      const req = makeReq({ user: { id: 'lector', role: 'USUARIO' } });
      const next = jest.fn();

      await middleware.checkBlueprintAccess(req, makeRes(), next);

      expect(next).toHaveBeenCalled();
      expect((req as any).blueprint).toEqual({ id: 'bp-1', creadoPorId: 'user-1', publico: true });
    });

    it('ADMIN accede a privados de otros', async () => {
      repository.findById.mockResolvedValue(ok(makeBlueprint({ publico: false, creadoPorId: 'otro' })));
      const next = jest.fn();

      await middleware.checkBlueprintAccess(makeReq({ user: { id: 'admin-1', role: 'ADMIN' } }), makeRes(), next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('checkBlueprintWriteAccess', () => {
    it('solo el propietario puede modificar (otro → 403)', async () => {
      repository.findById.mockResolvedValue(ok(makeBlueprint({ creadoPorId: 'otro' }))); // público

      const res = makeRes();
      await middleware.checkBlueprintWriteAccess(
        makeReq({ user: { id: 'usuario-3', role: 'USUARIO' } }), res, jest.fn()
      );

      expect(res.statusCode).toBe(403);
      expect(res.body.code).toBe('WRITE_ACCESS_DENIED');
    });

    it('propietario pasa', async () => {
      const next = jest.fn();
      await middleware.checkBlueprintWriteAccess(makeReq(), makeRes(), next);

      expect(next).toHaveBeenCalled();
    });

    it('ADMIN puede modificar de otros', async () => {
      repository.findById.mockResolvedValue(ok(makeBlueprint({ publico: false, creadoPorId: 'otro' })));
      const next = jest.fn();

      await middleware.checkBlueprintWriteAccess(
        makeReq({ user: { id: 'admin-1', role: 'ADMIN' } }), makeRes(), next
      );

      expect(next).toHaveBeenCalled();
    });
  });

  describe('helpers', () => {
    it('enforcePublicOnlyAccess marca publicOnly en la query', () => {
      const req = makeReq();
      const next = jest.fn();

      middleware.enforcePublicOnlyAccess(req, makeRes(), next);

      expect((req.query as any).publicOnly).toBe('true');
      expect(next).toHaveBeenCalled();
    });

    it('logSensitiveAccess registra la operación', () => {
      const middlewareFn = middleware.logSensitiveAccess('SHARE');
      const next = jest.fn();

      middlewareFn(makeReq(), makeRes(), next);

      expect(next).toHaveBeenCalled();
    });

    it('getAccessStats devuelve contadores', async () => {
      const stats = await middleware.getAccessStats();
      expect(stats).toHaveProperty('totalAccesses');
      expect(stats).toHaveProperty('unauthorizedAttempts');
    });
  });
});
