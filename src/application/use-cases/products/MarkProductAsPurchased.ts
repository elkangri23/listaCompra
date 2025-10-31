/**
 * Caso de uso: Marcar producto como comprado/no comprado
 * Permite cambiar el estado de compra de un producto
 */

import type { Result } from '@shared/result';
import { success, failure } from '@shared/result';
import type { IProductoRepository } from '@application/ports/repositories/IProductoRepository';
import type { MarkAsPurchasedDto, MarkAsPurchasedResponseDto } from '@application/dto/products/MarkAsPurchasedDto';
import { ValidationError } from '@application/errors/ValidationError';
import { NotFoundError } from '@application/errors/NotFoundError';
import { UnauthorizedError } from '@application/errors/UnauthorizedError';

export class MarkProductAsPurchased {
  constructor(
    private readonly productoRepository: IProductoRepository
  ) {}

  async execute(
    productoId: string,
    dto: MarkAsPurchasedDto,
    usuarioId: string
  ): Promise<Result<MarkAsPurchasedResponseDto, ValidationError | NotFoundError | UnauthorizedError | Error>> {
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

    if (dto.comprado === undefined) {
      return failure(ValidationError.create(
        'El estado de comprado es requerido',
        'comprado',
        dto.comprado
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

    // 3. Verificar permisos de modificación
    if (!producto.puedeModificar(usuarioId)) {
      return failure(new UnauthorizedError(
        'No tienes permisos para modificar este producto'
      ));
    }

    // 4. Verificar si el cambio es necesario
    if (producto.estaComprado() === dto.comprado) {
      const estadoActual = dto.comprado ? 'comprado' : 'no comprado';
      return failure(ValidationError.create(
        `El producto ya está marcado como ${estadoActual}`,
        'comprado',
        dto.comprado
      ));
    }

    // 5. Aplicar el cambio de estado
    if (dto.comprado) {
      producto.marcarComoComprado();
    } else {
      producto.marcarComoNoComprado();
    }

    // 6. Guardar el producto actualizado
    const saveResult = await this.productoRepository.save(producto);
    if (saveResult.isFailure) {
      return failure(saveResult.error);
    }

    const productoActualizado = saveResult.value;

    // 7. Construir respuesta
    const accion = dto.comprado ? 'comprado' : 'no comprado';
    const response: MarkAsPurchasedResponseDto = {
      id: productoActualizado.id,
      listaId,
      nombre: productoActualizado.nombre,
      comprado: productoActualizado.comprado,
      ...(productoActualizado.fechaCompra && { fechaCompra: productoActualizado.fechaCompra.toISOString() }),
      fechaActualizacion: productoActualizado.fechaActualizacion.toISOString(),
      mensaje: `Producto marcado como ${accion} exitosamente`,
    };

    return success(response);
  }
}