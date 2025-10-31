/**
 * Mapper para convertir entre entidad Producto de dominio y modelo de persistencia
 */

import type { Result } from '@shared/result';
import { success, failure } from '@shared/result';
import { Producto } from '@domain/entities/Producto';
import { InvalidValueError, BusinessRuleViolationError } from '@domain/errors/DomainError';

export class ProductoMapper {
  /**
   * Convierte de entidad de dominio a modelo de persistencia
   */
  static toPersistence(producto: Producto) {
    return {
      id: producto.id,
      nombre: producto.nombre,
      descripcion: producto.descripcion,
      cantidad: producto.cantidad,
      unidad: producto.unidad,
      precio: producto.precio,
      comprado: producto.comprado,
      urgente: producto.urgente,
      listaId: producto.listaId,
      categoriaId: producto.categoriaId,
      creadoPorId: producto.creadoPorId,
      fechaCreacion: producto.fechaCreacion,
      fechaActualizacion: producto.fechaActualizacion,
      fechaCompra: producto.fechaCompra,
    };
  }

  /**
   * Convierte de modelo de persistencia a entidad de dominio
   */
  static toDomain(data: any): Result<Producto, InvalidValueError | BusinessRuleViolationError> {
    try {
      return Producto.create({
        id: data.id,
        nombre: data.nombre,
        descripcion: data.descripcion,
        cantidad: data.cantidad,
        unidad: data.unidad,
        precio: data.precio ? Number(data.precio) : null,
        comprado: data.comprado,
        urgente: data.urgente,
        listaId: data.listaId,
        categoriaId: data.categoriaId,
        creadoPorId: data.creadoPorId,
        fechaCreacion: data.fechaCreacion,
        fechaActualizacion: data.fechaActualizacion,
        fechaCompra: data.fechaCompra,
      });
    } catch (error) {
      return failure(new InvalidValueError(
        'Error al mapear datos de persistencia a entidad Producto',
        'data',
        data
      ));
    }
  }

  /**
   * Convierte múltiples entidades de dominio a modelos de persistencia
   */
  static toPersistenceArray(productos: Producto[]) {
    return productos.map(producto => this.toPersistence(producto));
  }

  /**
   * Convierte múltiples modelos de persistencia a entidades de dominio
   */
  static toDomainArray(data: any[]): Result<Producto[], InvalidValueError | BusinessRuleViolationError> {
    const productos: Producto[] = [];
    
    for (const item of data) {
      const productoResult = this.toDomain(item);
      if (productoResult.isFailure) {
        return failure(productoResult.error);
      }
      productos.push(productoResult.value);
    }
    
    return success(productos);
  }
}