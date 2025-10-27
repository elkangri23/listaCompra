/**
 * Caso de uso: CU-14 - Eliminar categoría
 * Permite eliminar una categoría si no tiene productos asociados
 */

import type { Result } from '@shared/result';
import { success, failure } from '@shared/result';
import { InvalidValueError, BusinessRuleViolationError } from '@domain/errors/DomainError';
import type { ICategoriaRepository } from '@application/ports/repositories/ICategoriaRepository';
import type { IProductoRepository } from '@application/ports/repositories/IProductoRepository';
import type { DeleteCategoryDto } from '@application/dto/categories';

export class DeleteCategory {
  constructor(
    private readonly categoriaRepository: ICategoriaRepository,
    private readonly productoRepository: IProductoRepository
  ) {}

  async execute(dto: DeleteCategoryDto): Promise<Result<boolean, InvalidValueError | BusinessRuleViolationError>> {
    // Buscar la categoría
    const categoriaResult = await this.categoriaRepository.findById(dto.id);
    if (categoriaResult.isFailure) {
      return failure(categoriaResult.error);
    }

    const categoria = categoriaResult.value;
    if (!categoria) {
      return failure(new InvalidValueError(
        'La categoría especificada no existe',
        'id',
        dto.id
      ));
    }

    // Verificar si la categoría tiene productos asociados
    const productosResult = await this.productoRepository.findByCategory(dto.id);
    if (productosResult.isFailure) {
      return failure(new InvalidValueError(
        'Error al verificar productos asociados a la categoría',
        'categoriaId',
        dto.id
      ));
    }

    const productos = productosResult.value;
    if (productos.length > 0) {
      return failure(new BusinessRuleViolationError(
        `No se puede eliminar la categoría "${categoria.nombre}" porque tiene ${productos.length} producto(s) asociado(s)`,
        'CATEGORIA_CON_PRODUCTOS'
      ));
    }

    // Eliminar la categoría
    const deleteResult = await this.categoriaRepository.delete(dto.id);
    if (deleteResult.isFailure) {
      return failure(deleteResult.error);
    }

    return success(deleteResult.value);
  }
}