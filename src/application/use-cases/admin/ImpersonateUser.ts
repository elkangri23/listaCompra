/**
 * Caso de uso: Impersonar Usuario (CU-24)
 * Permite a un administrador actuar como otro usuario del sistema
 * Versión simplificada para funcionalidad básica
 */

import type { Result } from '@shared/result';
import { success, failure } from '@shared/result';
import type { UUID } from '@shared/types';
import { Usuario, RolUsuario } from '@domain/entities/Usuario';
import { Email } from '@domain/value-objects/Email';
import { IUsuarioRepository } from '@application/ports/repositories/IUsuarioRepository';
import { ITokenService, TokenPayload } from '@application/ports/auth/ITokenService';
import { Logger } from '@infrastructure/observability/logger/Logger';
import { ValidationError } from '@application/errors/ValidationError';
import { UnauthorizedError } from '@application/errors/UnauthorizedError';
import { NotFoundError } from '@application/errors/NotFoundError';
import {
  ImpersonateUserDto,
  ImpersonationResponseDto
} from '@application/dto/admin/ImpersonateUserDto';

const logger = new Logger('ImpersonateUser');

export class ImpersonateUser {
  constructor(
    private readonly usuarioRepository: IUsuarioRepository,
    private readonly tokenService: ITokenService
  ) {}

  async execute(
    adminUserId: UUID,
    dto: ImpersonateUserDto,
    ipAddress: string = '127.0.0.1',
    userAgent: string = 'Unknown'
  ): Promise<Result<ImpersonationResponseDto, ValidationError | UnauthorizedError | NotFoundError>> {
    try {
      // 1. Validar entrada básica
      if (!dto.targetUserId && !dto.targetUserEmail) {
        return failure(new ValidationError('Debe especificar targetUserId o targetUserEmail', 'target', 'missing'));
      }

      // 2. Buscar administrador
      const adminResult = await this.usuarioRepository.findById(adminUserId);
      if (!adminResult.isSuccess || !adminResult.value) {
        return failure(new NotFoundError('Administrador', adminUserId));
      }

      const adminUser = adminResult.value;
      if (adminUser.rol !== RolUsuario.ADMIN) {
        logger.warn('Intento de impersonación por usuario no admin', { userId: adminUserId });
        return failure(new UnauthorizedError('Solo administradores pueden impersonar usuarios'));
      }

      // 3. Buscar usuario objetivo
      let targetUser: Usuario;
      if (dto.targetUserId) {
        const result = await this.usuarioRepository.findById(dto.targetUserId);
        if (!result.isSuccess || !result.value) {
          return failure(new NotFoundError('Usuario objetivo', dto.targetUserId));
        }
        targetUser = result.value;
      } else if (dto.targetUserEmail) {
        const emailResult = await Email.create(dto.targetUserEmail);
        if (!emailResult.isSuccess) {
          return failure(new ValidationError('Email inválido', 'targetUserEmail', dto.targetUserEmail));
        }
        
        const result = await this.usuarioRepository.findByEmail(emailResult.value);
        if (!result.isSuccess || !result.value) {
          return failure(new NotFoundError('Usuario objetivo', dto.targetUserEmail));
        }
        targetUser = result.value;
      } else {
        return failure(new ValidationError('Usuario objetivo no especificado', 'target', 'missing'));
      }

      // 4. Validaciones de negocio
      if (targetUser.rol === RolUsuario.ADMIN) {
        return failure(new UnauthorizedError('No se puede impersonar otro administrador'));
      }

      if (adminUser.id === targetUser.id) {
        return failure(new ValidationError('No se puede impersonar a sí mismo', 'targetUserId', targetUser.id));
      }

      // 5. Generar token de impersonación
      const durationMinutes = dto.durationMinutes || 60;
      const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000);

      const tokenPayload: TokenPayload = {
        userId: targetUser.id,
        email: targetUser.email.toString(),
        role: targetUser.rol
      };

      const tokenResult = await this.tokenService.generateAccessToken(tokenPayload);
      if (!tokenResult.isSuccess) {
        logger.error('Error generando token de impersonación', { 
          adminId: adminUserId, 
          targetId: targetUser.id 
        });
        return failure(new ValidationError('Error al generar token', 'token', 'generation_failed'));
      }

      // 6. Log de auditoría
      logger.info('Impersonación iniciada', {
        adminId: adminUser.id,
        adminEmail: adminUser.email.toString(),
        targetUserId: targetUser.id,
        targetUserEmail: targetUser.email.toString(),
        reason: dto.reason || 'Sin razón especificada',
        ipAddress,
        userAgent
      });

      // 7. Construir respuesta
      const response: ImpersonationResponseDto = {
        impersonationToken: tokenResult.value,
        impersonatedUser: {
          id: targetUser.id,
          email: targetUser.email.toString(),
          nombre: targetUser.nombre,
          ...(targetUser.apellidos && { apellidos: targetUser.apellidos })
        },
        adminUser: {
          id: adminUser.id,
          email: adminUser.email.toString(),
          nombre: adminUser.nombre
        },
        expiresAt,
        startedAt: new Date()
      };

      return success(response);

    } catch (error) {
      logger.error('Error inesperado en impersonación', {
        error: error instanceof Error ? error.message : String(error),
        adminUserId
      });
      return failure(new ValidationError('Error interno del sistema', 'system', 'unexpected_error'));
    }
  }
}