/**
 * DTO para registro de usuario
 */

export interface RegisterUserDto {
  email: string;
  password: string;
  nombre: string;
  apellidos?: string;
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
}