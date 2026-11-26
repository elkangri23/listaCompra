/**
 * Errores de dominio para MFA (TOTP)
 * Cada clase porta un `code` estable que el frontend discrimina.
 */

import { DomainError } from './DomainError';

export class MfaError extends DomainError {
  constructor(
    message: string,
    public readonly errorCode: string,
    public readonly httpStatus: number = 400
  ) {
    super(message, 'MFA_ERROR');
  }

  toJSON(): Record<string, unknown> {
    return {
      code: this.errorCode,
      message: this.message,
      timestamp: this.timestamp,
    };
  }
}

export class MfaChallengeExpiredError extends MfaError {
  constructor() {
    super('El código de verificación ha expirado. Vuelve a iniciar sesión.', 'CHALLENGE_EXPIRED', 410);
  }
}

export class MfaTooManyAttemptsError extends MfaError {
  constructor() {
    super('Demasiados intentos incorrectos. Vuelve a iniciar sesión.', 'MFA_TOO_MANY_ATTEMPTS', 429);
  }
}

export class MfaNotSetupError extends MfaError {
  constructor() {
    super('No hay un TOTP pendiente de confirmar. Inicia la configuración primero.', 'MFA_NOT_SETUP', 409);
  }
}

export class MfaSetupLockedError extends MfaError {
  constructor() {
    super('Demasiados intentos de configuración. Vuelve a intentarlo tras iniciar sesión de nuevo.', 'MFA_SETUP_LOCKED', 429);
  }
}

export class MfaAlreadyEnabledError extends MfaError {
  constructor() {
    super('El TOTP ya está activo. Desactívalo antes de reconfigurarlo.', 'MFA_ALREADY_ENABLED', 409);
  }
}

export class TotpCodeInvalidError extends MfaError {
  constructor() {
    super('Código de verificación incorrecto.', 'TOTP_CODE_INVALID', 400);
  }
}

export class BackupCodeInvalidError extends MfaError {
  constructor() {
    super('Código de respaldo incorrecto o ya utilizado.', 'BACKUP_CODE_INVALID', 400);
  }
}

export class MfaCryptoError extends MfaError {
  constructor(message = 'No se pudo descifrar el secreto TOTP. Contacta a soporte.') {
    super(message, 'MFA_DECRYPT_FAILED', 500);
  }
}

// ============================================================================
// Passkeys (fase 2)
// ============================================================================

export class PasskeyLimitReachedError extends MfaError {
  constructor() {
    super('Has alcanzado el máximo de 5 passkeys. Elimina alguna para añadir otra.', 'PASSKEY_LIMIT_REACHED', 409);
  }
}

export class PasskeyNotFoundError extends MfaError {
  constructor() {
    super('Passkey no encontrada.', 'PASSKEY_NOT_FOUND', 404);
  }
}

export class PasskeyUnknownCredentialError extends MfaError {
  constructor() {
    super('Credencial no reconocida.', 'PASSKEY_UNKNOWN_CREDENTIAL', 404);
  }
}

export class PasskeyInactiveError extends MfaError {
  constructor() {
    super('Esta passkey está bloqueada por seguridad. Inicia sesión con otra.',
      'PASSKEY_INACTIVE', 403);
  }
}

export class PasskeyVerificationError extends MfaError {
  constructor(message = 'No se pudo verificar la passkey. Solicita opciones nuevas e inténtalo de nuevo.') {
    super(message, 'PASSKEY_VERIFICATION_FAILED', 400);
  }
}
