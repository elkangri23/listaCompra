/**
 * Error de validación en la capa de aplicación
 */

export class ValidationError extends Error {
  public readonly code = 'VALIDATION_ERROR';
  public readonly field: string;
  public readonly value: unknown;

  constructor(message: string, field: string, value: unknown) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
    this.value = value;
  }

  static create(message: string, field: string, value: unknown): ValidationError {
    return new ValidationError(message, field, value);
  }

  toJSON(): Record<string, unknown> {
    return {
      code: this.code,
      message: this.message,
      field: this.field,
      value: this.value,
    };
  }
}