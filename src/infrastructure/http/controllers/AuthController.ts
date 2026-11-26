/**
 * Controlador de autenticación
 * Maneja las operaciones HTTP relacionadas con autenticación de usuarios
 */

import { Request, Response, NextFunction } from 'express';
import type { RegisterUser } from '@application/use-cases/auth/RegisterUser';
import type { AuthenticateUser } from '@application/use-cases/auth/AuthenticateUser';
import type { RefreshTokens } from '@application/use-cases/auth/RefreshTokens';
import type { UpdateProfile } from '@application/use-cases/auth/UpdateProfile';
import type { ChangePassword } from '@application/use-cases/auth/ChangePassword';
import type { RegisterUserDto } from '@application/dto/auth/RegisterUserDto';
import type { LoginDto } from '@application/dto/auth/LoginDto';
import type { IUsuarioRepository } from '@application/ports/repositories/IUsuarioRepository';
import { ValidationError } from '@application/errors/ValidationError';
import { UnauthorizedError } from '@application/errors/UnauthorizedError';
import { NotFoundError } from '@application/errors/NotFoundError';

export interface AuthControllerDependencies {
  registerUser: RegisterUser;
  authenticateUser: AuthenticateUser;
  refreshTokens?: RefreshTokens;
  updateProfile?: UpdateProfile;
  changePassword?: ChangePassword;
  usuarioRepository?: IUsuarioRepository;
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
        data: 'mfaRequired' in result.value
          ? { mfaRequired: true, mfa: result.value.mfa }
          : {
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

      if (!this.dependencies.refreshTokens) {
        res.status(500).json({
          success: false,
          error: 'INTERNAL_ERROR',
          message: 'Renovación de sesión no disponible',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const result = await this.dependencies.refreshTokens.execute(refreshToken);

      if (result.isFailure) {
        if (result.error instanceof UnauthorizedError) {
          res.status(401).json({
            success: false,
            error: 'UNAUTHORIZED',
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
          tokens: result.value.tokens,
        },
        message: 'Token renovado',
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
   * Obtiene la información del usuario autenticado (13A).
   * Responde el usuario directamente (sin envoltorio), como espera el frontend
   * (AuthUser: {id, name, email, roles, image}).
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

      const usuarioRepository = this.dependencies.usuarioRepository;
      if (!usuarioRepository) {
        res.status(500).json({
          success: false,
          error: 'INTERNAL_ERROR',
          message: 'Error interno del servidor',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const usuarioResult = await usuarioRepository.findById(user.userId);
      if (usuarioResult.isFailure || !usuarioResult.value) {
        res.status(404).json({
          success: false,
          error: 'NOT_FOUND',
          message: 'Usuario no encontrado',
          timestamp: new Date().toISOString(),
        });
        return;
      }
      const usuario = usuarioResult.value;

      res.status(200).json({
        id: usuario.id,
        name: usuario.nombreCompleto,
        email: usuario.email.value,
        roles: [usuario.rol],
        image: null,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * PATCH /auth/me
   * Actualiza el perfil del usuario autenticado (13A).
   * Acepta {name?, email?}; `bio` se ignora (el backend no tiene ese campo).
   */
  updateMe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
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
      if (!this.dependencies.updateProfile) {
        res.status(500).json({
          success: false,
          error: 'INTERNAL_ERROR',
          message: 'Error interno del servidor',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const { name, email } = req.body as { name?: string; email?: string };
      const result = await this.dependencies.updateProfile.execute({
        usuarioId: user.userId,
        ...(typeof name === 'string' ? { nombre: name } : {}),
        ...(typeof email === 'string' ? { email } : {}),
      });

      if (result.isFailure) {
        this.handleUseCaseError(result.error, res);
        return;
      }

      res.status(200).json(result.value);
    } catch (error) {
      next(error);
    }
  };

  /**
   * PATCH /auth/me/password
   * Cambia la contraseña del usuario autenticado (13A).
   */
  changeMyPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
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
      if (!this.dependencies.changePassword) {
        res.status(500).json({
          success: false,
          error: 'INTERNAL_ERROR',
          message: 'Error interno del servidor',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string };
      const result = await this.dependencies.changePassword.execute({
        usuarioId: user.userId,
        currentPassword: currentPassword ?? '',
        newPassword: newPassword ?? '',
      });

      if (result.isFailure) {
        this.handleUseCaseError(result.error, res);
        return;
      }

      res.status(200).json(result.value);
    } catch (error) {
      next(error);
    }
  };

  private handleUseCaseError(error: Error, res: Response): void {
    if (error instanceof ValidationError) {
      res.status(400).json({
        success: false,
        error: error.message,
        code: error.code ?? 'VALIDATION_ERROR',
        timestamp: new Date().toISOString(),
      });
      return;
    }
    if (error instanceof NotFoundError) {
      res.status(404).json({
        success: false,
        error: error.message,
        code: error.code ?? 'NOT_FOUND',
        timestamp: new Date().toISOString(),
      });
      return;
    }
    if (error instanceof UnauthorizedError) {
      res.status(401).json({
        success: false,
        error: error.message,
        code: error.code ?? 'UNAUTHORIZED',
        timestamp: new Date().toISOString(),
      });
      return;
    }
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor',
      code: 'INTERNAL_ERROR',
      timestamp: new Date().toISOString(),
    });
  }
}