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
import type { RequestAccountDeletion } from '@application/use-cases/gdpr/RequestAccountDeletion';
import type { ExportMyData } from '@application/use-cases/gdpr/ExportMyData';
import type { RequestEmailVerificationCode } from '@application/use-cases/auth/RequestEmailVerificationCode';
import type { VerifyEmailCode } from '@application/use-cases/auth/VerifyEmailCode';
import type { RequestPasswordResetCode } from '@application/use-cases/auth/RequestPasswordResetCode';
import type { ResetPasswordWithCode } from '@application/use-cases/auth/ResetPasswordWithCode';
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
  requestAccountDeletion?: RequestAccountDeletion;
  exportMyData?: ExportMyData;
  requestEmailVerificationCode?: RequestEmailVerificationCode;
  verifyEmailCode?: VerifyEmailCode;
  requestPasswordResetCode?: RequestPasswordResetCode;
  resetPasswordWithCode?: ResetPasswordWithCode;
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
            verificationEmailSent: result.value.verificationEmailSent,
            fechaCreacion: result.value.fechaCreacion,
            terminosAceptadosEn: result.value.terminosAceptadosEn,
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
          // Cuenta sin verificar (item 3): no es un fallo de credenciales;
          // se devuelve 200 con el estado para que el frontend lleve a
          // /verify-email (mismo patrón que el paso MFA).
          if (result.error.message === 'Email no verificado') {
            res.status(200).json({
              success: true,
              data: { emailNotVerified: true, email: dto.email },
              message: 'Debes verificar tu correo electrónico antes de entrar',
              timestamp: new Date().toISOString(),
            });
            return;
          }
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

  /**
   * DELETE /auth/me
   * Solicita la eliminación de la cuenta (GDPR, item 15). Requiere la contraseña
   * actual; desactiva la cuenta y la purga definitiva llega a los 30 días.
   */
  requestDeletion = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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
      if (!this.dependencies.requestAccountDeletion) {
        res.status(500).json({
          success: false,
          error: 'INTERNAL_ERROR',
          message: 'Error interno del servidor',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const { password } = req.body as { password?: string };
      const result = await this.dependencies.requestAccountDeletion.execute({
        usuarioId: user.userId,
        password: password ?? '',
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
   * GET /auth/me/export
   * Exporta todos los datos del usuario autenticado en JSON (GDPR, item 15).
   */
  exportMyData = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
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
      if (!this.dependencies.exportMyData) {
        res.status(500).json({
          success: false,
          error: 'INTERNAL_ERROR',
          message: 'Error interno del servidor',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const result = await this.dependencies.exportMyData.execute({
        usuarioId: user.userId,
      });

      if (result.isFailure) {
        this.handleUseCaseError(result.error, res);
        return;
      }

      const fecha = new Date().toISOString().slice(0, 10);
      res
        .status(200)
        .set('Content-Type', 'application/json')
        .set('Content-Disposition', `attachment; filename="mis-datos-lista-compra-${fecha}.json"`)
        .json(result.value);
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /auth/verify-email
   * Verifica el correo con el código de 6 dígitos (item 3).
   */
  verifyEmail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!this.dependencies.verifyEmailCode) {
        res.status(500).json({
          success: false,
          error: 'INTERNAL_ERROR',
          message: 'Error interno del servidor',
          timestamp: new Date().toISOString(),
        });
        return;
      }
      const { email, codigo } = req.body as { email?: string; codigo?: string };
      if (!email || !codigo) {
        res.status(400).json({
          success: false,
          error: 'VALIDATION_ERROR',
          message: 'Email y código son requeridos',
          timestamp: new Date().toISOString(),
        });
        return;
      }
      const result = await this.dependencies.verifyEmailCode.execute({ email, codigo });
      if (result.isFailure) {
        this.handleUseCaseError(result.error, res);
        return;
      }
      res.status(200).json({
        success: true,
        data: result.value,
        message: result.value.mensaje,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /auth/resend-verification-code
   * Reenvía el código de verificación (item 3). Respuesta genérica
   * para no revelar si el correo existe.
   */
  resendVerificationCode = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!this.dependencies.requestEmailVerificationCode) {
        res.status(500).json({
          success: false,
          error: 'INTERNAL_ERROR',
          message: 'Error interno del servidor',
          timestamp: new Date().toISOString(),
        });
        return;
      }
      const { email } = req.body as { email?: string };
      if (!email) {
        res.status(400).json({
          success: false,
          error: 'VALIDATION_ERROR',
          message: 'Email es requerido',
          timestamp: new Date().toISOString(),
        });
        return;
      }
      const result = await this.dependencies.requestEmailVerificationCode.execute({ email });
      if (result.isFailure) {
        this.handleUseCaseError(result.error, res);
        return;
      }
      res.status(200).json({
        success: true,
        data: result.value,
        message: result.value.mensaje,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /auth/forgot-password
   * Solicita el código de restablecimiento (item 9c). Respuesta genérica
   * para no revelar si el correo existe.
   */
  requestPasswordReset = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!this.dependencies.requestPasswordResetCode) {
        res.status(500).json({
          success: false,
          error: 'INTERNAL_ERROR',
          message: 'Error interno del servidor',
          timestamp: new Date().toISOString(),
        });
        return;
      }
      const { email } = req.body as { email?: string };
      if (!email) {
        res.status(400).json({
          success: false,
          error: 'VALIDATION_ERROR',
          message: 'Email es requerido',
          timestamp: new Date().toISOString(),
        });
        return;
      }
      const result = await this.dependencies.requestPasswordResetCode.execute({ email });
      if (result.isFailure) {
        this.handleUseCaseError(result.error, res);
        return;
      }
      res.status(200).json({
        success: true,
        data: result.value,
        message: result.value.mensaje,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /auth/reset-password
   * Restablece la contraseña con el código de 6 dígitos (item 9c).
   */
  resetPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!this.dependencies.resetPasswordWithCode) {
        res.status(500).json({
          success: false,
          error: 'INTERNAL_ERROR',
          message: 'Error interno del servidor',
          timestamp: new Date().toISOString(),
        });
        return;
      }
      const { email, codigo, nuevaPassword } = req.body as { email?: string; codigo?: string; nuevaPassword?: string };
      if (!email || !codigo || !nuevaPassword) {
        res.status(400).json({
          success: false,
          error: 'VALIDATION_ERROR',
          message: 'Email, código y nueva contraseña son requeridos',
          timestamp: new Date().toISOString(),
        });
        return;
      }
      const result = await this.dependencies.resetPasswordWithCode.execute({ email, codigo, nuevaPassword });
      if (result.isFailure) {
        this.handleUseCaseError(result.error, res);
        return;
      }
      res.status(200).json({
        success: true,
        data: result.value,
        message: result.value.mensaje,
        timestamp: new Date().toISOString(),
      });
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