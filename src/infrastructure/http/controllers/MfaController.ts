/**
 * Controlador MFA (TOTP fase 1)
 * Endpoints: /auth/mfa/status, /auth/totp/*, /auth/login/mfa
 * Formas de respuesta: sobre de éxito { success, data, message, timestamp }
 * y errores según errorMiddleware ({ success:false, error:{...}, ... code }).
 */

import type { Request, Response } from 'express';
import type { GetMfaStatus } from '@application/use-cases/auth/GetMfaStatus';
import type { SetupTotp } from '@application/use-cases/auth/SetupTotp';
import type { VerifyEnableTotp } from '@application/use-cases/auth/VerifyEnableTotp';
import type { DisableTotp } from '@application/use-cases/auth/DisableTotp';
import type { MfaLogin } from '@application/use-cases/auth/MfaLogin';
import { MfaError } from '@domain/errors/MfaError';
import { UnauthorizedError } from '@application/errors/UnauthorizedError';
import { NotFoundError } from '@application/errors/NotFoundError';
import { ValidationError } from '@application/errors/ValidationError';

interface AuthenticatedRequest extends Request {
  user?: { id: string; email: string; role: string };
}

export interface MfaControllerDeps {
  getMfaStatus: GetMfaStatus;
  setupTotp: SetupTotp;
  verifyEnableTotp: VerifyEnableTotp;
  disableTotp: DisableTotp;
  mfaLogin: MfaLogin;
}

export class MfaController {
  constructor(private readonly deps: MfaControllerDeps) {}

  /** GET /auth/mfa/status */
  async getStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user?.id;
    if (!userId) {
      this.sendUnauthorized(res);
      return;
    }
    const result = await this.deps.getMfaStatus.execute(userId as never);
    if (result.isFailure) {
      this.sendDomainError(res, result.error);
      return;
    }
    res.status(200).json({
      success: true,
      data: result.value,
      message: 'Estado MFA',
      timestamp: new Date().toISOString(),
    });
  }

  /** POST /auth/totp/setup — step-up: { password } */
  async setup(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user?.id;
    if (!userId) {
      this.sendUnauthorized(res);
      return;
    }
    if (!req.body?.password || typeof req.body.password !== 'string') {
      res.status(400).json({
        success: false,
        error: { type: 'VALIDATION_ERROR', message: 'password es obligatorio', timestamp: new Date().toISOString() },
      });
      return;
    }
    const result = await this.deps.setupTotp.execute({
      usuarioId: userId as never,
      password: req.body.password,
    });
    if (result.isFailure) {
      this.sendDomainError(res, result.error);
      return;
    }
    res.status(200).json({
      success: true,
      data: result.value,
      message: 'Escanea el QR o introduce la clave manualmente para confirmar',
      timestamp: new Date().toISOString(),
    });
  }

  /** POST /auth/totp/verify-enable — step-up: { password, code } */
  async verifyEnable(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user?.id;
    if (!userId) {
      this.sendUnauthorized(res);
      return;
    }
    if (!req.body?.password || typeof req.body.password !== 'string' || !req.body?.code || typeof req.body.code !== 'string') {
      res.status(400).json({
        success: false,
        error: { type: 'VALIDATION_ERROR', message: 'password y code son obligatorios', timestamp: new Date().toISOString() },
      });
      return;
    }
    const result = await this.deps.verifyEnableTotp.execute({
      usuarioId: userId as never,
      password: req.body.password,
      code: req.body.code,
    });
    if (result.isFailure) {
      this.sendDomainError(res, result.error);
      return;
    }
    res.status(200).json({
      success: true,
      data: result.value,
      message: 'TOTP activado. Guarda tus códigos de respaldo: no se mostrarán de nuevo.',
      timestamp: new Date().toISOString(),
    });
  }

  /** POST /auth/totp/disable — step-up: { password, code? } */
  async disable(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user?.id;
    if (!userId) {
      this.sendUnauthorized(res);
      return;
    }
    if (!req.body?.password || typeof req.body.password !== 'string') {
      res.status(400).json({
        success: false,
        error: { type: 'VALIDATION_ERROR', message: 'password es obligatorio', timestamp: new Date().toISOString() },
      });
      return;
    }
    const result = await this.deps.disableTotp.execute({
      usuarioId: userId as never,
      password: req.body.password,
      ...(typeof req.body.code === 'string' && { code: req.body.code }),
    });
    if (result.isFailure) {
      this.sendDomainError(res, result.error);
      return;
    }
    res.status(200).json({
      success: true,
      data: result.value,
      message: 'TOTP desactivado',
      timestamp: new Date().toISOString(),
    });
  }

  /** POST /auth/login/mfa — paso 2 del login (público, challengeId) */
  async loginMfa(req: Request, res: Response): Promise<void> {
    const body = req.body ?? {};
    const hasCode = typeof body.code === 'string';
    const hasBackup = typeof body.backupCode === 'string';
    if (!body.challengeId || typeof body.challengeId !== 'string' || hasCode === hasBackup) {
      res.status(400).json({
        success: false,
        error: { type: 'VALIDATION_ERROR', message: 'challengeId y exactamente uno de code|backupCode son obligatorios', timestamp: new Date().toISOString() },
      });
      return;
    }
    const result = await this.deps.mfaLogin.execute({
      challengeId: body.challengeId,
      ...(hasCode && { code: body.code }),
      ...(hasBackup && { backupCode: body.backupCode }),
    });
    if (result.isFailure) {
      this.sendDomainError(res, result.error);
      return;
    }
    const { user, tokens, mfaInfo } = result.value;
    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          nombre: user.nombre,
          apellidos: user.apellidos,
          nombreCompleto: user.nombreCompleto,
          rol: user.rol,
          activo: user.activo,
          emailVerificado: user.emailVerificado,
        },
        tokens,
        mfaInfo,
      },
      message: 'Autenticación MFA exitosa',
      timestamp: new Date().toISOString(),
    });
  }

  private sendUnauthorized(res: Response): void {
    res.status(401).json({
      success: false,
      error: { type: 'UNAUTHORIZED', message: 'No autenticado', timestamp: new Date().toISOString() },
    });
  }

  /** Mapea errores de dominio → HTTP con el sobre real del backend */
  private sendDomainError(res: Response, error: unknown): void {
    if (error instanceof MfaError) {
      res.status(error.httpStatus).json({
        success: false,
        error: {
          type: 'MFA_ERROR',
          code: error.errorCode,
          message: error.message,
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }
    if (error instanceof UnauthorizedError) {
      res.status(401).json({
        success: false,
        error: { type: 'UNAUTHORIZED', message: 'Credenciales inválidas', timestamp: new Date().toISOString() },
      });
      return;
    }
    if (error instanceof NotFoundError) {
      res.status(404).json({
        success: false,
        error: { type: 'NOT_FOUND', message: error.message, timestamp: new Date().toISOString() },
      });
      return;
    }
    if (error instanceof ValidationError) {
      res.status(400).json({
        success: false,
        error: { type: 'VALIDATION_ERROR', message: error.message, timestamp: new Date().toISOString() },
      });
      return;
    }
    res.status(500).json({
      success: false,
      error: { type: 'INTERNAL_SERVER_ERROR', message: 'Error interno del servidor', timestamp: new Date().toISOString() },
    });
  }
}
