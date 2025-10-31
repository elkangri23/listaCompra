/**
 * Caso de uso: Finalizar Impersonación (CU-25)
 * Permite terminar una sesión de impersonación activa
 * Versión simplificada para funcionalidad básica
 */

import type { Result } from '@shared/result';
import { success, failure } from '@shared/result';
import type { UUID } from '@shared/types';
import { Usuario } from '@domain/entities/Usuario';
import { IUsuarioRepository } from '@application/ports/repositories/IUsuarioRepository';
import { ITokenService, TokenPayload } from '@application/ports/auth/ITokenService';
import { Logger } from '@infrastructure/observability/logger/Logger';
import { ValidationError } from '@application/errors/ValidationError';
import { UnauthorizedError } from '@application/errors/UnauthorizedError';
import { NotFoundError } from '@application/errors/NotFoundError';
import {
  EndImpersonationDto,
  EndImpersonationResponseDto
} from '@application/dto/admin/EndImpersonationDto';

const logger = new Logger('EndImpersonation');

export class EndImpersonation {
  constructor(
    private readonly usuarioRepository: IUsuarioRepository,
    private readonly tokenService: ITokenService
  ) {}

  async execute(
    impersonationToken: string,
    dto: EndImpersonationDto,
    ipAddress: string = '127.0.0.1',
    userAgent: string = 'Unknown'
  ): Promise<Result<EndImpersonationResponseDto, ValidationError | UnauthorizedError | NotFoundError>> {
    try {
      // 1. Validar y decodificar token de impersonación
      const tokenValidation = await this.tokenService.verifyAccessToken(impersonationToken);
      if (!tokenValidation.isSuccess) {
        return failure(new UnauthorizedError('Token de impersonación inválido'));
      }

      const tokenPayload = tokenValidation.value;

      // 2. Verificar que es un token de impersonación válido
      if (!tokenPayload.userId) {
        return failure(new UnauthorizedError('Token no válido para impersonación'));
      }

      // 3. Buscar usuario administrador si está disponible en el payload
      let adminUser: Usuario | null = null;
      let sessionId = 'unknown-session';
      let startedAt = new Date();

      if ('adminId' in tokenPayload) {
        const adminResult = await this.usuarioRepository.findById(tokenPayload.adminId as UUID);
        if (adminResult.isSuccess && adminResult.value) {
          adminUser = adminResult.value;
        }
      }

      if ('sessionId' in tokenPayload) {
        sessionId = tokenPayload.sessionId as string;
      }

      if ('iat' in tokenPayload && typeof tokenPayload.iat === 'number') {
        startedAt = new Date(tokenPayload.iat * 1000);
      }

      // 4. Buscar usuario impersonado
      const targetUserResult = await this.usuarioRepository.findById(tokenPayload.userId);
      if (!targetUserResult.isSuccess || !targetUserResult.value) {
        return failure(new NotFoundError('Usuario impersonado', tokenPayload.userId));
      }

      const targetUser = targetUserResult.value;

      // 5. Calcular duración de la sesión
      const endedAt = new Date();
      const durationMs = endedAt.getTime() - startedAt.getTime();
      const durationMinutes = Math.floor(durationMs / (1000 * 60));
      const durationFormatted = this.formatDuration(durationMinutes);

      // 6. Generar nuevo token para el administrador si está disponible
      let newAdminToken = '';
      if (adminUser) {
        const adminTokenPayload: TokenPayload = {
          userId: adminUser.id,
          email: adminUser.email.toString(),
          role: adminUser.rol
        };

        const newTokenResult = await this.tokenService.generateAccessToken(adminTokenPayload);
        if (newTokenResult.isSuccess) {
          newAdminToken = newTokenResult.value;
        }
      }

      // 7. Log de auditoría
      logger.info('Impersonación terminada', {
        adminId: adminUser?.id || 'unknown',
        adminEmail: adminUser?.email.toString() || 'unknown',
        targetUserId: targetUser.id,
        targetUserEmail: targetUser.email.toString(),
        reason: dto.reason || 'Sin razón especificada',
        ipAddress,
        userAgent,
        duration: durationFormatted
      });

      // 8. Construir respuesta según el DTO
      const response: EndImpersonationResponseDto = {
        success: true,
        message: `Impersonación finalizada exitosamente. Duración: ${durationFormatted}`,
        terminatedSession: {
          sessionId: sessionId as UUID,
          adminId: adminUser?.id || 'unknown' as UUID,
          targetUserId: targetUser.id,
          startedAt,
          endedAt,
          duration: durationFormatted
        },
        adminToken: newAdminToken
      };

      return success(response);

    } catch (error) {
      logger.error('Error inesperado al finalizar impersonación', {
        error: error instanceof Error ? error.message : String(error)
      });
      return failure(new ValidationError('Error interno del sistema', 'system', 'unexpected_error'));
    }
  }

  /**
   * Formatea la duración en minutos a un string legible
   */
  private formatDuration(totalMinutes: number): string {
    if (totalMinutes < 60) {
      return `${totalMinutes}m`;
    }

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (minutes === 0) {
      return `${hours}h`;
    }

    return `${hours}h ${minutes}m`;
  }
}