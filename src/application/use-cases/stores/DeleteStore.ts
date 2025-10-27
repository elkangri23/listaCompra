/**
 * Caso de uso: CU-26 - Eliminar tienda
 * Permite eliminar una tienda si no tiene categorías asociadas
 */

import type { Result } from '@shared/result';
import { success, failure } from '@shared/result';
import { InvalidValueError, BusinessRuleViolationError } from '@domain/errors/DomainError';
import type { ITiendaRepository } from '@application/ports/repositories/ITiendaRepository';
import type { DeleteStoreDto } from '@application/dto/stores';

export class DeleteStore {
  constructor(
    private readonly tiendaRepository: ITiendaRepository
  ) {}

  async execute(dto: DeleteStoreDto): Promise<Result<boolean, InvalidValueError | BusinessRuleViolationError>> {
    // Buscar la tienda
    const tiendaResult = await this.tiendaRepository.findById(dto.id);
    if (tiendaResult.isFailure) {
      return failure(tiendaResult.error);
    }

    const tienda = tiendaResult.value;
    if (!tienda) {
      return failure(new InvalidValueError(
        'La tienda especificada no existe',
        'id',
        dto.id
      ));
    }

    // Verificar si la tienda tiene categorías asociadas
    const hasCategoriesResult = await this.tiendaRepository.hasCategories(dto.id);
    if (hasCategoriesResult.isFailure) {
      return failure(hasCategoriesResult.error);
    }

    if (hasCategoriesResult.value) {
      // Obtener estadísticas para mostrar información específica
      const statsResult = await this.tiendaRepository.getStats(dto.id);
      let totalCategorias = 'algunas';
      
      if (statsResult.isSuccess) {
        totalCategorias = statsResult.value.totalCategorias.toString();
      }

      return failure(new BusinessRuleViolationError(
        `No se puede eliminar la tienda "${tienda.nombre}" porque tiene ${totalCategorias} categoría(s) asociada(s)`,
        'TIENDA_CON_CATEGORIAS'
      ));
    }

    // Eliminar la tienda
    const deleteResult = await this.tiendaRepository.delete(dto.id);
    if (deleteResult.isFailure) {
      return failure(deleteResult.error);
    }

    return success(deleteResult.value);
  }
}