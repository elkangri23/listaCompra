/**
 * Error específico para contraseñas inválidas
 */

import { InvalidValueError } from './DomainError';

export class InvalidPasswordError extends InvalidValueError {
  constructor(message: string) {
    super(message, 'password', '[HIDDEN]');
  }

  static weakPassword(): InvalidPasswordError {
    return new InvalidPasswordError(
      'La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número'
    );
  }

  static emptyPassword(): InvalidPasswordError {
    return new InvalidPasswordError('La contraseña no puede estar vacía');
  }

  static tooLong(): InvalidPasswordError {
    return new InvalidPasswordError('La contraseña no puede tener más de 128 caracteres');
  }
}