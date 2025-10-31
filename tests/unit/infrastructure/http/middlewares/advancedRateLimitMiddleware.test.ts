import type { Request, Response } from 'express';

const rateLimitMock = jest.fn((options) => {
  const handler = jest.fn((_req: Request, _res: Response, next?: () => void) => {
    if (typeof next === 'function') {
      next();
    }
  });

  (handler as any).options = options;
  return handler;
});

const redisStoreMock = jest.fn().mockImplementation((options) => ({ options }));

const redisMockInstances: any[] = [];

jest.mock('express-rate-limit', () => ({
  __esModule: true,
  default: rateLimitMock,
}));

jest.mock('rate-limit-redis', () => ({
  __esModule: true,
  default: redisStoreMock,
}));

jest.mock('ioredis', () => {
  const RedisMock = jest.fn(() => {
    const instance = {
      call: jest.fn().mockResolvedValue('OK'),
      ping: jest.fn().mockResolvedValue('PONG'),
      quit: jest.fn().mockResolvedValue('OK'),
    };
    redisMockInstances.push(instance);
    return instance;
  });

  return {
    __esModule: true,
    default: RedisMock,
  };
});

describe('advancedRateLimitMiddleware', () => {
  const originalEnv = process.env['NODE_ENV'];
  let middlewareModule: typeof import('../../../../../src/infrastructure/http/middlewares/advancedRateLimitMiddleware');

  beforeAll(async () => {
    middlewareModule = await import('../../../../../src/infrastructure/http/middlewares/advancedRateLimitMiddleware');
  });

  beforeEach(() => {
    process.env['NODE_ENV'] = 'production';
  });

  afterAll(() => {
    if (originalEnv === undefined) {
      delete process.env['NODE_ENV'];
    } else {
      process.env['NODE_ENV'] = originalEnv;
    }
  });

  it('crea Redis stores con prefijos esperados para cada limiter', () => {
    const handlers = [
      ['auth', middlewareModule.authAdvancedRateLimit],
      ['api_general', middlewareModule.apiGeneralAdvancedRateLimit],
      ['crud', middlewareModule.crudAdvancedRateLimit],
      ['admin', middlewareModule.adminAdvancedRateLimit],
      ['ai_standard', middlewareModule.aiStandardAdvancedRateLimit],
      ['ai_premium', middlewareModule.aiPremiumAdvancedRateLimit],
      ['sharing', middlewareModule.sharingAdvancedRateLimit],
      ['blueprints', middlewareModule.blueprintAdvancedRateLimit],
      ['dynamic', middlewareModule.dynamicRoleBasedRateLimit],
    ] as const;

    handlers.forEach(([prefix, handler]) => {
      const options = (handler as any).options;
      expect(options).toBeDefined();
      expect(options.store?.options?.prefix).toBe(prefix);
    });
  });

  it('usa IP y user-agent para el rate limit de autenticación por defecto', async () => {
    const handler = middlewareModule.authAdvancedRateLimit as any;
    const options = handler.options;

    const req = {
      ip: '10.0.0.1',
      connection: { remoteAddress: '10.0.0.2' },
      get: jest.fn().mockReturnValue('Mozilla/5.0 (Test Agent)')
    } as unknown as Request;

    const key = options.keyGenerator(req);
    expect(key).toContain('ratelimit:auth:ip:10.0.0.1');
    expect(options.skip(req)).toBe(false);
  });

  it('usa userId y omite admins en el rate limit general de API', async () => {
    const handler = middlewareModule.apiGeneralAdvancedRateLimit as any;
    const options = handler.options;

    const req = {
      ip: '20.0.0.1',
      user: { id: 'user-123', rol: 'admin' },
      get: jest.fn().mockReturnValue('Agent')
    } as unknown as Request;

    const key = options.keyGenerator(req);
    expect(key).toBe('ratelimit:api_general:user:user-123');

    expect(options.skip(req)).toBe(true);

    process.env['NODE_ENV'] = 'production';
    const nonAdminReq = {
      ip: '30.0.0.1',
      user: { id: 'user-456', rol: 'user' },
      get: jest.fn().mockReturnValue('Agent')
    } as unknown as Request;
    expect(options.skip(nonAdminReq)).toBe(false);
  });

  it('respeta el modo test saltándose el rate limit', async () => {
    process.env['NODE_ENV'] = 'test';
    const handler = middlewareModule.crudAdvancedRateLimit as any;
    const options = handler.options;

    const req = {
      ip: '127.0.0.1',
      get: jest.fn().mockReturnValue('Agent')
    } as unknown as Request;

    expect(options.skip(req)).toBe(true);
  });

  it('ajusta el límite dinámico por rol y devuelve 429 en el handler', async () => {
    const handler = middlewareModule.dynamicRoleBasedRateLimit as any;
    const options = handler.options;

    expect(options.max({ user: { rol: 'admin' } } as unknown as Request)).toBe(200);
    expect(options.max({ user: { rol: 'premium' } } as unknown as Request)).toBe(150);
    expect(options.max({ user: { rol: 'user' } } as unknown as Request)).toBe(100);

    const userReq = {
      user: { id: 'user-1', rol: 'user' },
      path: '/api/test',
    } as unknown as Request;
    expect(options.keyGenerator(userReq)).toBe('ratelimit:dynamic:user:user-1');

    const anonymousReq = {
      ip: '8.8.8.8',
      connection: { remoteAddress: '9.9.9.9' },
      path: '/api/test',
    } as unknown as Request;
    expect(options.keyGenerator(anonymousReq)).toContain('ratelimit:dynamic:ip:');

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as Response;

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    options.handler(userReq, res);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      error: 'DYNAMIC_RATE_LIMIT_EXCEEDED',
      userRole: 'user',
    }));

    warnSpy.mockRestore();
  });

  it('verifica la conexión Redis y maneja errores', async () => {
    const redisInstance = redisMockInstances[0];
    expect(redisInstance).toBeDefined();

    if (!redisInstance) {
      throw new Error('Redis instance no inicializada');
    }

    await expect(middlewareModule.checkRedisConnection()).resolves.toBe(true);
    expect(redisInstance.ping).toHaveBeenCalled();

    redisInstance.ping.mockRejectedValueOnce(new Error('redis down'));
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(middlewareModule.checkRedisConnection()).resolves.toBe(false);
    expect(errorSpy).toHaveBeenCalled();

    errorSpy.mockRestore();
  });

  it('cierra la conexión de Redis correctamente', async () => {
    const redisInstance = redisMockInstances[0];
    if (!redisInstance) {
      throw new Error('Redis instance no inicializada');
    }

    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    await middlewareModule.closeRedisConnection();
    expect(redisInstance.quit).toHaveBeenCalled();

    logSpy.mockRestore();
  });
});
