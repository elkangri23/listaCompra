/**
 * Tests unitarios para AdvancedRateLimitService
 * Rate limiting estándar, adaptativo y bloqueo temporal por IP.
 */

import { AdvancedRateLimitService } from '../../../../../src/infrastructure/http/middlewares/AdvancedRateLimitService';
import { Logger } from '../../../../../src/infrastructure/observability/logger/Logger';
import { SecurityAuditService, InMemoryAuditRepository } from '../../../../../src/infrastructure/observability/audit/SecurityAuditService';

jest.mock('../../../../../src/infrastructure/observability/logger/Logger', () => {
  class FakeLogger {
    ai = jest.fn(); http = jest.fn(); error = jest.fn(); warn = jest.fn();
    info = jest.fn(); security = jest.fn(); debug = jest.fn();
    constructor(_context?: string) {}
  }
  return { Logger: FakeLogger };
});

const makeReq = (overrides: any = {}): any => ({
  path: '/api/v1/test',
  method: 'POST',
  ip: '1.2.3.4',
  get: () => 'jest-agent',
  user: undefined,
  ...overrides
});

const makeRes = (): any => {
  const res: any = {
    statusCode: 0,
    headers: {} as Record<string, string>,
    body: undefined,
    set(h: Record<string, string>) { Object.assign(res.headers, h); return res; },
    status(code: number) { res.statusCode = code; return res; },
    json(payload: unknown) { res.body = payload; return res; }
  };
  return res;
};

describe('AdvancedRateLimitService', () => {
  let service: AdvancedRateLimitService;
  let auditService: SecurityAuditService;

  beforeEach(() => {
    auditService = new SecurityAuditService(new InMemoryAuditRepository(), new Logger('audit'));
    jest.spyOn(auditService, 'logSecurityViolation').mockImplementation(jest.fn());
    service = new AdvancedRateLimitService(new Logger('test'), auditService);
  });

  describe('createRateLimit (estándar)', () => {
    it('permite requests por debajo del límite y setea headers', () => {
      const middleware = service.createRateLimit({ maxRequests: 3, windowMs: 1000 });
      const req = makeReq();
      const res = makeRes();
      const next = jest.fn();

      middleware(req, res, next);
      middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(2);
      expect(res.headers['X-RateLimit-Limit']).toBe('3');
      expect(res.headers['X-RateLimit-Remaining']).toBe('1');
    });

    it('bloquea al exceder maxRequests con 429', () => {
      const middleware = service.createRateLimit({ maxRequests: 1, windowMs: 1000 });
      const next = jest.fn();

      middleware(makeReq(), makeRes(), next);
      const res = makeRes();
      middleware(makeReq(), res, next);

      expect(res.statusCode).toBe(429);
      expect(res.body.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(auditService.logSecurityViolation).toHaveBeenCalledWith(
        'rate_limit_exceeded',
        expect.anything(),
        undefined,
        '1.2.3.4'
      );
    });

    it('onLimitReached callback se ejecuta al exceder', () => {
      const onLimitReached = jest.fn();
      const middleware = service.createRateLimit({ maxRequests: 1, windowMs: 1000, onLimitReached });
      middleware(makeReq(), makeRes(), jest.fn());
      middleware(makeReq(), makeRes(), jest.fn());

      expect(onLimitReached).toHaveBeenCalledTimes(1);
    });

    it('keyGenerator personalizado agrupa por clave', () => {
      const middleware = service.createRateLimit({
        maxRequests: 1,
        windowMs: 1000,
        keyGenerator: (req: any) => req.user?.id ?? req.ip
      });
      const next = jest.fn();

      middleware(makeReq({ user: { id: 'a' } }), makeRes(), next);
      middleware(makeReq({ user: { id: 'b' } }), makeRes(), next);

      expect(next).toHaveBeenCalledTimes(2);
    });
  });

  describe('createAdaptiveRateLimit', () => {
    const baseConfig = {
      maxRequests: 10,
      windowMs: 1000,
      baseMaxRequests: 10,
      baseWindowMs: 1000,
      enableAdaptive: true,
      adaptiveMultiplier: 1.5,
      trustThreshold: 0.8
    };

    it('permite requests con score neutral y setea headers adaptativos', () => {
      const middleware = service.createAdaptiveRateLimit(baseConfig);
      const res = makeRes();
      const next = jest.fn();

      middleware(makeReq({ user: { id: 'u1' } }), res, next);

      expect(next).toHaveBeenCalled();
      expect(res.headers['X-RateLimit-Adaptive']).toBe('true');
      expect(parseFloat(res.headers['X-RateLimit-Trust-Score'])).toBeGreaterThan(0);
    });

    it('excede el límite → 429 y aumenta actividad sospechosa', () => {
      const middleware = service.createAdaptiveRateLimit({ ...baseConfig, baseMaxRequests: 2 });
      const next = jest.fn();

      middleware(makeReq({ user: { id: 'u1' } }), makeRes(), next);
      middleware(makeReq({ user: { id: 'u1' } }), makeRes(), next);
      const res = makeRes();
      middleware(makeReq({ user: { id: 'u1' } }), res, next);

      expect(res.statusCode).toBe(429);
      expect(next).toHaveBeenCalledTimes(2);
    });
  });

  describe('bloqueo temporal', () => {
    it('repite bloqueo hasta que expire la ventana', () => {
      const middleware = service.createRateLimit({ maxRequests: 1, windowMs: 1000 });
      const next = jest.fn();

      middleware(makeReq(), makeRes(), next);      // 1: permitido
      middleware(makeReq(), makeRes(), next);      // 2: bloqueado
      middleware(makeReq(), makeRes(), next);      // 3: sigue bloqueado

      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe('cleanupExpiredData', () => {
    it('libera la ventana expirada (nuevo ciclo permite de nuevo)', async () => {
      const middleware = service.createRateLimit({ maxRequests: 1, windowMs: 20 });
      const next = jest.fn();

      middleware(makeReq(), makeRes(), next);
      middleware(makeReq(), makeRes(), next); // bloqueado
      await new Promise(r => setTimeout(r, 40)); // ventana expira
      middleware(makeReq(), makeRes(), next);   // permitido de nuevo

      expect(next).toHaveBeenCalledTimes(2);
    });
  });
});
