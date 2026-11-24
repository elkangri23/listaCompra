/**
 * Tests unitarios para errorMiddleware (manejo central de errores HTTP)
 */

import { errorMiddleware, notFoundMiddleware, requestIdMiddleware } from '../../../../../src/infrastructure/http/middlewares/errorMiddleware';
import { ValidationError, NotFoundError, UnauthorizedError } from '../../../../../src/application/errors';
import { DomainError } from '../../../../../src/domain/errors/DomainError';
import { ZodError } from 'zod';

const makeReq = (overrides: any = {}): any => ({
  originalUrl: '/api/v1/test',
  method: 'POST',
  ip: '1.2.3.4',
  get: () => 'agent',
  headers: {},
  ...overrides
});

const makeRes = (): any => {
  const res: any = {
    statusCode: 0,
    body: undefined,
    headersSent: false,
    status(code: number) { res.statusCode = code; return res; },
    json(payload: unknown) { res.body = payload; return res; }
  };
  return res;
};

class TestDomainError extends DomainError {
  constructor(message: string) { super(message, 'TEST_ERROR'); }
  toJSON(): Record<string, unknown> { return {}; }
}

describe('errorMiddleware', () => {
  it('ValidationError → 400 VALIDATION_ERROR', () => {
    const res = makeRes();
    errorMiddleware(new ValidationError('campo mal', 'email', 'x'), makeReq(), res, jest.fn());

    expect(res.statusCode).toBe(400);
    expect(res.body.error.type).toBe('VALIDATION_ERROR');
    expect(res.body.success).toBe(false);
    expect(res.body.error.requestId).toBeTruthy();
  });

  it('NotFoundError → 404 NOT_FOUND', () => {
    const res = makeRes();
    errorMiddleware(new NotFoundError('Lista', 'l1'), makeReq(), res, jest.fn());

    expect(res.statusCode).toBe(404);
    expect(res.body.error.type).toBe('NOT_FOUND');
  });

  it('UnauthorizedError → 401 UNAUTHORIZED', () => {
    const res = makeRes();
    errorMiddleware(new UnauthorizedError('no'), makeReq(), res, jest.fn());

    expect(res.statusCode).toBe(401);
    expect(res.body.error.type).toBe('UNAUTHORIZED');
  });

  it('DomainError genérico → 400 DOMAIN_ERROR', () => {
    const res = makeRes();
    errorMiddleware(new TestDomainError('regla rota'), makeReq(), res, jest.fn());

    expect(res.statusCode).toBe(400);
    expect(res.body.error.type).toBe('DOMAIN_ERROR');
  });

  it('ZodError → 400 con issues mapeadas', () => {
    const zodError = new ZodError([
      { path: ['email'], message: 'formato inválido', code: 'invalid_string' } as never
    ]);
    const res = makeRes();
    errorMiddleware(zodError, makeReq(), res, jest.fn());

    expect(res.statusCode).toBe(400);
    expect(res.body.error.details.issues).toHaveLength(1);
    expect(res.body.error.details.issues[0].field).toBe('email');
  });

  it('error HTTP con statusCode → usa ese código', () => {
    const httpError = Object.assign(new Error('teapot'), { status: 418 });
    const res = makeRes();
    errorMiddleware(httpError, makeReq(), res, jest.fn());

    expect(res.statusCode).toBe(418);
  });

  it('error desconocido → 500 INTERNAL_SERVER_ERROR', () => {
    const res = makeRes();
    errorMiddleware(new Error('boom'), makeReq(), res, jest.fn());

    expect(res.statusCode).toBe(500);
    expect(res.body.error.type).toBe('INTERNAL_SERVER_ERROR');
  });

  it('respeta x-request-id del header', () => {
    const res = makeRes();
    errorMiddleware(new Error('x'), makeReq({ headers: { 'x-request-id': 'req-42' } }), res, jest.fn());

    expect(res.body.error.requestId).toBe('req-42');
  });

  it('headersSent → delega en next sin responder', () => {
    const res = makeRes();
    res.headersSent = true;
    const next = jest.fn();
    errorMiddleware(new Error('x'), makeReq(), res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(res.body).toBeUndefined();
  });
});

describe('notFoundMiddleware', () => {
  it('devuelve 404 con mensaje estándar', () => {
    const res = makeRes();
    notFoundMiddleware(makeReq(), res);

    expect(res.statusCode).toBe(404);
    expect(res.body.error.type).toBe('NOT_FOUND');
    expect(res.body.error.message).toContain('no encontrado');
  });
});

describe('requestIdMiddleware', () => {
  it('genera un x-request-id si no existe', () => {
    const req = makeReq();
    const headers: Record<string, string> = {};
    const res: any = { setHeader: (k: string, v: string) => { headers[k] = v; } };
    const next = jest.fn();

    requestIdMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.headers['x-request-id']).toBeTruthy();
    expect(headers['x-request-id']).toBe(req.headers['x-request-id']);
  });

  it('conserva el x-request-id existente', () => {
    const req = makeReq({ headers: { 'x-request-id': 'existing-1' } });
    const res: any = { setHeader: jest.fn() };
    const next = jest.fn();

    requestIdMiddleware(req, res, next);

    expect(req.headers['x-request-id']).toBe('existing-1');
  });
});
