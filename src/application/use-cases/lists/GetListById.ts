/**
 * Caso de uso: Obtener una lista por ID
 * Valida que el usuario tenga acceso y retorna los datos normalizados
 */

import type { Result } from '@shared/result';
import { success, failure } from '@shared/result';
import type { IListaRepository } from '@application/ports/repositories/IListaRepository';
import type { IPermisoRepository } from '@application/ports/repositories/IPermisoRepository';
import type { GetListByIdDto } from '@application/dto/lists/GetListByIdDto';
import type { GetUserListsResponseDto } from '@application/dto/lists/GetUserListsDto';
import { ValidationError } from '@application/errors/ValidationError';
import { NotFoundError } from '@application/errors/NotFoundError';
import { UnauthorizedError } from '@application/errors/UnauthorizedError';

export class GetListById {
  constructor(
    private readonly listaRepository: IListaRepository,
    private readonly permisoRepository?: IPermisoRepository
  ) {}

  async execute(
    dto: GetListByIdDto,
    usuarioId: string
  ): Promise<Result<GetUserListsResponseDto, ValidationError | NotFoundError | UnauthorizedError | Error>> {
    if (!dto.id || dto.id.trim().length === 0) {
      return failure(ValidationError.create(
        'El ID de la lista es requerido',
        'id',
        dto.id
      ));
    }

    if (!usuarioId || usuarioId.trim().length === 0) {
      return failure(ValidationError.create(
        'El ID del usuario es requerido',
        'usuarioId',
        usuarioId
      ));
    }

    const listaResult = await this.listaRepository.findById(dto.id);
    if (listaResult.isFailure) {
      return failure(listaResult.error);
    }

    const lista = listaResult.value;
    if (!lista) {
      return failure(new NotFoundError('Lista', dto.id));
    }

    let tieneAcceso = lista.esPropietario(usuarioId);

    if (!tieneAcceso && this.permisoRepository) {
      try {
        tieneAcceso = await this.permisoRepository.hasPermission(usuarioId, lista.id);
      } catch (error) {
        return failure(new UnauthorizedError('No tienes permisos para acceder a esta lista'));
      }
    }

    if (!tieneAcceso) {
      return failure(new UnauthorizedError('No tienes permisos para acceder a esta lista'));
    }

    const response: GetUserListsResponseDto = {
      id: lista.id,
      nombre: lista.nombre,
      ...(lista.descripcion && { descripcion: lista.descripcion }),
      propietarioId: lista.propietarioId,
      ...(lista.tiendaId && { tiendaId: lista.tiendaId }),
      activa: lista.activa,
      fechaCreacion: lista.fechaCreacion.toISOString(),
      fechaActualizacion: lista.fechaActualizacion.toISOString(),
    };

    return success(response);
  }
}
