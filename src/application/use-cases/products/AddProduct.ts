/**
 * Caso de uso: Añadir producto a una lista
 * Permite añadir un nuevo producto a una lista de compra existente
 */

import type { Result } from '@shared/result';
import { success, failure } from '@shared/result';
import type { IProductoRepository } from '@application/ports/repositories/IProductoRepository';
import type { IListaRepository } from '@application/ports/repositories/IListaRepository';
import type { AddProductDto, AddProductResponseDto } from '@application/dto/products/AddProductDto';
import { Producto } from '@domain/entities/Producto';
import { ValidationError } from '@application/errors/ValidationError';
import { NotFoundError } from '@application/errors/NotFoundError';
import { UnauthorizedError } from '@application/errors/UnauthorizedError';

export class AddProduct {
  constructor(
    private readonly productoRepository: IProductoRepository,
    private readonly listaRepository: IListaRepository
  ) {}

  async execute(
    dto: AddProductDto,
    usuarioId: string
  ): Promise<Result<AddProductResponseDto, ValidationError | NotFoundError | UnauthorizedError | Error>> {
    // 1. Validar entrada básica
    if (!usuarioId || usuarioId.trim().length === 0) {
      return failure(ValidationError.create(
        'El ID del usuario es requerido',
        'usuarioId',
        usuarioId
      ));
    }

    if (!dto.listaId || dto.listaId.trim().length === 0) {
      return failure(ValidationError.create(
        'El ID de la lista es requerido',
        'listaId',
        dto.listaId
      ));
    }

    // 2. Verificar que la lista existe y el usuario tiene permisos
    const listaResult = await this.listaRepository.findByIdAndOwner(dto.listaId, usuarioId);
    if (listaResult.isFailure) {
      return failure(listaResult.error);
    }

    const lista = listaResult.value;
    if (!lista) {
      return failure(new NotFoundError(
        'Lista',
        dto.listaId
      ));
    }

    // 3. Verificar que el usuario es propietario de la lista
    if (!lista.esPropietario(usuarioId)) {
      return failure(new UnauthorizedError(
        'No tienes permisos para añadir productos a esta lista'
      ));
    }

    // 4. Verificar que la lista está activa
    if (!lista.estaActiva()) {
      return failure(ValidationError.create(
        'No se pueden añadir productos a una lista inactiva',
        'lista',
        dto.listaId
      ));
    }

    // 5. Contar productos existentes para validar límites (opcional: máximo 1000 productos por lista)
    const countResult = await this.productoRepository.countByList(dto.listaId);
    if (countResult.isFailure) {
      return failure(countResult.error);
    }

    const cantidadProductos = countResult.value;
    if (cantidadProductos >= 1000) {
      return failure(ValidationError.create(
        'La lista ha alcanzado el límite máximo de 1000 productos',
        'productos',
        cantidadProductos
      ));
    }

    // 6. Crear la entidad producto
    const productoResult = Producto.create({
      nombre: dto.nombre,
      ...(dto.descripcion && { descripcion: dto.descripcion }),
      ...(dto.cantidad && { cantidad: dto.cantidad }),
      ...(dto.unidad && { unidad: dto.unidad }),
      ...(dto.precio !== undefined && { precio: dto.precio }),
      ...(dto.urgente !== undefined && { urgente: dto.urgente }),
      listaId: dto.listaId,
      ...(dto.categoriaId && { categoriaId: dto.categoriaId }),
      creadoPorId: usuarioId,
    });

    if (productoResult.isFailure) {
      const error = productoResult.error;
      if ('field' in error && 'value' in error) {
        // Es InvalidValueError
        return failure(ValidationError.create(
          error.message,
          error.field,
          error.value
        ));
      } else {
        // Es BusinessRuleViolationError
        return failure(ValidationError.create(
          error.message,
          'producto',
          dto
        ));
      }
    }

    const producto = productoResult.value;

    // 7. Guardar el producto
    const saveResult = await this.productoRepository.save(producto);
    if (saveResult.isFailure) {
      return failure(saveResult.error);
    }

    const productoGuardado = saveResult.value;

    // 8. Construir respuesta
    const response: AddProductResponseDto = {
      id: productoGuardado.id,
      nombre: productoGuardado.nombre,
      ...(productoGuardado.descripcion && { descripcion: productoGuardado.descripcion }),
      cantidad: productoGuardado.cantidad,
      ...(productoGuardado.unidad && { unidad: productoGuardado.unidad }),
      ...(productoGuardado.precio !== null && { precio: productoGuardado.precio }),
      comprado: productoGuardado.comprado,
      urgente: productoGuardado.urgente,
      listaId: productoGuardado.listaId,
      ...(productoGuardado.categoriaId && { categoriaId: productoGuardado.categoriaId }),
      creadoPorId: productoGuardado.creadoPorId,
      fechaCreacion: productoGuardado.fechaCreacion.toISOString(),
      fechaActualizacion: productoGuardado.fechaActualizacion.toISOString(),
      ...(productoGuardado.calcularValorTotal() !== null && { valorTotal: productoGuardado.calcularValorTotal()! }),
    };

    return success(response);
  }
}