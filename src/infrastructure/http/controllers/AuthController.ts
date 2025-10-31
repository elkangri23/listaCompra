/**
 * Controlador de autenticación
 * Maneja las operaciones HTTP relacionadas con autenticación de usuarios
 */

import { Request, Response, NextFunction } from 'express';
import type { RegisterUser } from '@application/use-cases/auth/RegisterUser';
import type { AuthenticateUser } from '@application/use-cases/auth/AuthenticateUser';
import type { RegisterUserDto } from '@application/dto/auth/RegisterUserDto';
import type { LoginDto } from '@application/dto/auth/LoginDto';
import { ValidationError } from '@application/errors/ValidationError';
import { UnauthorizedError } from '@application/errors/UnauthorizedError';

export interface AuthControllerDependencies {
  registerUser: RegisterUser;
  authenticateUser: AuthenticateUser;
}

export class AuthController {
  constructor(private readonly dependencies: AuthControllerDependencies) {}

  /**
   * POST /auth/register
   * Registra un nuevo usuario en el sistema
   */
  register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dto: RegisterUserDto = req.body;

      // Validar DTO básico (validaciones más específicas en el caso de uso)
      if (!dto.email || !dto.password || !dto.nombre) {
        res.status(400).json({
          success: false,
          error: 'VALIDATION_ERROR',
          message: 'Email, password y nombre son requeridos',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const result = await this.dependencies.registerUser.execute(dto);

      if (result.isFailure) {
        if (result.error instanceof ValidationError) {
          res.status(400).json({
            success: false,
            error: 'VALIDATION_ERROR',
            message: result.error.message,
            timestamp: new Date().toISOString(),
          });
          return;
        }

        res.status(500).json({
          success: false,
          error: 'INTERNAL_ERROR',
          message: 'Error interno del servidor',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      res.status(201).json({
        success: true,
        data: {
          user: {
            id: result.value.id,
            email: result.value.email,
            nombre: result.value.nombre,
            apellidos: result.value.apellidos,
            nombreCompleto: result.value.nombreCompleto,
            rol: result.value.rol,
            activo: result.value.activo,
            emailVerificado: result.value.emailVerificado,
            fechaCreacion: result.value.fechaCreacion,
          },
        },
        message: 'Usuario registrado exitosamente',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /auth/login
   * Autentica un usuario y devuelve tokens de acceso
   */
  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dto: LoginDto = req.body;

      // Validar DTO básico
      if (!dto.email || !dto.password) {
        res.status(400).json({
          success: false,
          error: 'VALIDATION_ERROR',
          message: 'Email y password son requeridos',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const result = await this.dependencies.authenticateUser.execute(dto);

      if (result.isFailure) {
        if (result.error instanceof UnauthorizedError) {
          res.status(401).json({
            success: false,
            error: 'UNAUTHORIZED',
            message: 'Credenciales inválidas',
            timestamp: new Date().toISOString(),
          });
          return;
        }

        if (result.error instanceof ValidationError) {
          res.status(400).json({
            success: false,
            error: 'VALIDATION_ERROR',
            message: result.error.message,
            timestamp: new Date().toISOString(),
          });
          return;
        }

        res.status(500).json({
          success: false,
          error: 'INTERNAL_ERROR',
          message: 'Error interno del servidor',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          user: {
            id: result.value.user.id,
            email: result.value.user.email,
            nombre: result.value.user.nombre,
            apellidos: result.value.user.apellidos,
            nombreCompleto: result.value.user.nombreCompleto,
            rol: result.value.user.rol,
            activo: result.value.user.activo,
            emailVerificado: result.value.user.emailVerificado,
          },
          tokens: result.value.tokens,
        },
        message: 'Autenticación exitosa',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /auth/refresh
   * Renueva un token de acceso usando un token de refresh válido
   */
  refresh = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        res.status(400).json({
          success: false,
          error: 'VALIDATION_ERROR',
          message: 'Refresh token es requerido',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // TODO: Implementar caso de uso RefreshTokens
      // Por ahora, respuesta temporal
      res.status(501).json({
        success: false,
        error: 'NOT_IMPLEMENTED',
        message: 'Funcionalidad de refresh token pendiente de implementar',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /auth/logout
   * Invalida los tokens del usuario (blacklist)
   */
  logout = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // TODO: Implementar invalidación de tokens (blacklist)
      // Por ahora, respuesta exitosa temporal

      res.status(200).json({
        success: true,
        message: 'Logout exitoso',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /auth/me
   * Obtiene la información del usuario autenticado
   */
  me = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // La información del usuario debería estar en req.user después del middleware de auth
      const user = (req as any).user;

      if (!user) {
        res.status(401).json({
          success: false,
          error: 'UNAUTHORIZED',
          message: 'Token de acceso requerido',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          user: {
            id: user.userId,
            email: user.email,
            rol: user.role,
          },
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };
}