/**
 * Middleware de autenticación
 * Verifica tokens JWT y añade información del usuario a la request
 */

import { Request, Response, NextFunction } from 'express';
import type { ITokenService } from '@application/ports/auth/ITokenService';

export interface AuthMiddlewareDependencies {
  tokenService: ITokenService;
}

export function createAuthMiddleware(dependencies: AuthMiddlewareDependencies) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader) {
        res.status(401).json({
          success: false,
          error: 'UNAUTHORIZED',
          message: 'Token de autorización requerido',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Extraer token del header
      const tokenResult = dependencies.tokenService.extractTokenFromHeader(authHeader);
      if (tokenResult.isFailure) {
        res.status(401).json({
          success: false,
          error: 'UNAUTHORIZED',
          message: tokenResult.error.message,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const token = tokenResult.value;

      // Verificar token
      const verifyResult = await dependencies.tokenService.verifyAccessToken(token);
      if (verifyResult.isFailure) {
        res.status(401).json({
          success: false,
          error: 'UNAUTHORIZED',
          message: verifyResult.error.message,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Añadir información del usuario a la request
      const payload = verifyResult.value;
      (req as any).user = {
        id: payload.userId,
        userId: payload.userId,
        email: payload.email,
        rol: payload.role,
        role: payload.role,
        tokenIssuedAt: payload.iat,
        tokenExpiry: payload.exp,
      };
      next();
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'Error interno del servidor',
        timestamp: new Date().toISOString(),
      });
    }
  };
}

/**
 * Middleware opcional de autenticación
 * No falla si no hay token, pero añade la información del usuario si está presente
 */
export function createOptionalAuthMiddleware(dependencies: AuthMiddlewareDependencies) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;

      // Si no hay header, continuar sin autenticación
      if (!authHeader) {
        next();
        return;
      }

      // Extraer token del header
      const tokenResult = dependencies.tokenService.extractTokenFromHeader(authHeader);
      if (tokenResult.isFailure) {
        next();
        return;
      }

      const token = tokenResult.value;

      // Verificar token
      const verifyResult = await dependencies.tokenService.verifyAccessToken(token);
      if (verifyResult.isSuccess) {
        const payload = verifyResult.value;
        (req as any).user = {
          id: payload.userId,
          userId: payload.userId,
          email: payload.email,
          rol: payload.role,
          role: payload.role,
          tokenIssuedAt: payload.iat,
          tokenExpiry: payload.exp,
        };
      }

      next();
    } catch (error) {
      // En modo opcional, los errores no detienen la ejecución
      next();
    }
  };
}
