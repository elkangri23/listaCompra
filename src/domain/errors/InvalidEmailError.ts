/**
 * Error específico para emails inválidos
 */

import { InvalidValueError } from './DomainError';

export class InvalidEmailError extends InvalidValueError {
  constructor(email: string) {
    super(
      `El email "${email}" no tiene un formato válido`,
      'email',
      email
    );
  }

  static create(email: string): InvalidEmailError {
    return new InvalidEmailError(email);
  }
}