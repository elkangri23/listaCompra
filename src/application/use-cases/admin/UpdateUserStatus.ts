/**
 * Caso de uso: Activar / desactivar un usuario (panel de administración)
 * Un administrador no puede desactivarse a sí mismo.
 */

import type { Result } from '@shared/result';
import { success, failure } from '@shared/result';
import type { UUID } from '@shared/types';
import { Logger } from '@infrastructure/observability/logger/Logger';
import type { IUsuarioRepository } from '@application/ports/repositories/IUsuarioRepository';
import { ValidationError } from '@application/errors/ValidationError';
import { NotFoundError } from '@application/errors/NotFoundError';
import type { AdminUserSummaryDto } from '@application/dto/admin/AdminUserDto';

const logger = new Logger('UpdateUserStatus');

export class UpdateUserStatus {
  constructor(
    private readonly usuarioRepository: IUsuarioRepository
  ) {}

  async execute(
    adminUserId: UUID,
    userId: UUID,
    activo: boolean
  ): Promise<Result<AdminUserSummaryDto, ValidationError | NotFoundError | Error>> {
    try {
      // Un administrador no puede desactivarse a sí mismo
      if (adminUserId === userId && !activo) {
        logger.security('Intento de auto-desactivación de administrador', {
          adminUserId,
          userId
        });
        return failure(new ValidationError(
          'No puedes desactivar tu propia cuenta de administrador',
          'activo',
          activo
        ));
      }

      const foundResult = await this.usuarioRepository.findById(userId);
      if (foundResult.isFailure) {
        logger.error('Error al buscar usuario para cambio de estado', {
          error: foundResult.error.message,
          userId,
          adminUserId
        });
        return failure(foundResult.error);
      }

      const usuario = foundResult.value;
      if (!usuario) {
        return failure(NotFoundError.user(userId));
      }

      // La entidad aplica la regla de negocio: fallar si ya está en ese estado
      const cambioResult = activo ? usuario.activar() : usuario.desactivar();
      if (cambioResult.isFailure) {
        return failure(new ValidationError(
          cambioResult.error.message,
          'activo',
          activo
        ));
      }

      const updateResult = await this.usuarioRepository.update(usuario);
      if (updateResult.isFailure) {
        logger.error('Error al persistir el cambio de estado del usuario', {
          error: updateResult.error.message,
          userId,
          adminUserId,
          activo
        });
        return failure(updateResult.error);
      }

      logger.info('Estado de usuario actualizado por administrador', {
        adminUserId,
        userId,
        activo
      });

      return success({
        id: usuario.id,
        nombre: usuario.nombreCompleto,
        email: usuario.email.value,
        rol: usuario.rol,
        activo: usuario.activo,
        emailVerificado: usuario.emailVerificado,
        fechaCreacion: usuario.fechaCreacion,
        fechaActualizacion: usuario.fechaActualizacion
      });
    } catch (error) {
      logger.error('Error inesperado al actualizar el estado del usuario', {
        error: error instanceof Error ? error.message : String(error),
        userId,
        adminUserId
      });
      return failure(
        error instanceof Error
          ? error
          : new Error('Error interno al actualizar el estado del usuario')
      );
    }
  }
}
