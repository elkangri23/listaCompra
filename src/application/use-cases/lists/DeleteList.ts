/**
 * Caso de uso: Eliminar lista
 * Permite eliminar una lista (soft delete por defecto)
 */

import type { Result } from '@shared/result';
import { success, failure } from '@shared/result';
import type { IListaRepository } from '@application/ports/repositories/IListaRepository';
import type { DeleteListDto, DeleteListResponseDto } from '@application/dto/lists/DeleteListDto';
import { ValidationError } from '@application/errors/ValidationError';
import { NotFoundError } from '@application/errors/NotFoundError';
import { UnauthorizedError } from '@application/errors/UnauthorizedError';

export class DeleteList {
  constructor(
    private readonly listaRepository: IListaRepository
  ) {}

  async execute(
    listaId: string, 
    dto: DeleteListDto, 
    propietarioId: string
  ): Promise<Result<DeleteListResponseDto, ValidationError | NotFoundError | UnauthorizedError | Error>> {
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
        'No tienes permisos para eliminar esta lista'
      ));
    }

    // 4. Verificar si ya está eliminada
    if (!lista.activa) {
      return failure(ValidationError.create(
        'La lista ya ha sido eliminada',
        'lista',
        listaId
      ));
    }

    // 5. Eliminar la lista (soft delete o hard delete según configuración)
    const eliminacionPermanente = dto.permanente || false;
    
    let deleteResult: Result<boolean, Error>;
    
    if (eliminacionPermanente) {
      // Hard delete - eliminar completamente de la base de datos
      deleteResult = await this.listaRepository.hardDelete(listaId);
    } else {
      // Soft delete - marcar como inactiva
      lista.desactivar();
      
      const saveResult = await this.listaRepository.save(lista);
      if (saveResult.isFailure) {
        return failure(saveResult.error);
      }
      
      deleteResult = success(true);
    }

    if (deleteResult.isFailure) {
      return failure(deleteResult.error);
    }

    // 6. Retornar respuesta
    const response: DeleteListResponseDto = {
      id: listaId,
      eliminada: true,
      permanente: eliminacionPermanente,
      fechaEliminacion: new Date().toISOString(),
      mensaje: eliminacionPermanente 
        ? 'Lista eliminada permanentemente'
        : 'Lista desactivada correctamente'
    };

    return success(response);
  }
}