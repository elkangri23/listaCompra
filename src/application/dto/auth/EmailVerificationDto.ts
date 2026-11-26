/**
 * DTOs para la verificación de email por código (item 3)
 */

export interface RequestVerificationCodeDto {
  email: string;
}

export interface RequestVerificationCodeResponseDto {
  emailSent: boolean;
  mensaje: string;
}

export interface VerifyEmailCodeDto {
  email: string;
  codigo: string;
}

export interface VerifyEmailCodeResponseDto {
  emailVerificado: boolean;
  mensaje: string;
}
