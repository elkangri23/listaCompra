/**
 * Caso de uso: Cancelar Invitación (CU-18)
 * Permite a un administrador cancelar una invitación activa
 */

import type { Result } from '@shared/result';
import { success, failure } from '@shared/result';
import { NotFoundError, UnauthorizedError, ValidationError } from '@application/errors';
import type { IListaRepository } from '@application/ports/repositories/IListaRepository';
import type { IUsuarioRepository } from '@application/ports/repositories/IUsuarioRepository';
import type { IInvitacionRepository } from '@application/ports/repositories/IInvitacionRepository';
import type { IPermisoRepository } from '@application/ports/repositories/IPermisoRepository';
import { Permiso } from '@domain/entities/Permiso';

export interface CancelInvitationDto {
  invitacionId: string;
  adminUsuarioId: string; // Usuario que cancela la invitación
}

export interface CancelInvitationResponseDto {
  mensaje: string;
  invitacionId: string;
  canceladaEn: Date;
}

export class CancelInvitation {
  constructor(
    private readonly listaRepository: IListaRepository,
    private readonly usuarioRepository: IUsuarioRepository,
    private readonly invitacionRepository: IInvitacionRepository,
    private readonly permisoRepository: IPermisoRepository
  ) {}

  async execute(dto: CancelInvitationDto): Promise<Result<CancelInvitationResponseDto, ValidationError | NotFoundError | UnauthorizedError>> {
    // 1. Validar entrada
    const validationResult = this.validateInput(dto);
    if (validationResult.isFailure) {
      return validationResult;
    }

    // 2. Verificar que la invitación existe
    const invitacion = await this.invitacionRepository.findById(dto.invitacionId);
    if (!invitacion) {
      return failure(new NotFoundError('Invitación', dto.invitacionId));
    }

    // 3. Verificar que la invitación está activa
    if (!invitacion.activa) {
      return failure(new ValidationError(
        'La invitación ya está desactivada',
        'invitacion',
        'inactiva'
      ));
    }

    // 4. Verificar que la lista existe
    const listaResult = await this.listaRepository.findById(invitacion.listaId);
    if (listaResult.isFailure || !listaResult.value) {
      return failure(new NotFoundError('Lista', invitacion.listaId));
    }
    const lista = listaResult.value;

    // 5. Verificar que el usuario administrador existe
    const adminResult = await this.usuarioRepository.findById(dto.adminUsuarioId);
    if (adminResult.isFailure || !adminResult.value) {
      return failure(new NotFoundError('Usuario administrador', dto.adminUsuarioId));
    }

    // 6. Verificar permisos del administrador
    const hasPermissionResult = await this.verifyAdminPermissions(lista, dto.adminUsuarioId);
    if (hasPermissionResult.isFailure) {
      return hasPermissionResult;
    }

    // 7. Desactivar la invitación
    const invitacionDesactivadaResult = invitacion.desactivar();
    if (invitacionDesactivadaResult.isFailure) {
      return failure(new ValidationError(
        'Error al desactivar invitación',
        'invitacion',
        invitacionDesactivadaResult.error.message
      ));
    }

    // 8. Guardar cambios
    await this.invitacionRepository.update(invitacionDesactivadaResult.value);

    // 9. Crear respuesta
    return success({
      mensaje: 'Invitación cancelada exitosamente',
      invitacionId: dto.invitacionId,
      canceladaEn: new Date()
    });
  }

  private validateInput(dto: CancelInvitationDto): Result<void, ValidationError> {
    if (!dto.invitacionId || dto.invitacionId.trim().length === 0) {
      return failure(new ValidationError(
        'ID de invitación es requerido',
        'invitacionId',
        dto.invitacionId
      ));
    }

    if (!dto.adminUsuarioId || dto.adminUsuarioId.trim().length === 0) {
      return failure(new ValidationError(
        'ID de usuario administrador es requerido',
        'adminUsuarioId',
        dto.adminUsuarioId
      ));
    }

    return success(undefined);
  }

  private async verifyAdminPermissions(lista: any, adminUsuarioId: string): Promise<Result<void, UnauthorizedError>> {
    // Verificar si es el propietario de la lista
    if (lista.propietarioId === adminUsuarioId) {
      return success(undefined);
    }

    // Verificar si tiene permisos de administrador sobre la lista
    const permisos = await this.permisoRepository.findByUsuarioAndLista(adminUsuarioId, lista.id);
    const hasAdminPermission = permisos.some((permiso: Permiso) => permiso.puedeAdministrar());

    if (!hasAdminPermission) {
      return failure(new UnauthorizedError(
        'No tienes permisos de administrador para cancelar esta invitación'
      ));
    }

    return success(undefined);
  }
}