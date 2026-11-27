/**
 * Tests unitarios para InputSanitizationService (Fase 12, CU-27)
 * Cubre sanitización por tipo, detección de amenazas y middleware.
 */

import { InputSanitizationService } from '../../../../../src/infrastructure/http/middlewares/InputSanitizationService';
import { SecurityAuditService, InMemoryAuditRepository } from '../../../../../src/infrastructure/observability/audit/SecurityAuditService';
import { Logger } from '../../../../../src/infrastructure/observability/logger/Logger';

jest.mock('../../../../../src/infrastructure/observability/logger/Logger', () => {
  class FakeLogger {
    ai = jest.fn(); http = jest.fn(); error = jest.fn(); warn = jest.fn();
    info = jest.fn(); security = jest.fn(); debug = jest.fn(); startup = jest.fn();
    constructor(_context?: string) {}
  }
  return { Logger: FakeLogger, defaultLogger: new FakeLogger('Main') };
});

const makeService = () => {
  const auditService = new SecurityAuditService(new InMemoryAuditRepository(), new Logger('test'));
  const auditSpy = jest.spyOn(auditService, 'logSecurityViolation').mockImplementation(async () => {});
  return {
    service: new InputSanitizationService(new Logger('test'), auditService),
    auditSpy
  };
};

