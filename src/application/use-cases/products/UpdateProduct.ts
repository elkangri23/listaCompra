/**
 * Caso de uso: Actualizar producto
 * Permite modificar los datos de un producto existente
 */

import type { Result } from '@shared/result';
import { success, failure } from '@shared/result';
import type { IProductoRepository } from '@application/ports/repositories/IProductoRepository';
import type { UpdateProductDto, UpdateProductResponseDto } from '@application/dto/products/UpdateProductDto';
import { ValidationError } from '@application/errors/ValidationError';
import { NotFoundError } from '@application/errors/NotFoundError';
import { UnauthorizedError } from '@application/errors/UnauthorizedError';
import type { IOutboxService } from '@application/ports/messaging/IOutboxService';
import { ProductoUpdatedEvent } from '@domain/events/ProductoUpdatedEvent';

export class UpdateProduct {
  constructor(
    private readonly productoRepository: IProductoRepository,
    private readonly outboxService: IOutboxService
  ) {}

  async execute(
    productoId: string,
    dto: UpdateProductDto,
    usuarioId: string
  ): Promise<Result<UpdateProductResponseDto, ValidationError | NotFoundError | UnauthorizedError | Error>> {
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

    // Verificar que al menos un campo se va a actualizar
    if (!dto.nombre && !dto.descripcion && dto.cantidad === undefined && 
        !dto.unidad && dto.precio === undefined && dto.urgente === undefined && 
        !dto.categoriaId) {
      return failure(ValidationError.create(
        'Debe especificar al menos un campo para actualizar',
        'dto',
        dto
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

    // 3. Verificar permisos de modificación
    if (!producto.puedeModificar(usuarioId)) {
      return failure(new UnauthorizedError(
        'No tienes permisos para modificar este producto'
      ));
    }

    const oldValue = { ...producto.toJSON() };
    const changedFields: string[] = [];

    // 4. Aplicar actualizaciones según campos presentes
    if (dto.nombre) {
      const nombreResult = producto.actualizarNombre(dto.nombre);
      if (nombreResult.isFailure) {
        return failure(ValidationError.create(
          nombreResult.error.message,
          'nombre',
          dto.nombre
        ));
      }
      changedFields.push('nombre');
    }

    if (dto.descripcion !== undefined) {
      const descripcionResult = producto.actualizarDescripcion(dto.descripcion);
      if (descripcionResult.isFailure) {
        return failure(ValidationError.create(
          descripcionResult.error.message,
          'descripcion',
          dto.descripcion
        ));
      }
      changedFields.push('descripcion');
    }

    if (dto.cantidad !== undefined) {
      const cantidadResult = producto.actualizarCantidad(dto.cantidad);
      if (cantidadResult.isFailure) {
        return failure(ValidationError.create(
          cantidadResult.error.message,
          'cantidad',
          dto.cantidad
        ));
      }
      changedFields.push('cantidad');
    }

    if (dto.unidad !== undefined) {
      const unidadResult = producto.actualizarUnidad(dto.unidad);
      if (unidadResult.isFailure) {
        return failure(ValidationError.create(
          unidadResult.error.message,
          'unidad',
          dto.unidad
        ));
      }
      changedFields.push('unidad');
    }

    if (dto.precio !== undefined) {
      const precioResult = producto.actualizarPrecio(dto.precio);
      if (precioResult.isFailure) {
        return failure(ValidationError.create(
          precioResult.error.message,
          'precio',
          dto.precio
        ));
      }
      changedFields.push('precio');
    }

    if (dto.urgente !== undefined) {
      if (dto.urgente) {
        producto.marcarComoUrgente();
      } else {
        producto.marcarComoNoUrgente();
      }
      changedFields.push('urgente');
    }

    if (dto.categoriaId !== undefined) {
      const categoriaResult = producto.actualizarCategoria(dto.categoriaId);
      if (categoriaResult.isFailure) {
        return failure(ValidationError.create(
          categoriaResult.error.message,
          'categoriaId',
          dto.categoriaId
        ));
      }
      changedFields.push('categoriaId');
    }

    // 5. Guardar el producto actualizado
    const saveResult = await this.productoRepository.save(producto);
    if (saveResult.isFailure) {
      return failure(saveResult.error);
    }

    const productoActualizado = saveResult.value;

    // 6. Crear y guardar evento de auditoría
    const auditEvent = new ProductoUpdatedEvent({
      productoId: productoActualizado.id,
      listaId: productoActualizado.listaId,
      oldValue,
      newValue: productoActualizado.toJSON(),
      changedByUserId: usuarioId,
      changedFields,
    });
    await this.outboxService.save(auditEvent);

    // 7. Construir respuesta
    const response: UpdateProductResponseDto = {
      id: productoActualizado.id,
      nombre: productoActualizado.nombre,
      ...(productoActualizado.descripcion && { descripcion: productoActualizado.descripcion }),
      cantidad: productoActualizado.cantidad,
      ...(productoActualizado.unidad && { unidad: productoActualizado.unidad }),
      ...(productoActualizado.precio !== null && { precio: productoActualizado.precio }),
      comprado: productoActualizado.comprado,
      urgente: productoActualizado.urgente,
      listaId: productoActualizado.listaId,
      ...(productoActualizado.categoriaId && { categoriaId: productoActualizado.categoriaId }),
      creadoPorId: productoActualizado.creadoPorId,
      fechaCreacion: productoActualizado.fechaCreacion.toISOString(),
      fechaActualizacion: productoActualizado.fechaActualizacion.toISOString(),
      ...(productoActualizado.calcularValorTotal() !== null && { valorTotal: productoActualizado.calcularValorTotal()! }),
    };

    return success(response);
  }
}