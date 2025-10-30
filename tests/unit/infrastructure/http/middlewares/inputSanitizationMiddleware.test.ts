import { Request, Response, NextFunction } from 'express';
import { InputSanitizationService, inputSanitizationMiddleware } from '@infrastructure/http/middlewares/inputSanitizationMiddleware';

jest.mock('isomorphic-dompurify', () => ({
  sanitize: jest.fn((value: string = '') =>
    value.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
  )
}));

const domPurify = require('isomorphic-dompurify');

describe('InputSanitizationService', () => {
  afterEach(() => {
    (domPurify.sanitize as jest.Mock).mockClear();
  });

  describe('sanitizeString', () => {
    it('elimina payloads de script y genera advertencias', () => {
      const result = InputSanitizationService.sanitizeString('<script>alert("XSS")</script>');

      expect(result.value).not.toContain('<script');
      expect(result.warnings).toEqual(
        expect.arrayContaining(['Potential SQL injection detected and blocked'])
      );
    });

    it('permite HTML limitado cuando allowHtml es true', () => {
      (domPurify.sanitize as jest.Mock).mockReturnValueOnce('<strong>Seguro</strong>');

      const input = '<strong>Seguro</strong><script>alert(1)</script>';
      const result = InputSanitizationService.sanitizeString(input, { allowHtml: true });

      expect(result.value.toLowerCase()).toContain('<strong>seguro</strong>');
      expect(result.value).not.toContain('<script>');
      expect(domPurify.sanitize).toHaveBeenCalled();
    });
  });

  describe('sanitizeObject', () => {
    it('respeta la whitelist de campos permitidos', () => {
      const source = { permitido: 'ok', malicioso: 'DROP TABLE users;' };
      const result = InputSanitizationService.sanitizeObject(source, {
        allowedFields: ['permitido']
      });

      expect(Object.keys(result.sanitized)).toHaveLength(1);
      expect(JSON.stringify(result.sanitized)).not.toContain('DROP TABLE');
      expect(result.blocked).toEqual(
        expect.arrayContaining(["Field 'malicioso' not in allowed list"])
      );
    });
  });
});

describe('inputSanitizationMiddleware', () => {
  const createMockResponse = () => {
    const res: Partial<Response> = {};
    res.status = jest.fn().mockReturnThis();
    res.json = jest.fn().mockReturnValue(undefined);
    return res as Response;
  };

  it('sanitiza body, query y params y adjunta metadata', () => {
    const middleware = inputSanitizationMiddleware();
    const req = {
      body: { comentario: '<script>alert(1)</script>', nombre: '  Ana  ' },
      query: { page: '1 ', search: '<img src=x onerror=alert(1)>' },
      params: { id: ' 123 ' },
      ip: '127.0.0.1',
      get: () => 'jest-agent',
      path: '/tests',
      method: 'POST'
    } as unknown as Request;
    const res = createMockResponse();
    const next: NextFunction = jest.fn();

    middleware(req, res, next);

    const body = req.body as Record<string, string>;
    const query = req.query as Record<string, string>;
    const params = req.params as Record<string, string>;

    expect(body).toHaveProperty('@comentario');
    expect(body['@comentario']).not.toContain('<script>');
    expect(body).toHaveProperty('@nombre');
    expect(body['@nombre']).toBe('@ana');
    expect(query).toHaveProperty('@page', '@1');
    expect(params).toHaveProperty('@id', '@123');
    expect((req as any).sanitizationMetadata).toMatchObject({
      warnings: expect.any(Array),
      blocked: expect.any(Array),
      processingTime: expect.any(Number)
    });
    expect(next).toHaveBeenCalled();
  });

  it('responde 400 cuando strict es true y se produce un error', () => {
    const middleware = inputSanitizationMiddleware({ strict: true });
    const req = {
      body: { campo: 'valor' },
      query: {},
      params: {},
      ip: '127.0.0.1',
      get: () => null,
      path: '/strict',
      method: 'GET'
    } as unknown as Request;
    const res = createMockResponse();
    const next: NextFunction = jest.fn();

    jest
      .spyOn(InputSanitizationService, 'sanitizeObject')
      .mockImplementationOnce(() => {
        throw new Error('boom');
      });

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'INPUT_SANITIZATION_ERROR',
      message: 'Request could not be safely processed'
    });
    expect(next).not.toHaveBeenCalled();
  });
});