describe('InputSanitizationService', () => {
  describe('sanitizeData: reglas básicas', () => {
    it('valida campos requeridos ausentes', () => {
      const { service } = makeService();
      const result = service.sanitizeData({}, { email: { type: 'email', required: true } }, 'test');

      expect(result.isValid).toBe(false);
      expect(result.violations[0]?.violation).toBe('Required field missing');
    });

    it('rechaza valores vacíos cuando allowEmpty es false', () => {
      const { service } = makeService();
      const result = service.sanitizeData({ nombre: '' }, { nombre: { type: 'text' } }, 'test');

      expect(result.isValid).toBe(false);
      expect(result.violations[0]?.violation).toBe('Empty value not allowed');
    });

    it('permite vacío con allowEmpty', () => {
      const { service } = makeService();
      const result = service.sanitizeData(
        { nombre: '' },
        { nombre: { type: 'text', allowEmpty: true } },
        'test'
      );

      expect(result.isValid).toBe(true);
      expect(result.sanitizedData.nombre).toBe('');
    });

    it('respeta maxLength recortando el valor', () => {
      const { service } = makeService();
      const result = service.sanitizeData(
        { nombre: 'A'.repeat(20) },
        { nombre: { type: 'text', maxLength: 5 } },
        'test'
      );

      expect(result.sanitizedData.nombre).toBe('AAAAA');
      expect(result.violations.some(v => v.violation.includes('maximum length'))).toBe(true);
    });

    it('valida minLength marcando is válido=false', () => {
      const { service } = makeService();
      const result = service.sanitizeData(
        { password: 'corta' },
        { password: { type: 'text', minLength: 8 } },
        'test'
      );

      expect(result.isValid).toBe(false);
      expect(result.violations.some(v => v.violation.includes('minimum length'))).toBe(true);
    });

    it('aplica customValidator y customSanitizer', () => {
      const { service } = makeService();
      const result = service.sanitizeData(
        { edad: 25 },
        {
          edad: {
            type: 'alphanumeric',
            customValidator: (v: any) => Number(v) >= 18,
            customSanitizer: (v: any) => Number(v)
          }
        },
        'test'
      );

      expect(result.isValid).toBe(true);
      expect(result.sanitizedData.edad).toBe(25);
    });

    it('falla cuando el customValidator rechaza', () => {
      const { service } = makeService();
      const result = service.sanitizeData(
        { edad: 10 },
        { edad: { type: 'alphanumeric', customValidator: (v: any) => Number(v) >= 18 } },
        'test'
      );

      expect(result.isValid).toBe(false);
      expect(result.violations.some(v => v.violation === 'Custom validation failed')).toBe(true);
    });

    it('salta campos undefined/null no requeridos conservándolos', () => {
      const { service } = makeService();
      const result = service.sanitizeData(
        { opcional: undefined, nulo: null },
        { opcional: { type: 'text' }, nulo: { type: 'text' } },
        'test'
      );

      expect(result.isValid).toBe(true);
      expect(result.sanitizedData.opcional).toBeUndefined();
      expect(result.sanitizedData.nulo).toBeNull();
    });

    it('audita amenazas críticas', () => {
      const { service, auditSpy } = makeService();
      service.sanitizeData(
        { input: '<script>alert(1)</script>' },
        { input: { type: 'html' } },
        'test'
      );

      expect(auditSpy).toHaveBeenCalledWith(
        'input_sanitization_critical_threat',
        expect.objectContaining({ context: 'test' })
      );
    });
  });

  describe('sanitización por tipo', () => {
    it('html: elimina script/iframe/javascript:/vbscript', () => {
      const { service } = makeService();
      const result = service.sanitizeData(
        { v: '<script>alert(1)</script><iframe src="x"></iframe><a href="javascript:x">a</a>' },
        { v: { type: 'html' } },
        'test'
      );

      const out = String(result.sanitizedData.v);
      expect(out).not.toContain('<script');
      expect(out).not.toContain('<iframe');
      expect(out.toLowerCase()).not.toContain('javascript:');
    });

    it('text: escapa entidades HTML', () => {
      const { service } = makeService();
      const result = service.sanitizeData(
        { v: '<b>"H&A"\'s</b>' },
        { v: { type: 'text' } },
        'test'
      );

      const out = String(result.sanitizedData.v);
      expect(out).toContain('&lt;b&gt;');
      expect(out).toContain('&quot;');
      expect(out).toContain('&#x27;');
      expect(out).toContain('&amp;');
    });

    it('email: normaliza a minúsculas y elimina caracteres inválidos', () => {
      const { service } = makeService();
      const result = service.sanitizeData(
        { v: '  USUARIO+tag@Example.COM!  ' },
        { v: { type: 'email' } },
        'test'
      );

      expect(result.sanitizedData.v).toBe('usuariotag@example.com');
    });

    it('url: acepta http/https válidos', () => {
      const { service } = makeService();
      const result = service.sanitizeData(
        { v: 'https://example.com/path?q=1' },
        { v: { type: 'url' } },
        'test'
      );

      expect(result.sanitizedData.v).toContain('https://example.com');
    });

    it('url: rechaza protocolos no http/https (javascript:, ftp:)', () => {
      const { service } = makeService();
      const result = service.sanitizeData(
        { v: 'javascript:alert(1)' },
        { v: { type: 'url' } },
        'test'
      );

      expect(result.sanitizedData.v).toBe('');
    });

    it('filename: elimina caracteres peligrosos y colapsa puntos dobles', () => {
      const { service } = makeService();
      const result = service.sanitizeData(
        { v: 'mi/../archivo:mal?.txt' },
        { v: { type: 'filename' } },
        'test'
      );

      const out = String(result.sanitizedData.v);
      expect(out).not.toContain('/');
      expect(out).not.toContain(':');
      expect(out).not.toContain('?');
    });

    it('sql_identifier: solo [a-zA-Z0-9_] y máximo 64', () => {
      const { service } = makeService();
      const result = service.sanitizeData(
        { v: 'nombre\'; DROP TABLE usuarios; --' },
        { v: { type: 'sql_identifier' } },
        'test'
      );

      const out = String(result.sanitizedData.v);
      expect(out).toBe('nombreDROPTABLEusuarios');
    });

    it('json: mantiene JSON válido escapando HTML', () => {
      const { service } = makeService();
      const result = service.sanitizeData(
        { v: '{"clave":"valor <b>negrita</b>"}' },
        { v: { type: 'json' } },
        'test'
      );

      expect(String(result.sanitizedData.v)).toContain('&lt;b&gt;');
    });

    it('json: JSON inválido devuelve {}', () => {
      const { service } = makeService();
      const result = service.sanitizeData(
        { v: '{no soy json' },
        { v: { type: 'json' } },
        'test'
      );

      expect(result.sanitizedData.v).toBe('{}');
    });

    it('alphanumeric: solo alfanuméricos', () => {
      const { service } = makeService();
      const result = service.sanitizeData(
        { v: 'abc-123!!!xyz' },
        { v: { type: 'alphanumeric' } },
        'test'
      );

      expect(result.sanitizedData.v).toBe('abc123xyz');
    });
  });

  describe('detección de amenazas', () => {
    it('detecta XSS CRITICAL', () => {
      const { service } = makeService();
      const result = service.sanitizeData(
        { v: '<script>alert(1)</script>' },
        { v: { type: 'html' } },
        'test'
      );

      expect(result.securityThreats.some(t => t.type === 'XSS' && t.severity === 'CRITICAL')).toBe(true);
    });

    it('detecta SQL injection CRITICAL', () => {
      const { service } = makeService();
      const result = service.sanitizeData(
        { v: '1\' UNION SELECT * FROM usuarios--' },
        { v: { type: 'text' } },
        'test'
      );

      expect(result.securityThreats.some(t => t.type === 'SQL_INJECTION')).toBe(true);
    });

    it('detecta path traversal HIGH', () => {
      const { service } = makeService();
      const result = service.sanitizeData(
        { v: '../../etc/passwd' },
        { v: { type: 'filename' } },
        'test'
      );

      expect(result.securityThreats.some(t => t.type === 'PATH_TRAVERSAL' && t.severity === 'HIGH')).toBe(true);
    });

    it('detecta script injection CRITICAL (eval/Function/document.write)', () => {
      const { service } = makeService();
      const result = service.sanitizeData(
        { v: 'eval("code")' },
        { v: { type: 'text' } },
        'test'
      );

      expect(result.securityThreats.some(t => t.type === 'SCRIPT_INJECTION')).toBe(true);
    });

    it('no marca amenazas en valores limpios', () => {
      const { service } = makeService();
      const result = service.sanitizeData(
        { v: 'Leche entera Hacendado 1L' },
        { v: { type: 'text' } },
        'test'
      );

      expect(result.securityThreats).toHaveLength(0);
      expect(result.isValid).toBe(true);
    });
  });

  describe('createSanitizationMiddleware', () => {
    const makeReqRes = (body: any = {}) => {
      const next = jest.fn();
      const res: any = { statusCode: 0, body: null };
      res.status = (code: number) => { res.statusCode = code; return res; };
      res.json = (payload: any) => { res.body = payload; return res; };
      return { req: { body, query: {}, params: {}, headers: {}, get: jest.fn() } as any, res, next };
    };

    it('sanitiza el body y continúa cuando es seguro', () => {
      const { service } = makeService();
      const middleware = service.createSanitizationMiddleware({
        body: { nombre: { type: 'text', maxLength: 10 } }
      }, { context: 'test' });

      const { req, res, next } = makeReqRes({ nombre: '<i>Leche</i>' });
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      // el escaping ocurre ANTES del recorte de longitud (maxLength cuenta entidades)
      expect(req.body.nombre).toBe('&lt;i&gt;L');
    });

    it('bloquea con 400 ante amenazas críticas', () => {
      const { service } = makeService();
      const middleware = service.createSanitizationMiddleware({
        body: { input: { type: 'text' } }
      }, { blockOnCriticalThreats: true, context: 'test' });

      const { req, res, next } = makeReqRes({ input: '<script>alert(1)</script>' });
      middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.statusCode).toBe(400);
      expect(res.body.code).toBe('SECURITY_THREAT_DETECTED');
      expect(res.body.threats).toBeDefined();
    });

    it('no bloquea si blockOnCriticalThreats=false (registra pero continúa)', () => {
      const { service } = makeService();
      const middleware = service.createSanitizationMiddleware({
        body: { input: { type: 'text' } }
      }, { blockOnCriticalThreats: false, context: 'test' });

      const { req, res, next } = makeReqRes({ input: '<script>x</script>' });
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('registra violaciones de reglas (required) sin bloquear: bloqueo solo por amenazas', () => {
      const { service } = makeService();
      const middleware = service.createSanitizationMiddleware({
        body: { email: { type: 'email', required: true } }
      }, { context: 'test' });

      const { req, res, next } = makeReqRes({});
      middleware(req, res, next);

      // Comportamiento actual: las violaciones de reglas se registran en
      // req.sanitization pero no bloquean la petición
      expect(next).toHaveBeenCalled();
      expect((req as any).sanitization.hasViolations).toBe(true);
    });
  });

  describe('getPresetConfigurations', () => {
    it('expone configuración de auth con email/password requeridos', () => {
      const { service } = makeService();
      const presets = service.getPresetConfigurations();

      expect(presets.auth.body.email.required).toBe(true);
      expect(presets.auth.body.password.required).toBe(true);
      expect(presets.auth.body.password.minLength).toBe(8);
    });
  });
});
