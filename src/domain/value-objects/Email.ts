/**
 * Value Object para representar direcciones de email
 * Garantiza que solo existan emails válidos en el dominio
 */

import type { Result } from '@shared/result';
import { success, failure } from '@shared/result';
import { isValidEmail, normalizeEmail } from '@shared/utils';
import { InvalidEmailError } from '@domain/errors/InvalidEmailError';

export class Email {
  private constructor(private readonly _value: string) {}

  static create(email: string): Result<Email, InvalidEmailError> {
    // Validación básica
    if (!email || typeof email !== 'string') {
      return failure(InvalidEmailError.create(''));
    }

    // Normalizar email
    const normalizedEmail = normalizeEmail(email);

    // Validar formato
    if (!isValidEmail(normalizedEmail)) {
      return failure(InvalidEmailError.create(email));
    }

    // Validar longitud
    if (normalizedEmail.length > 254) {
      return failure(InvalidEmailError.create(email));
    }

    return success(new Email(normalizedEmail));
  }

  static createUnsafe(email: string): Email {
    const result = Email.create(email);
    if (result.isFailure) {
      throw result.error;
    }
    return result.value;
  }

  get value(): string {
    return this._value;
  }

  equals(other: Email): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }

  toJSON(): string {
    return this._value;
  }

  // Métodos de utilidad
  getDomain(): string {
    return this._value.split('@')[1] || '';
  }

  getLocalPart(): string {
    return this._value.split('@')[0] || '';
  }

  isFromDomain(domain: string): boolean {
    return this.getDomain().toLowerCase() === domain.toLowerCase();
  }
}