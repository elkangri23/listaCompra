/**
 * DTO para autenticación de usuario
 */

export interface LoginDto {
  email: string;
  password: string;
  /**
   * Metadatos del intento (los pone el controlador desde la request).
   * Solo para el registro de intentos de inicio de sesión; nunca se
   * persisten en ningún otro sitio ni se devuelven al cliente.
   */
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
}

export interface LoginResponseDto {
  user: {
    id: string;
    email: string;
    nombre: string;
    apellidos?: string;
    nombreCompleto: string;
    rol: string;
    activo: boolean;
    emailVerificado: boolean;
  };
  tokens: {
    accessToken: string;
    refreshToken: string;
  };
}

/** Respuesta del paso 1 cuando el usuario tiene TOTP activo: NO contiene tokens */
export interface LoginMfaRequiredDto {
  mfaRequired: true;
  mfa: {
    challengeId: string;
  };
}

export interface RefreshTokenDto {
  refreshToken: string;
}

export interface RefreshTokenResponseDto {
  accessToken: string;
  refreshToken: string;
}