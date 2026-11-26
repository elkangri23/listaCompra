/**
 * DTO para registro de usuario
 */

export interface RegisterUserDto {
  email: string;
  password: string;
  nombre: string;
  apellidos?: string;
  aceptoTerminos: boolean;
  turnstileToken?: string;
}

export interface RegisterUserResponseDto {
  id: string;
  email: string;
  nombre: string;
  apellidos?: string;
  nombreCompleto: string;
  rol: string;
  activo: boolean;
  emailVerificado: boolean;
  fechaCreacion: string;
  terminosAceptadosEn?: string;
  /** true si el correo con el código de verificación se envió (item 3) */
  verificationEmailSent?: boolean;
}