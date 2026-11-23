/**
 * Tests unitarios para clases de error de dominio y aplicación
 */

import { DomainError, InvalidValueError, BusinessRuleViolationError } from '../../../src/domain/errors/DomainError';
import { NotFoundError } from '../../../src/application/errors/NotFoundError';
import { UnauthorizedError } from '../../../src/application/errors/UnauthorizedError';
import { ValidationError } from '../../../src/application/errors/ValidationError';
import { BusinessRuleViolationError as AppBusinessRuleViolationError } from '../../../src/application/errors/BusinessRuleViolationError';

describe('DomainError', () => {
  class TestDomainError extends DomainError {
    constructor(message: string) { super(message, 'TEST_ERROR'); }
    toJSON(): Record<string, unknown> {
      return { code: this.code, message: this.message, timestamp: this.timestamp };
    }
  }

  it('extiende Error con code y timestamp', () => {
    const before = Date.now();
    const error = new TestDomainError('algo pasó');
    const after = Date.now();

    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('algo pasó');
    expect(error.code).toBe('TEST_ERROR');
    expect(error.name).toBe('TestDomainError');
    expect(error.timestamp).toBeInstanceOf(Date);
    expect(error.timestamp.getTime()).toBeGreaterThanOrEqual(before);
    expect(error.timestamp.getTime()).toBeLessThanOrEqual(after);
  });

  describe('InvalidValueError', () => {
    it('guarda field y value', () => {
      const error = new InvalidValueError('email inválido', 'email', 'no-es-email');

      expect(error.code).toBe('INVALID_VALUE');
      expect(error.field).toBe('email');
      expect(error.value).toBe('no-es-email');
      expect(error.toJSON()).toMatchObject({
        code: 'INVALID_VALUE',
        message: 'email inválido',
        field: 'email',
        value: 'no-es-email'
      });
      expect(error.toJSON()['timestamp']).toBeInstanceOf(Date);
    });
  });

  describe('BusinessRuleViolationError (dominio)', () => {
    it('guarda la regla violada', () => {
      const error = new BusinessRuleViolationError('no puedes compartir contigo mismo', 'SELF_SHARE');

      expect(error.code).toBe('BUSINESS_RULE_VIOLATION');
      expect(error.rule).toBe('SELF_SHARE');
      expect(error.toJSON()).toMatchObject({
        code: 'BUSINESS_RULE_VIOLATION',
        rule: 'SELF_SHARE'
      });
    });
  });
});

describe('NotFoundError (aplicación)', () => {
  it('incluye recurso e identificador en el mensaje', () => {
    const error = new NotFoundError('Lista', 'abc-123');

    expect(error.code).toBe('NOT_FOUND');
    expect(error.resource).toBe('Lista');
    expect(error.identifier).toBe('abc-123');
    expect(error.message).toContain('Lista');
    expect(error.message).toContain('abc-123');
  });

  it('factories de recursos conocidos', () => {
    expect(NotFoundError.user('u1').resource).toBe('Usuario');
    expect(NotFoundError.lista('l1').resource).toBe('Lista');
    expect(NotFoundError.producto('p1').resource).toBe('Producto');
    expect(NotFoundError.categoria('c1').resource).toBe('Categoría');
    expect(NotFoundError.tienda('t1').resource).toBe('Tienda');
  });
});

describe('UnauthorizedError (aplicación)', () => {
  it('usa mensaje por defecto', () => {
    const error = new UnauthorizedError();

    expect(error.code).toBe('UNAUTHORIZED');
    expect(error.message).toBe('Acceso no autorizado');
  });

  it('factories de credenciales y tokens', () => {
    expect(UnauthorizedError.invalidCredentials().message).toContain('Credenciales');
    expect(UnauthorizedError.tokenExpired().message).toContain('expirado');
    expect(UnauthorizedError.tokenInvalid().message).toContain('inválido');
  });
});

describe('ValidationError (aplicación)', () => {
  it('guarda detalles de validación si los hay', () => {
    const error = new ValidationError('formato inválido', 'email', 'no-es-email');

    expect(error).toBeInstanceOf(Error);
    expect(error.field).toBe('email');
  });
});

describe('BusinessRuleViolationError (aplicación)', () => {
  it('usa code por defecto', () => {
    const error = new AppBusinessRuleViolationError('regla rota');

    expect(error.code).toBe('BUSINESS_RULE_VIOLATION');
    expect(error.message).toBe('regla rota');
  });

  it('permite code personalizado', () => {
    const error = new AppBusinessRuleViolationError('regla rota', 'CUSTOM_CODE');

    expect(error.code).toBe('CUSTOM_CODE');
  });
});
