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
      // 1. Validaciones de entrada robustas
      if (!adminUserId || typeof adminUserId !== 'string' || adminUserId.trim() === '') {
        logger.security('Intento de impersonación con adminUserId inválido', { adminUserId, ipAddress });
        return failure(new ValidationError('ID de administrador inválido', 'adminUserId', adminUserId));
      }

      if (!dto.targetUserId && !dto.targetUserEmail) {
        return failure(new ValidationError('Debe especificar targetUserId o targetUserEmail', 'target', 'missing'));
      }

      // Validación de duración razonable
      const maxDurationMinutes = 480; // 8 horas máximo
      const minDurationMinutes = 1; // 1 minuto mínimo
      const requestedDuration = dto.durationMinutes || 60;
      
      if (requestedDuration < minDurationMinutes || requestedDuration > maxDurationMinutes) {
        return failure(new ValidationError(
          `Duración debe estar entre ${minDurationMinutes} y ${maxDurationMinutes} minutos`, 
          'durationMinutes', 
          requestedDuration.toString()
        ));
      }

      // 2. Buscar administrador con validaciones reforzadas
      const adminResult = await this.usuarioRepository.findById(adminUserId.trim());
      if (!adminResult.isSuccess || !adminResult.value) {
        logger.security('Intento de impersonación con admin inexistente', { adminUserId, ipAddress });
        return failure(new NotFoundError('Administrador', adminUserId));
      }

      const adminUser = adminResult.value;
      
      // VALIDACIÓN CRÍTICA: Triple verificación de rol admin
      if (adminUser.rol !== RolUsuario.ADMIN) {
        logger.security('CRÍTICO: Intento de impersonación por usuario no admin', { 
          userId: adminUserId,
          userRole: adminUser.rol,
          userEmail: adminUser.email?.toString(),
          ipAddress,
          userAgent
        });
        return failure(new UnauthorizedError('Solo administradores pueden impersonar usuarios'));
      }

      // Verificación adicional: Usuario admin activo
      if (!adminUser.activo) {
        logger.security('Intento de impersonación por administrador inactivo', {
          adminId: adminUserId,
          ipAddress,
          userAgent
        });
        return failure(new UnauthorizedError('Cuenta de administrador inactiva'));
      }

      // Verificación adicional: Email admin verificado
      if (!adminUser.emailVerificado) {
        logger.security('Intento de impersonación por admin con email no verificado', {
          adminId: adminUserId,
          adminEmail: adminUser.email?.toString(),
          ipAddress
        });
        return failure(new UnauthorizedError('Email de administrador no verificado'));
      }

      // 3. Buscar usuario objetivo con validaciones mejoradas
      let targetUser: Usuario;
      if (dto.targetUserId) {
        // Validación de formato de targetUserId
        if (typeof dto.targetUserId !== 'string' || dto.targetUserId.trim() === '') {
          return failure(new ValidationError('targetUserId inválido', 'targetUserId', dto.targetUserId));
        }

        const result = await this.usuarioRepository.findById(dto.targetUserId.trim());
        if (!result.isSuccess || !result.value) {
          logger.security('Intento de impersonar usuario inexistente por ID', {
            adminId: adminUserId,
            targetUserId: dto.targetUserId,
            ipAddress
          });
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
          logger.security('Intento de impersonar usuario inexistente por email', {
            adminId: adminUserId,
            targetUserEmail: dto.targetUserEmail,
            ipAddress
          });
          return failure(new NotFoundError('Usuario objetivo', dto.targetUserEmail));
        }
        targetUser = result.value;
      } else {
        return failure(new ValidationError('Usuario objetivo no especificado', 'target', 'missing'));
      }

      // 4. Validaciones de negocio y seguridad críticas
      if (targetUser.rol === RolUsuario.ADMIN) {
        logger.security('CRÍTICO: Intento de impersonar otro administrador', {
          adminId: adminUserId,
          targetAdminId: targetUser.id,
          ipAddress,
          userAgent
        });
        return failure(new UnauthorizedError('No se puede impersonar otro administrador'));
      }

      if (adminUser.id === targetUser.id) {
        logger.security('Intento de auto-impersonación', {
          adminId: adminUserId,
          ipAddress
        });
        return failure(new ValidationError('No se puede impersonar a sí mismo', 'targetUserId', targetUser.id));
      }

      // Verificación adicional: Usuario objetivo activo
      if (!targetUser.activo) {
        logger.security('Intento de impersonar usuario inactivo', {
          adminId: adminUserId,
          targetUserId: targetUser.id,
          targetUserEmail: targetUser.email?.toString(),
          ipAddress
        });
        return failure(new ValidationError('No se puede impersonar usuario inactivo', 'targetUser', 'inactive'));
      }

      // 5. Verificaciones de frecuencia y límites (Prevención de abuso)
      const now = new Date();
      
      // En un sistema real, aquí verificaríamos las impersonaciones recientes
      // Por ahora solo loggeamos para auditoría
      logger.info('Verificación de límites de impersonación', {
        adminId: adminUserId,
        targetUserId: targetUser.id,
        checkTime: now.toISOString()
      });

      // 6. Generar token de impersonación con validaciones adicionales
      const durationMinutes = requestedDuration; // Ya validado arriba
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
          targetId: targetUser.id,
          error: 'Token generation failed'
        });
        return failure(new ValidationError('Error al generar token', 'token', 'generation_failed'));
      }

      // 7. Log de auditoría de seguridad mejorado
      logger.security('IMPERSONACIÓN INICIADA', {
        action: 'IMPERSONATE_USER_START',
        adminId: adminUser.id,
        adminEmail: adminUser.email.toString(),
        adminName: adminUser.nombre,
        targetUserId: targetUser.id,
        targetUserEmail: targetUser.email.toString(),
        targetUserName: targetUser.nombre,
        reason: dto.reason || 'Sin razón especificada',
        durationMinutes,
        expiresAt: expiresAt.toISOString(),
        ipAddress,
        userAgent,
        timestamp: new Date().toISOString()
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