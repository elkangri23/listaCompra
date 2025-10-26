/**
 * Puerto (interface) para el servicio de tokens JWT
 * Define las operaciones para generar y validar tokens de autenticación
 */

import type { Result } from '@shared/result';
import type { UUID } from '@shared/types';

export interface TokenPayload {
  userId: UUID;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface ITokenService {
  /**
   * Genera un token de acceso JWT
   * @param payload - Datos a incluir en el token
   * @returns Token JWT firmado
   */
  generateAccessToken(payload: TokenPayload): Promise<Result<string, Error>>;

  /**
   * Genera un token de refresh JWT
   * @param payload - Datos a incluir en el token
   * @returns Token JWT de refresh firmado
   */
  generateRefreshToken(payload: TokenPayload): Promise<Result<string, Error>>;

  /**
   * Genera un par de tokens (acceso y refresh)
   * @param payload - Datos a incluir en los tokens
   * @returns Par de tokens
   */
  generateTokenPair(payload: TokenPayload): Promise<Result<TokenPair, Error>>;

  /**
   * Verifica y decodifica un token de acceso
   * @param token - Token JWT a verificar
   * @returns Payload del token si es válido
   */
  verifyAccessToken(token: string): Promise<Result<TokenPayload, Error>>;

  /**
   * Verifica y decodifica un token de refresh
   * @param token - Token JWT de refresh a verificar
   * @returns Payload del token si es válido
   */
  verifyRefreshToken(token: string): Promise<Result<TokenPayload, Error>>;

  /**
   * Extrae el token del header Authorization
   * @param authHeader - Header Authorization completo
   * @returns Token extraído sin el prefijo "Bearer "
   */
  extractTokenFromHeader(authHeader: string): Result<string, Error>;

  /**
   * Verifica si un token está próximo a expirar
   * @param token - Token JWT a verificar
   * @param thresholdMinutes - Minutos antes de la expiración para considerar "próximo"
   * @returns true si está próximo a expirar
   */
  isTokenNearExpiry(token: string, thresholdMinutes?: number): Promise<Result<boolean, Error>>;

  /**
   * Obtiene el tiempo restante de vida de un token en segundos
   * @param token - Token JWT
   * @returns Segundos restantes hasta la expiración
   */
  getTokenTTL(token: string): Promise<Result<number, Error>>;
}