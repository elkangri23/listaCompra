/**
 * Error base para todos los errores de dominio
 */

export abstract class DomainError extends Error {
  public readonly code: string;
  public readonly timestamp: Date;

  constructor(message: string, code: string) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.timestamp = new Date();
    
    // Mantener stack trace en V8
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  abstract toJSON(): Record<string, unknown>;
}

/**
 * Error para cuando un valor no cumple las reglas de dominio
 */
export class InvalidValueError extends DomainError {
  constructor(
    message: string,
    public readonly field: string,
    public readonly value: unknown
  ) {
    super(message, 'INVALID_VALUE');
  }

  toJSON(): Record<string, unknown> {
    return {
      code: this.code,
      message: this.message,
      field: this.field,
      value: this.value,
      timestamp: this.timestamp,
    };
  }
}

/**
 * Error para cuando se viola una regla de negocio
 */
export class BusinessRuleViolationError extends DomainError {
  constructor(
    message: string,
    public readonly rule: string
  ) {
    super(message, 'BUSINESS_RULE_VIOLATION');
  }

  toJSON(): Record<string, unknown> {
    return {
      code: this.code,
      message: this.message,
      rule: this.rule,
      timestamp: this.timestamp,
    };
  }
}