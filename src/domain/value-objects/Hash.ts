/**
 * Value Object para representar hashes criptográficos
 * Utilizado para invitaciones, tokens, etc.
 */

import type { Result } from '@shared/result';
import { success, failure } from '@shared/result';
import { InvalidValueError } from '@domain/errors/DomainError';

export class Hash {
  private constructor(private readonly _value: string) {}

  static create(hash: string): Result<Hash, InvalidValueError> {
    // Validación básica
    if (!hash || typeof hash !== 'string') {
      return failure(new InvalidValueError('Hash no puede estar vacío', 'hash', hash));
    }

    // Validar que sea alfanumérico (formato típico de hash)
    if (!/^[a-zA-Z0-9]+$/.test(hash)) {
      return failure(new InvalidValueError('Hash debe contener solo caracteres alfanuméricos', 'hash', hash));
    }

    // Validar longitud (entre 32 y 128 caracteres)
    if (hash.length < 32 || hash.length > 128) {
      return failure(new InvalidValueError('Hash debe tener entre 32 y 128 caracteres', 'hash', hash));
    }

    return success(new Hash(hash));
  }

  static createUnsafe(hash: string): Hash {
    const result = Hash.create(hash);
    if (result.isFailure) {
      throw result.error;
    }
    return result.value;
  }

  get value(): string {
    return this._value;
  }

  equals(other: Hash): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }

  toJSON(): string {
    return this._value;
  }

  // Método para mostrar solo los primeros y últimos caracteres (para logs)
  toMasked(): string {
    if (this._value.length <= 8) {
      return '***';
    }
    return `${this._value.substring(0, 4)}...${this._value.substring(this._value.length - 4)}`;
  }

  // Validar si el hash parece ser de un algoritmo específico por su longitud
  getLikelyAlgorithm(): string {
    switch (this._value.length) {
      case 32: return 'MD5';
      case 40: return 'SHA-1';
      case 56: return 'SHA-224';
      case 64: return 'SHA-256';
      case 96: return 'SHA-384';
      case 128: return 'SHA-512';
      default: return 'Unknown';
    }
  }
}