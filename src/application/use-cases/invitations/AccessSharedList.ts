/**
 * Caso de uso: Acceder a Lista Compartida (CU-16)
 * Permite a un usuario acceder a una lista compartida mediante un enlace de invitación
 */

import type { Result } from '@shared/result';
import { success, failure } from '@shared/result';
import { NotFoundError, UnauthorizedError, ValidationError } from '@application/errors';
import type { IListaRepository } from '@application/ports/repositories/IListaRepository';
import type { IUsuarioRepository } from '@application/ports/repositories/IUsuarioRepository';
import type { IInvitacionRepository } from '@application/ports/repositories/IInvitacionRepository';
import type { IPermisoRepository } from '@application/ports/repositories/IPermisoRepository';
import { Lista } from '@domain/entities/Lista';
import { Usuario } from '@domain/entities/Usuario';
import { Invitacion } from '@domain/entities/Invitacion';
import { Permiso } from '@domain/entities/Permiso';
import { Hash } from '@domain/value-objects/Hash';

export interface AccessSharedListDto {
  hash: string;
  usuarioId: string;
}

export interface AccessSharedListResponseDto {
  lista: {
    id: string;
    nombre: string;
    descripcion?: string | null;
    propietarioId: string;
    propietarioNombre: string;
  };
  permiso: {
    id: string;
    tipoPermiso: string;
    creadoEn: Date;
  };
  invitacion: {
    id: string;
    expiraEn: Date;
    creadaEn: Date;
  };
}

export class AccessSharedList {
  constructor(
    private readonly listaRepository: IListaRepository,
    private readonly usuarioRepository: IUsuarioRepository,
    private readonly invitacionRepository: IInvitacionRepository,
    private readonly permisoRepository: IPermisoRepository
  ) {}

  async execute(dto: AccessSharedListDto): Promise<Result<AccessSharedListResponseDto, ValidationError | NotFoundError | UnauthorizedError>> {
    // 1. Validar entrada
    const validationResult = this.validateInput(dto);
    if (validationResult.isFailure) {
      return validationResult;
    }

    // 2. Buscar invitación por hash
    const hashResult = Hash.create(dto.hash);
    if (hashResult.isFailure) {
      return failure(new ValidationError(
        'Hash de invitación inválido',
        'hash',
        dto.hash
      ));
    }

    const invitacion = await this.invitacionRepository.findByHash(dto.hash);
    if (!invitacion) {
      return failure(new NotFoundError('Invitación', dto.hash));
    }

    // 3. Verificar que la invitación es válida
    if (!invitacion.esValida()) {
      if (invitacion.haExpirado()) {
        return failure(new UnauthorizedError('La invitación ha expirado'));
      }
      return failure(new UnauthorizedError('La invitación no está activa'));
    }

    // 4. Verificar que el usuario existe
    const usuarioResult = await this.usuarioRepository.findById(dto.usuarioId);
    if (usuarioResult.isFailure || !usuarioResult.value) {
      return failure(new NotFoundError('Usuario', dto.usuarioId));
    }
    const usuario = usuarioResult.value;

    // 5. Obtener la lista
    const listaResult = await this.listaRepository.findById(invitacion.listaId);
    if (listaResult.isFailure || !listaResult.value) {
      return failure(new NotFoundError('Lista', invitacion.listaId));
    }
    const lista = listaResult.value;

    // 6. Obtener información del propietario
    const propietarioResult = await this.usuarioRepository.findById(lista.propietarioId);
    if (propietarioResult.isFailure || !propietarioResult.value) {
      return failure(new NotFoundError('Propietario', lista.propietarioId));
    }
    const propietario = propietarioResult.value;

    // 7. Verificar si el usuario ya tiene permisos
    let permiso = await this.permisoRepository.findUniqueByUsuarioAndLista(
      dto.usuarioId,
      invitacion.listaId
    );

    // 8. Si no tiene permisos, crear uno nuevo
    if (!permiso) {
      const permisoResult = Permiso.create(
        `perm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        dto.usuarioId,
        invitacion.listaId,
        invitacion.tipoPermiso,
        new Date()
      );

      if (permisoResult.isFailure) {
        return failure(new ValidationError(
          'Error al crear permiso',
          'permiso',
          permisoResult.error.message
        ));
      }

      permiso = permisoResult.value;
      await this.permisoRepository.save(permiso);
    } else {
      // 9. Si ya tiene permisos, verificar si necesita actualizar el tipo
      if (!permiso.tipoPermiso.equals(invitacion.tipoPermiso)) {
        // Solo elevar permisos, no reducir
        if (this.shouldUpgradePermission(permiso.tipoPermiso.value, invitacion.tipoPermiso.value)) {
          const upgradeResult = permiso.cambiarTipoPermiso(invitacion.tipoPermiso);
          if (upgradeResult.isSuccess) {
            permiso = upgradeResult.value;
            await this.permisoRepository.update(permiso);
          }
        }
      }
    }

    // 10. Crear respuesta
    return success({
      lista: {
        id: lista.id,
        nombre: lista.nombre,
        descripcion: lista.descripcion,
        propietarioId: lista.propietarioId,
        propietarioNombre: propietario.nombre
      },
      permiso: {
        id: permiso.id,
        tipoPermiso: permiso.tipoPermiso.value,
        creadoEn: permiso.creadoEn
      },
      invitacion: {
        id: invitacion.id,
        expiraEn: invitacion.expiraEn,
        creadaEn: invitacion.creadaEn
      }
    });
  }

  private validateInput(dto: AccessSharedListDto): Result<void, ValidationError> {
    if (!dto.hash || dto.hash.trim().length === 0) {
      return failure(new ValidationError(
        'Hash de invitación es requerido',
        'hash',
        dto.hash
      ));
    }

    if (!dto.usuarioId || dto.usuarioId.trim().length === 0) {
      return failure(new ValidationError(
        'ID de usuario es requerido',
        'usuarioId',
        dto.usuarioId
      ));
    }

    return success(undefined);
  }

  private shouldUpgradePermission(currentType: string, newType: string): boolean {
    const hierarchy: Record<string, number> = {
      'LECTURA': 1,
      'ESCRITURA': 2,
      'ADMIN': 3
    };

    const currentLevel = hierarchy[currentType] || 0;
    const newLevel = hierarchy[newType] || 0;

    return newLevel > currentLevel;
  }
}