/**
 * Caso de uso: Gestionar Permisos (CU-17)
 * Permite a un administrador de lista cambiar permisos de usuarios o eliminar acceso
 */

import type { Result } from '@shared/result';
import { success, failure } from '@shared/result';
import { NotFoundError, UnauthorizedError, ValidationError } from '@application/errors';
import type { IListaRepository } from '@application/ports/repositories/IListaRepository';
import type { IUsuarioRepository } from '@application/ports/repositories/IUsuarioRepository';
import type { IPermisoRepository } from '@application/ports/repositories/IPermisoRepository';
import { Permiso } from '@domain/entities/Permiso';
import { PermissionType } from '@domain/value-objects/PermissionType';

export interface ManagePermissionsDto {
  listaId: string;
  adminUsuarioId: string; // Usuario que realiza la gestión
  targetUsuarioId: string; // Usuario objetivo de la gestión
  accion: 'cambiar' | 'eliminar';
  nuevoTipoPermiso?: string; // Requerido solo para acción 'cambiar'
}

export interface ManagePermissionsResponseDto {
  mensaje: string;
  permiso?: {
    id: string;
    usuarioId: string;
    listaId: string;
    tipoPermiso: string;
    creadoEn: Date;
  };
}

export class ManagePermissions {
  constructor(
    private readonly listaRepository: IListaRepository,
    private readonly usuarioRepository: IUsuarioRepository,
    private readonly permisoRepository: IPermisoRepository
  ) {}

  async execute(dto: ManagePermissionsDto): Promise<Result<ManagePermissionsResponseDto, ValidationError | NotFoundError | UnauthorizedError>> {
    // 1. Validar entrada
    const validationResult = this.validateInput(dto);
    if (validationResult.isFailure) {
      return validationResult;
    }

    // 2. Verificar que la lista existe
    const listaResult = await this.listaRepository.findById(dto.listaId);
    if (listaResult.isFailure || !listaResult.value) {
      return failure(new NotFoundError('Lista', dto.listaId));
    }
    const lista = listaResult.value;

    // 3. Verificar que el usuario administrador existe
    const adminResult = await this.usuarioRepository.findById(dto.adminUsuarioId);
    if (adminResult.isFailure || !adminResult.value) {
      return failure(new NotFoundError('Usuario administrador', dto.adminUsuarioId));
    }

    // 4. Verificar que el usuario objetivo existe
    const targetResult = await this.usuarioRepository.findById(dto.targetUsuarioId);
    if (targetResult.isFailure || !targetResult.value) {
      return failure(new NotFoundError('Usuario objetivo', dto.targetUsuarioId));
    }

    // 5. Verificar permisos del administrador
    const hasPermissionResult = await this.verifyAdminPermissions(lista, dto.adminUsuarioId);
    if (hasPermissionResult.isFailure) {
      return hasPermissionResult;
    }

    // 6. Verificar que el usuario objetivo no es el propietario
    if (lista.propietarioId === dto.targetUsuarioId) {
      return failure(new UnauthorizedError(
        'No se pueden modificar los permisos del propietario de la lista'
      ));
    }

    // 7. Obtener permiso actual del usuario objetivo
    const permisoActual = await this.permisoRepository.findUniqueByUsuarioAndLista(
      dto.targetUsuarioId,
      dto.listaId
    );

    if (!permisoActual) {
      return failure(new NotFoundError(
        'Permiso',
        `${dto.targetUsuarioId}-${dto.listaId}`
      ));
    }

    // 8. Ejecutar acción solicitada
    switch (dto.accion) {
      case 'cambiar':
        return await this.cambiarPermiso(permisoActual, dto.nuevoTipoPermiso!);
      case 'eliminar':
        return await this.eliminarPermiso(permisoActual);
      default:
        return failure(new ValidationError(
          'Acción no válida',
          'accion',
          dto.accion
        ));
    }
  }

  private validateInput(dto: ManagePermissionsDto): Result<void, ValidationError> {
    if (!dto.listaId || dto.listaId.trim().length === 0) {
      return failure(new ValidationError(
        'ID de lista es requerido',
        'listaId',
        dto.listaId
      ));
    }

    if (!dto.adminUsuarioId || dto.adminUsuarioId.trim().length === 0) {
      return failure(new ValidationError(
        'ID de usuario administrador es requerido',
        'adminUsuarioId',
        dto.adminUsuarioId
      ));
    }

    if (!dto.targetUsuarioId || dto.targetUsuarioId.trim().length === 0) {
      return failure(new ValidationError(
        'ID de usuario objetivo es requerido',
        'targetUsuarioId',
        dto.targetUsuarioId
      ));
    }

    if (!dto.accion || !['cambiar', 'eliminar'].includes(dto.accion)) {
      return failure(new ValidationError(
        'Acción debe ser "cambiar" o "eliminar"',
        'accion',
        dto.accion
      ));
    }

    if (dto.accion === 'cambiar') {
      if (!dto.nuevoTipoPermiso || dto.nuevoTipoPermiso.trim().length === 0) {
        return failure(new ValidationError(
          'Nuevo tipo de permiso es requerido para la acción "cambiar"',
          'nuevoTipoPermiso',
          dto.nuevoTipoPermiso
        ));
      }
    }

    // Verificar que no está intentando gestionar sus propios permisos
    if (dto.adminUsuarioId === dto.targetUsuarioId) {
      return failure(new ValidationError(
        'No puedes gestionar tus propios permisos',
        'targetUsuarioId',
        dto.targetUsuarioId
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
        'No tienes permisos de administrador para gestionar esta lista'
      ));
    }

    return success(undefined);
  }

  private async cambiarPermiso(
    permisoActual: Permiso,
    nuevoTipoPermiso: string
  ): Promise<Result<ManagePermissionsResponseDto, ValidationError>> {
    // Validar nuevo tipo de permiso
    const tipoPermisoResult = PermissionType.create(nuevoTipoPermiso);
    if (tipoPermisoResult.isFailure) {
      return failure(new ValidationError(
        'Tipo de permiso inválido',
        'nuevoTipoPermiso',
        nuevoTipoPermiso
      ));
    }

    // Cambiar permiso
    const permisoActualizadoResult = permisoActual.cambiarTipoPermiso(tipoPermisoResult.value);
    if (permisoActualizadoResult.isFailure) {
      return failure(new ValidationError(
        'Error al cambiar permiso',
        'permiso',
        permisoActualizadoResult.error.message
      ));
    }

    // Guardar cambios
    await this.permisoRepository.update(permisoActualizadoResult.value);

    return success({
      mensaje: `Permiso cambiado exitosamente a ${nuevoTipoPermiso}`,
      permiso: {
        id: permisoActualizadoResult.value.id,
        usuarioId: permisoActualizadoResult.value.usuarioId,
        listaId: permisoActualizadoResult.value.listaId,
        tipoPermiso: permisoActualizadoResult.value.tipoPermiso.value,
        creadoEn: permisoActualizadoResult.value.creadoEn
      }
    });
  }

  private async eliminarPermiso(permiso: Permiso): Promise<Result<ManagePermissionsResponseDto, ValidationError>> {
    try {
      await this.permisoRepository.delete(permiso.id);

      return success({
        mensaje: 'Permiso eliminado exitosamente'
      });
    } catch (error) {
      return failure(new ValidationError(
        'Error al eliminar permiso',
        'permiso',
        error instanceof Error ? error.message : 'Unknown error'
      ));
    }
  }
}