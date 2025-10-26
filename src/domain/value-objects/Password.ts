/**
 * Value Object para representar contraseñas
 * Garantiza que solo existan contraseñas válidas en el dominio
 */

import type { Result } from '@shared/result';
import { success, failure } from '@shared/result';
import { isValidPassword } from '@shared/utils';
import { InvalidPasswordError } from '@domain/errors/InvalidPasswordError';

export class Password {
  private constructor(private readonly _value: string) {}

  static create(password: string): Result<Password, InvalidPasswordError> {
    // Validación básica
    if (!password || typeof password !== 'string') {
      return failure(InvalidPasswordError.emptyPassword());
    }

    // Validar longitud mínima y máxima
    if (password.length < 8) {
      return failure(InvalidPasswordError.weakPassword());
    }

    if (password.length > 128) {
      return failure(InvalidPasswordError.tooLong());
    }

    // Validar complejidad
    if (!isValidPassword(password)) {
      return failure(InvalidPasswordError.weakPassword());
    }

    return success(new Password(password));
  }

  static createUnsafe(password: string): Password {
    const result = Password.create(password);
    if (result.isFailure) {
      throw result.error;
    }
    return result.value;
  }

  get value(): string {
    return this._value;
  }

  equals(other: Password): boolean {
    return this._value === other._value;
  }

  // Por seguridad, nunca exponemos la contraseña en logs
  toString(): string {
    return '[PASSWORD]';
  }

  toJSON(): string {
    return '[PASSWORD]';
  }

  // Métodos de utilidad para análisis de fortaleza
  getStrength(): 'weak' | 'medium' | 'strong' {
    const password = this._value;
    let score = 0;

    // Longitud
    if (password.length >= 12) score += 2;
    else if (password.length >= 8) score += 1;

    // Minúsculas
    if (/[a-z]/.test(password)) score += 1;

    // Mayúsculas
    if (/[A-Z]/.test(password)) score += 1;

    // Números
    if (/\d/.test(password)) score += 1;

    // Símbolos
    if (/[^a-zA-Z\d]/.test(password)) score += 1;

    // Variedad de caracteres
    if (password.length >= 10 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password) && /[^a-zA-Z\d]/.test(password)) {
      score += 1;
    }

    if (score >= 6) return 'strong';
    if (score >= 4) return 'medium';
    return 'weak';
  }

  hasMinimumRequirements(): boolean {
    const password = this._value;
    return (
      password.length >= 8 &&
      /[a-z]/.test(password) &&
      /[A-Z]/.test(password) &&
      /\d/.test(password)
    );
  }
}