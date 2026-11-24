/**
 * Tests unitarios para CacheIntegrityController (analytics de cache)
 */

import { CacheIntegrityController } from '../../../../../src/infrastructure/http/controllers/CacheIntegrityController';
import { Logger } from '../../../../../src/infrastructure/observability/logger/Logger';

jest.mock('../../../../../src/infrastructure/observability/logger/Logger', () => {
  class FakeLogger {
    ai = jest.fn(); http = jest.fn(); error = jest.fn(); warn = jest.fn();
    info = jest.fn(); security = jest.fn(); debug = jest.fn();
    constructor(_context?: string) {}
  }
  return { Logger: FakeLogger };
});

const makeReq = (overrides: any = {}): any => ({ body: {}, query: {}, user: { id: 'admin-1' }, ...overrides });

const makeRes = (): any => {
  const res: any = {
    statusCode: 0,
    body: undefined,
    status(code: number) { res.statusCode = code; return res; },
    json(payload: unknown) { res.body = payload; return res; }
  };
  return res;
};

describe('CacheIntegrityController', () => {
  let integrityService: any;
  let redisClient: any;
  let controller: CacheIntegrityController;

  beforeEach(() => {
    integrityService = {
      scanIntegrity: jest.fn().mockResolvedValue([
        { key: 'k1', dataType: 'json', isValid: true, corruptionLevel: 'NONE' },
        { key: 'k2', dataType: 'json', isValid: false, corruptionLevel: 'MODERATE' }
      ]),
      getIntegrityStats: jest.fn().mockReturnValue({
        total: 2, valid: 1, corrupted: 1,
        byCorruptionLevel: { MODERATE: 1 }
      }),
      retrieveWithIntegrity: jest.fn(),
      cleanupCorruptedData: jest.fn().mockResolvedValue(undefined),
      storeWithIntegrity: jest.fn().mockResolvedValue({ isSuccess: true, value: undefined })
    };
    redisClient = {
      info: jest.fn().mockResolvedValue('used_memory:1024\r\nmaxmemory:0\r\n'),
      dbsize: jest.fn().mockResolvedValue(42),
      get: jest.fn().mockResolvedValue(JSON.stringify({ foo: 'bar' })),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1)
    };
    controller = new CacheIntegrityController(integrityService, redisClient, new Logger('test'));
  });

  it('scanIntegrity devuelve resultados y stats', async () => {
    const res = makeRes();
    await controller.scanIntegrity(makeReq({ query: { pattern: 'ai:*' } }), res);

    expect(res.body.success).toBe(true);
    expect(res.body.scan.results).toHaveLength(2);
    expect(res.body.statistics.total).toBe(2);
    expect(integrityService.scanIntegrity).toHaveBeenCalledWith(redisClient, 'ai:*', undefined);
  });

  it('validateKey sin key/dataType → 400 MISSING_PARAMETERS', async () => {
    const res = makeRes();
    await controller.validateKey(makeReq({ body: {} }), res);

    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe('MISSING_PARAMETERS');
  });

  it('validateKey con clave válida devuelve isValid true', async () => {
    integrityService.retrieveWithIntegrity.mockResolvedValue({ isSuccess: true, value: { foo: 'bar' } });

    const res = makeRes();
    await controller.validateKey(makeReq({ body: { key: 'k1', dataType: 'json' } }), res);

    expect(res.body.success).toBe(true);
    expect(res.body.validation.isValid).toBe(true);
    expect(res.body.validation.hasData).toBe(true);
  });

  it('validateKey con fallo de validación → 400 VALIDATION_FAILED', async () => {
    integrityService.retrieveWithIntegrity.mockResolvedValue({ isSuccess: false, error: new Error('corrupto') });

    const res = makeRes();
    await controller.validateKey(makeReq({ body: { key: 'k2', dataType: 'json' } }), res);

    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe('VALIDATION_FAILED');
  });

  it('cleanupCorrupted sin corruptos no limpia nada', async () => {
    integrityService.scanIntegrity.mockResolvedValue([
      { key: 'k1', isValid: true, corruptionLevel: 'NONE' }
    ]);

    const res = makeRes();
    await controller.cleanupCorrupted(makeReq({ body: { dryRun: true } }), res);

    expect(res.body.cleaned).toBe(0);
  });

  it('cleanupCorrupted dryRun=false limpia las claves corruptas', async () => {
    const res = makeRes();
    await controller.cleanupCorrupted(makeReq({ body: { dryRun: false } }), res);

    expect(res.body.success).toBe(true);
    expect(res.body.cleaned).toBe(1);
    expect(integrityService.cleanupCorruptedData).toHaveBeenCalledWith(redisClient, expect.any(Array));
  });

  it('cleanupCorrupted con dryRun muestra simulación', async () => {
    const res = makeRes();
    await controller.cleanupCorrupted(makeReq({ body: { dryRun: true } }), res);

    expect(res.body.message).toContain('Simulación');
    expect(res.body.wouldClean).toBe(1);
    expect(integrityService.cleanupCorruptedData).not.toHaveBeenCalled();
  });

  it('getIntegrityStats combina integridad + info de Redis y salud', async () => {
    const res = makeRes();
    await controller.getIntegrityStats(makeReq(), res);

    expect(res.body.success).toBe(true);
    expect(res.body.cache.totalKeys).toBe(42);
    expect(res.body.cache.memoryInfo.used_memory).toBe(1024);
    expect(res.body.health.corruptionRate).toBeCloseTo(50);
  });

  it('getIntegrityStats marca healthy sin corrupción', async () => {
    integrityService.getIntegrityStats.mockReturnValue({ total: 2, valid: 2, corrupted: 0, byCorruptionLevel: {} });

    const res = makeRes();
    await controller.getIntegrityStats(makeReq(), res);

    expect(res.body.health.status).toBe('healthy');
  });

  it('repairIntegrity sin keys → 400', async () => {
    const res = makeRes();
    await controller.repairIntegrity(makeReq({ body: {} }), res);

    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe('MISSING_PARAMETERS');
  });

  it('repairIntegrity repara claves válidas y reporta fallos', async () => {
    redisClient.get
      .mockResolvedValueOnce(JSON.stringify({ ok: 1 }))
      .mockResolvedValueOnce('no-es-json{');

    const res = makeRes();
    await controller.repairIntegrity(makeReq({ body: { keys: ['k1', 'k2'], dataType: 'json' } }), res);

    expect(res.body.success).toBe(true);
    expect(res.body.repair.repaired).toBe(1);
    expect(res.body.repair.failed).toBe(1);
    expect(res.body.repair.repairedKeys).toEqual(['k1']);
  });

  it('errores inesperados devuelven 500 con código del handler', async () => {
    integrityService.scanIntegrity.mockRejectedValue(new Error('boom'));

    const res = makeRes();
    await controller.scanIntegrity(makeReq(), res);

    expect(res.statusCode).toBe(500);
  });
});
