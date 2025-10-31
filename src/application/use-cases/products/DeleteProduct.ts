/**
 * Caso de uso: Eliminar producto
 * Permite eliminar un producto de la lista
 */

import type { Result } from '@shared/result';
import { success, failure } from '@shared/result';
import type { IProductoRepository } from '@application/ports/repositories/IProductoRepository';
import type { DeleteProductDto, DeleteProductResponseDto } from '@application/dto/products/DeleteProductDto';
import { ValidationError } from '@application/errors/ValidationError';
import { NotFoundError } from '@application/errors/NotFoundError';
import { UnauthorizedError } from '@application/errors/UnauthorizedError';

export class DeleteProduct {
  constructor(
    private readonly productoRepository: IProductoRepository
  ) {}

  async execute(
    productoId: string,
    dto: DeleteProductDto,
    usuarioId: string
  ): Promise<Result<DeleteProductResponseDto, ValidationError | NotFoundError | UnauthorizedError | Error>> {
    // 1. Validar entrada básica
    if (!productoId || productoId.trim().length === 0) {
      return failure(ValidationError.create(
        'El ID del producto es requerido',
        'productoId',
        productoId
      ));
    }

    if (!usuarioId || usuarioId.trim().length === 0) {
      return failure(ValidationError.create(
        'El ID del usuario es requerido',
        'usuarioId',
        usuarioId
      ));
    }

    // 2. Buscar el producto
    const productoResult = await this.productoRepository.findById(productoId);
    if (productoResult.isFailure) {
      return failure(productoResult.error);
    }

    const producto = productoResult.value;
    if (!producto) {
      return failure(new NotFoundError(
        'Producto',
        productoId
      ));
    }

    const listaId = producto.listaId;

    // 3. Verificar permisos de eliminación
    if (!producto.puedeModificar(usuarioId)) {
      return failure(new UnauthorizedError(
        'No tienes permisos para eliminar este producto'
      ));
    }

    // 4. Eliminar el producto (siempre hard delete para productos)
    // Los productos no necesitan soft delete, se eliminan directamente
    const deleteResult = await this.productoRepository.deleteById(productoId);
    if (deleteResult.isFailure) {
      return failure(deleteResult.error);
    }

    // 5. Construir respuesta
    const permanente = dto.permanente ?? true; // Por defecto permanente para productos
    const response: DeleteProductResponseDto = {
      id: productoId,
      listaId,
      eliminado: true,
      permanente: permanente,
      fechaEliminacion: new Date().toISOString(),
      mensaje: 'Producto eliminado exitosamente',
    };

    return success(response);
  }
}