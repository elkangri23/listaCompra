/**
 * Implementación del servicio de tokens usando JWT
 */

import * as jwt from 'jsonwebtoken';
import type { Result } from '@shared/result';
import { success, failure } from '@shared/result';
import type { ITokenService, TokenPayload, TokenPair } from '@application/ports/auth/ITokenService';

export class JWTTokenService implements ITokenService {
  private readonly secret: string;
  private readonly accessTokenExpiry: string;
  private readonly refreshTokenExpiry: string;
  private readonly algorithm: jwt.Algorithm = 'HS256';

  constructor() {
    this.secret = process.env['JWT_SECRET'] || 'fallback-secret-change-in-production';
    this.accessTokenExpiry = process.env['JWT_ACCESS_EXPIRES_IN'] || '1h';
    this.refreshTokenExpiry = process.env['JWT_REFRESH_EXPIRES_IN'] || '7d';

    if (this.secret === 'fallback-secret-change-in-production') {
      console.warn('⚠️  Using fallback JWT secret. Set JWT_SECRET environment variable.');
    }
  }

  async generateAccessToken(payload: TokenPayload): Promise<Result<string, Error>> {
    try {
      const options: any = {
        algorithm: this.algorithm,
        expiresIn: this.accessTokenExpiry,
        issuer: 'lista-compra-api',
        audience: 'lista-compra-client',
      };

      const token = jwt.sign(
        {
          userId: payload.userId,
          email: payload.email,
          role: payload.role,
          type: 'access',
        },
        this.secret,
        options
      );

      return success(token);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido al generar token de acceso';
      return failure(new Error(`Error al generar token de acceso: ${errorMessage}`));
    }
  }

  async generateRefreshToken(payload: TokenPayload): Promise<Result<string, Error>> {
    try {
      const options: any = {
        algorithm: this.algorithm,
        expiresIn: this.refreshTokenExpiry,
        issuer: 'lista-compra-api',
        audience: 'lista-compra-client',
      };

      const token = jwt.sign(
        {
          userId: payload.userId,
          email: payload.email,
          role: payload.role,
          type: 'refresh',
        },
        this.secret,
        options
      );

      return success(token);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido al generar token de refresh';
      return failure(new Error(`Error al generar token de refresh: ${errorMessage}`));
    }
  }

  async generateTokenPair(payload: TokenPayload): Promise<Result<TokenPair, Error>> {
    try {
      const accessTokenResult = await this.generateAccessToken(payload);
      if (accessTokenResult.isFailure) {
        return failure(accessTokenResult.error);
      }

      const refreshTokenResult = await this.generateRefreshToken(payload);
      if (refreshTokenResult.isFailure) {
        return failure(refreshTokenResult.error);
      }

      return success({
        accessToken: accessTokenResult.value,
        refreshToken: refreshTokenResult.value,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido al generar par de tokens';
      return failure(new Error(`Error al generar par de tokens: ${errorMessage}`));
    }
  }

  async verifyAccessToken(token: string): Promise<Result<TokenPayload, Error>> {
    try {
      const decoded = jwt.verify(token, this.secret, {
        algorithms: [this.algorithm],
        issuer: 'lista-compra-api',
        audience: 'lista-compra-client',
      }) as jwt.JwtPayload;

      // Verificar que sea un token de acceso
      if (decoded['type'] !== 'access') {
        return failure(new Error('Token no es de acceso'));
      }

      // Validar campos requeridos
      if (!decoded['userId'] || !decoded['email'] || !decoded['role']) {
        return failure(new Error('Token de acceso malformado'));
      }

      const payload: TokenPayload = {
        userId: decoded['userId'],
        email: decoded['email'],
        role: decoded['role'],
        ...(decoded.iat !== undefined && { iat: decoded.iat }),
        ...(decoded.exp !== undefined && { exp: decoded.exp }),
      };

      return success(payload);
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        return failure(new Error('Token de acceso expirado'));
      }
      if (error instanceof jwt.JsonWebTokenError) {
        return failure(new Error('Token de acceso inválido'));
      }
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido al verificar token de acceso';
      return failure(new Error(`Error al verificar token de acceso: ${errorMessage}`));
    }
  }

  async verifyRefreshToken(token: string): Promise<Result<TokenPayload, Error>> {
    try {
      const decoded = jwt.verify(token, this.secret, {
        algorithms: [this.algorithm],
        issuer: 'lista-compra-api',
        audience: 'lista-compra-client',
      }) as jwt.JwtPayload;

      // Verificar que sea un token de refresh
      if (decoded['type'] !== 'refresh') {
        return failure(new Error('Token no es de refresh'));
      }

      // Validar campos requeridos
      if (!decoded['userId'] || !decoded['email'] || !decoded['role']) {
        return failure(new Error('Token de refresh malformado'));
      }

      const payload: TokenPayload = {
        userId: decoded['userId'],
        email: decoded['email'],
        role: decoded['role'],
        ...(decoded.iat !== undefined && { iat: decoded.iat }),
        ...(decoded.exp !== undefined && { exp: decoded.exp }),
      };

      return success(payload);
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        return failure(new Error('Token de refresh expirado'));
      }
      if (error instanceof jwt.JsonWebTokenError) {
        return failure(new Error('Token de refresh inválido'));
      }
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido al verificar token de refresh';
      return failure(new Error(`Error al verificar token de refresh: ${errorMessage}`));
    }
  }

  extractTokenFromHeader(authHeader: string): Result<string, Error> {
    if (!authHeader || typeof authHeader !== 'string') {
      return failure(new Error('Header de autorización faltante'));
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return failure(new Error('Formato de header de autorización inválido. Debe ser: Bearer <token>'));
    }

    const token = parts[1];
    if (!token) {
      return failure(new Error('Token faltante en header de autorización'));
    }

    return success(token);
  }

  async isTokenNearExpiry(token: string, thresholdMinutes = 5): Promise<Result<boolean, Error>> {
    try {
      const decoded = jwt.decode(token) as jwt.JwtPayload;
      
      if (!decoded || !decoded.exp) {
        return failure(new Error('Token inválido o sin expiración'));
      }

      const now = Math.floor(Date.now() / 1000);
      const expirationTime = decoded.exp;
      const timeUntilExpiry = expirationTime - now;
      const thresholdSeconds = thresholdMinutes * 60;

      return success(timeUntilExpiry <= thresholdSeconds);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido al verificar expiración';
      return failure(new Error(`Error al verificar expiración del token: ${errorMessage}`));
    }
  }

  async getTokenTTL(token: string): Promise<Result<number, Error>> {
    try {
      const decoded = jwt.decode(token) as jwt.JwtPayload;
      
      if (!decoded || !decoded.exp) {
        return failure(new Error('Token inválido o sin expiración'));
      }

      const now = Math.floor(Date.now() / 1000);
      const ttl = decoded.exp - now;

      return success(Math.max(0, ttl)); // No retornar valores negativos
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido al obtener TTL';
      return failure(new Error(`Error al obtener TTL del token: ${errorMessage}`));
    }
  }
}