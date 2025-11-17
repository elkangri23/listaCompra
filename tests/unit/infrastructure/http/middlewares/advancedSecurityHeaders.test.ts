import { EventEmitter } from 'events';
import type { Request, Response, NextFunction } from 'express';
import {
  getEnterpriseHelmetConfig,
  additionalSecurityHeaders,
  sensitiveEndpointSecurity,
  authEndpointSecurity,
  aiEndpointSecurity,
  securityMonitoringHeaders,
  setupEnterpriseSecurityHeaders
} from '@infrastructure/http/middlewares/advancedSecurityHeaders';

class MockResponse extends EventEmitter {
  private headers: Record<string, any> = {};

  setHeader(name: string, value: any): void {
    this.headers[name] = value;
  }

  removeHeader(name: string): void {
    delete this.headers[name];
  }

  getHeader(name: string): any {
    return this.headers[name];
  }
}

const createRequest = (overrides: Record<string, any> = {}): Request => ({
  path: '/test',
  get: (_name: string) => undefined,
  ...overrides
}) as unknown as Request;

describe('advancedSecurityHeaders', () => {
  const originalEnv = process.env['NODE_ENV'];

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env['NODE_ENV'];
    } else {
      process.env['NODE_ENV'] = originalEnv;
    }
  });

  it('configura Helmet con directivas específicas por entorno', () => {
    process.env['NODE_ENV'] = 'production';
    const prodConfig = getEnterpriseHelmetConfig();
    const prodCsp = prodConfig.contentSecurityPolicy as any;
    expect(prodCsp.reportOnly).toBe(false);
    expect(prodCsp.directives.defaultSrc).toContain("'self'");

    process.env['NODE_ENV'] = 'development';
    const devConfig = getEnterpriseHelmetConfig();
    const devCsp = devConfig.contentSecurityPolicy as any;
    expect(devCsp.reportOnly).toBe(true);
    expect(devCsp.directives.scriptSrc).toContain("'unsafe-eval'");
  });

  it('añade headers de seguridad adicionales y elimina cabeceras sensibles', () => {
    const req = createRequest({
      path: '/admin/audit',
      get: () => 'http://localhost:3333'
    });
    const res = new MockResponse() as unknown as Response;
    const next: NextFunction = jest.fn();

    additionalSecurityHeaders(req, res, next);

    expect(res.getHeader('X-API-Version')).toBe('1.3.0');
    expect(res.getHeader('X-Robots-Tag')).toBe('noindex, nofollow, nosnippet, noarchive');
    expect(res.getHeader('Permissions-Policy')).toContain('camera=()');
    expect(res.getHeader('Access-Control-Allow-Credentials')).toBe('true');
    expect(next).toHaveBeenCalled();
  });

  it('aplica headers estrictos para endpoints sensibles y de autenticación', () => {
    const resSensitive = new MockResponse() as unknown as Response;
    const next: NextFunction = jest.fn();
    sensitiveEndpointSecurity(createRequest(), resSensitive, next);
    expect(resSensitive.getHeader('X-Frame-Options')).toBe('DENY');
    expect(resSensitive.getHeader('Strict-Transport-Security')).toContain('max-age');

    const resAuth = new MockResponse() as unknown as Response;
    authEndpointSecurity(createRequest(), resAuth, next);
    expect(resAuth.getHeader('X-Auth-Security')).toBe('enabled');
    expect(resAuth.getHeader('X-Brute-Force-Protection')).toBe('active');

    const resAI = new MockResponse() as unknown as Response;
    aiEndpointSecurity(createRequest(), resAI, next);
    expect(resAI.getHeader('X-AI-Provider')).toBe('perplexity');
    expect(resAI.getHeader('Cache-Control')).toContain('max-age');
  });

  it('añade headers de monitoreo y calcula el tiempo de respuesta', () => {
    const res = new MockResponse() as unknown as Response;
    const req = createRequest();
    (req as any).requestId = 'req-123';
    const next: NextFunction = jest.fn();

    securityMonitoringHeaders(req, res, next);
    expect(res.getHeader('X-Request-ID')).toBe('req-123');
    expect(res.getHeader('X-Security-Monitoring')).toBe('active');
    expect(res.getHeader('X-Timestamp')).toBeDefined();

    res.emit('finish');
    expect(res.getHeader('X-Response-Time')).toMatch(/ms$/);
  });

  it('setupEnterpriseSecurityHeaders construye el stack completo', () => {
    const stack = setupEnterpriseSecurityHeaders();
    expect(stack).toHaveLength(3);
    stack.forEach((middleware) => expect(typeof middleware).toBe('function'));
  });
});
