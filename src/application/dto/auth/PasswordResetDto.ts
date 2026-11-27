/**
 * DTOs para el restablecimiento de contraseña por código (item 9c)
 * Mismo patrón que la verificación de email (item 3): código de 6 dígitos,
 * solo su HMAC guardado, 15 minutos de vida, 5 intentos.
 */

export interface RequestPasswordResetDto {
  email: string;
}

export interface RequestPasswordResetResponseDto {
  emailSent: boolean;
  mensaje: string;
}

export interface ResetPasswordDto {
  email: string;
  codigo: string;
  nuevaPassword: string;
}

export interface ResetPasswordResponseDto {
  mensaje: string;
}
