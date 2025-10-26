/**
 * DTO para autenticación de usuario
 */

export interface LoginDto {
  email: string;
  password: string;
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

export interface RefreshTokenDto {
  refreshToken: string;
}

export interface RefreshTokenResponseDto {
  accessToken: string;
  refreshToken: string;
}