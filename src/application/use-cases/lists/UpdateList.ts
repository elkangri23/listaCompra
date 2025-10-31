/**
 * Caso de uso: Actualizar lista
 * Permite modificar los datos de una lista existente
 */

import type { Result } from '@shared/result';
import { success, failure } from '@shared/result';
import type { IListaRepository } from '@application/ports/repositories/IListaRepository';
import type { UpdateListDto, UpdateListResponseDto } from '@application/dto/lists/UpdateListDto';
import { ValidationError } from '@application/errors/ValidationError';
import { NotFoundError } from '@application/errors/NotFoundError';
import { UnauthorizedError } from '@application/errors/UnauthorizedError';

export class UpdateList {
  constructor(
    private readonly listaRepository: IListaRepository
  ) {}

  async execute(
    listaId: string, 
    dto: UpdateListDto, 
    propietarioId: string
  ): Promise<Result<UpdateListResponseDto, ValidationError | NotFoundError | UnauthorizedError | Error>> {
    // 1. Validar entrada básica
    if (!listaId || listaId.trim().length === 0) {
      return failure(ValidationError.create(
        'El ID de la lista es requerido',
        'listaId',
        listaId
      ));
    }

    if (!propietarioId || propietarioId.trim().length === 0) {
      return failure(ValidationError.create(
        'El ID del propietario es requerido',
        'propietarioId',
        propietarioId
      ));
    }

    // Verificar que al menos un campo se va a actualizar
    if (!dto.nombre && !dto.descripcion && !dto.tiendaId) {
      return failure(ValidationError.create(
        'Debe especificar al menos un campo para actualizar',
        'dto',
        dto
      ));
    }

    // 2. Buscar la lista y verificar propiedad
    const listaResult = await this.listaRepository.findByIdAndOwner(listaId, propietarioId);
    if (listaResult.isFailure) {
      return failure(listaResult.error);
    }

    const lista = listaResult.value;
    if (!lista) {
      return failure(new NotFoundError(
        'Lista',
        listaId
      ));
    }

    // 3. Verificar que el usuario es el propietario
    if (!lista.esPropietario(propietarioId)) {
      return failure(new UnauthorizedError(
        'No tienes permisos para modificar esta lista'
      ));
    }

    // 4. Actualizar campos según sea necesario
    if (dto.nombre) {
      // Verificar que no exista otra lista con el mismo nombre (si está cambiando el nombre)
      if (dto.nombre.trim() !== lista.nombre) {
        const existsResult = await this.listaRepository.existsByNameAndOwner(dto.nombre.trim(), propietarioId);
        if (existsResult.isFailure) {
          return failure(existsResult.error);
        }

        if (existsResult.value) {
          return failure(ValidationError.create(
            'Ya existe una lista con ese nombre',
            'nombre',
            dto.nombre
          ));
        }
      }

      const nombreResult = lista.actualizarNombre(dto.nombre);
      if (nombreResult.isFailure) {
        return failure(ValidationError.create(
          nombreResult.error.message,
          'nombre',
          dto.nombre
        ));
      }
    }

    if (dto.descripcion !== undefined) {
      const descripcionResult = lista.actualizarDescripcion(dto.descripcion);
      if (descripcionResult.isFailure) {
        return failure(ValidationError.create(
          descripcionResult.error.message,
          'descripcion',
          dto.descripcion
        ));
      }
    }

    if (dto.tiendaId !== undefined) {
      const tiendaResult = lista.actualizarTienda(dto.tiendaId);
      if (tiendaResult.isFailure) {
        return failure(ValidationError.create(
          tiendaResult.error.message,
          'tiendaId',
          dto.tiendaId
        ));
      }
    }

    // 5. Guardar la lista actualizada
    const saveResult = await this.listaRepository.save(lista);
    if (saveResult.isFailure) {
      return failure(saveResult.error);
    }

    const listaActualizada = saveResult.value;

    // 6. Retornar respuesta
    const response: UpdateListResponseDto = {
      id: listaActualizada.id,
      nombre: listaActualizada.nombre,
      ...(listaActualizada.descripcion && { descripcion: listaActualizada.descripcion }),
      propietarioId: listaActualizada.propietarioId,
      ...(listaActualizada.tiendaId && { tiendaId: listaActualizada.tiendaId }),
      activa: listaActualizada.activa,
      fechaCreacion: listaActualizada.fechaCreacion.toISOString(),
      fechaActualizacion: listaActualizada.fechaActualizacion.toISOString(),
    };

    return success(response);
  }
}