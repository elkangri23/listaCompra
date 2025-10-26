/**
 * Error de autorización en la capa de aplicación
 */

export class UnauthorizedError extends Error {
  public readonly code = 'UNAUTHORIZED';

  constructor(message: string = 'Acceso no autorizado') {
    super(message);
    this.name = 'UnauthorizedError';
  }

  static invalidCredentials(): UnauthorizedError {
    return new UnauthorizedError('Credenciales inválidas');
  }

  static tokenExpired(): UnauthorizedError {
    return new UnauthorizedError('Token expirado');
  }

  static tokenInvalid(): UnauthorizedError {
    return new UnauthorizedError('Token inválido');
  }

  static userInactive(): UnauthorizedError {
    return new UnauthorizedError('Usuario inactivo');
  }

  static emailNotVerified(): UnauthorizedError {
    return new UnauthorizedError('Email no verificado');
  }

  static insufficientPermissions(): UnauthorizedError {
    return new UnauthorizedError('Permisos insuficientes');
  }

  toJSON(): Record<string, unknown> {
    return {
      code: this.code,
      message: this.message,
    };
  }
}