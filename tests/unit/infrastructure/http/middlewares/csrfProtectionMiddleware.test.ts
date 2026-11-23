/**
 * Tests unitarios del middleware de protección CSRF
 * El middleware se salta en NODE_ENV=test, por lo que los tests que ejercitan
 * la lógica operan con NODE_ENV=development temporalmente.
 */

import type { Request, Response } from 'express';

const { csrfProtection } = jest.requireActual('../../../../../src/infrastructure/http/middlewares/csrfProtectionMiddleware');

const makeReq = (overrides: Partial<Record<'method' | 'headers' | 'ip' | 'path', any>> = {}): Request => ({
  method: 'POST',
  headers: {},
  ip: '10.0.0.1',
  path: '/api/v1/lists',
  ...overrides
} as unknown as Request);

const makeRes = () => {
  const res = {
    statusCode: 0,
    body: null as any,
    status(code: number) { res.statusCode = code; return res; },
    json(payload: any) { res.body = payload; return res; }
  };
  return res as unknown as Response & { statusCode: number; body: any };
};

describe('csrfProtection', () => {
  const originalEnv = process.env['NODE_ENV'];

  beforeEach(() => {
    process.env['NODE_ENV'] = 'development';
    process.env['CORS_ORIGIN'] = 'http://localhost:3000';
  });

  afterEach(() => {
    process.env['NODE_ENV'] = originalEnv;
    delete process.env['CORS_ORIGIN'];
    jest.restoreAllMocks();
  });

  it('pasa métodos seguros sin importar el origen', () => {
    const next = jest.fn();
    const req = makeReq({ method: 'GET', headers: { origin: 'https://evil.example.com' } });

    csrfProtection(req, makeRes(), next);

    expect(next).toHaveBeenCalled();
  });

  it('bloquea mutaciones con Origin malicioso (403 CSRF_ORIGIN_REJECTED)', () => {
    const next = jest.fn();
    const res = makeRes();
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const req = makeReq({ headers: { origin: 'https://evil.example.com' } });
    csrfProtection(req, res, next);

    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('CSRF_ORIGIN_REJECTED');
    expect(next).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
  });

  it('permite mutaciones con Origin de la allowlist', () => {
    const next = jest.fn();
    const req = makeReq({ headers: { origin: 'http://localhost:3000' } });

    csrfProtection(req, makeRes(), next);

    expect(next).toHaveBeenCalled();
  });

  it('permite mutaciones con origen de CORS_ORIGIN (multi-origen)', () => {
    const next = jest.fn();
    process.env['CORS_ORIGIN'] = 'http://localhost:3000,https://miapp.example.com';
    const req = makeReq({ headers: { origin: 'https://miapp.example.com' } });

    csrfProtection(req, makeRes(), next);

    expect(next).toHaveBeenCalled();
  });

  it('permite mutaciones sin Origin/Referer (APIs no-navegador: Postman, móvil)', () => {
    const next = jest.fn();
    const req = makeReq({ headers: {} });

    csrfProtection(req, makeRes(), next);

    expect(next).toHaveBeenCalled();
  });

  it('deriva el origen del Referer cuando no hay Origin', () => {
    const next = jest.fn();
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const req = makeReq({ headers: { referer: 'https://evil.example.com/form' } });
    const res = makeRes();
    csrfProtection(req, res, next);

    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
  });

  it('double-submit: cookie sin header x-csrf-token => 403', () => {
    const next = jest.fn();
    const req = makeReq({
      headers: {
        cookie: 'csrf_token=abc123; other=1'
      }
    });
    const res = makeRes();

    csrfProtection(req, res, next);

    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('CSRF_TOKEN_MISMATCH');
    expect(next).not.toHaveBeenCalled();
  });

  it('double-submit: cookie y header coinciden => pasa', () => {
    const next = jest.fn();
    const req = makeReq({
      headers: {
        cookie: 'csrf_token=abc123',
        'x-csrf-token': 'abc123'
      }
    });

    csrfProtection(req, makeRes(), next);

    expect(next).toHaveBeenCalled();
  });

  it('double-submit: header no coincide con cookie => 403', () => {
    const next = jest.fn();
    const req = makeReq({
      headers: {
        cookie: 'csrf_token=abc123',
        'x-csrf-token': 'otro-token'
      }
    });
    const res = makeRes();

    csrfProtection(req, res, next);

    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('CSRF_TOKEN_MISMATCH');
  });

  it('en NODE_ENV=test se salta por completo (skip)', () => {
    process.env['NODE_ENV'] = 'test';
    const next = jest.fn();
    const req = makeReq({ headers: { origin: 'https://evil.example.com' } });

    csrfProtection(req, makeRes(), next);

    expect(next).toHaveBeenCalled();
  });
});
