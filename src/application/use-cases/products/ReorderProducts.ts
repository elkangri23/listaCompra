/**
 * Caso de uso: Reordenar productos de una lista
 * PATCH /lists/:listaId/products/reorder — lo usan las flechas ↑ ↓ y el
 * arrastre táctil del detalle de lista. El frontend envía siempre la lista
 * completa reordenada (posiciones 1..N); el caso de uso valida, normaliza
 * huecos y relega al final los productos no incluidos en el payload.
 * No publica evento de auditoría ni de tiempo real: reordenar es un cambio
 * de presentación, no de contenido, y el frontend invalida su query de
 * productos al confirmarse la mutación.
 */

import type { Result } from '@shared/result';
import { success, failure } from '@shared/result';
import type { IProductoRepository } from '@application/ports/repositories/IProductoRepository';
import type { IListaRepository } from '@application/ports/repositories/IListaRepository';
import type { IPermisoRepository } from '@application/ports/repositories/IPermisoRepository';
import type { ReorderProductsDto, ReorderProductsResponseDto } from '@application/dto/products/ReorderProductsDto';
import { ValidationError } from '@application/errors/ValidationError';
import { NotFoundError } from '@application/errors/NotFoundError';
import { UnauthorizedError } from '@application/errors/UnauthorizedError';

export class ReorderProducts {
  constructor(
    private readonly productoRepository: IProductoRepository,
    private readonly listaRepository: IListaRepository,
    private readonly permisoRepository: IPermisoRepository
  ) {}

  async execute(
    dto: ReorderProductsDto,
    usuarioId: string
  ): Promise<Result<ReorderProductsResponseDto, ValidationError | NotFoundError | UnauthorizedError | Error>> {
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

    if (!Array.isArray(dto.orden) || dto.orden.length === 0) {
      return failure(ValidationError.create(
        'Debe especificar al menos un producto para reordenar',
        'orden',
        dto.orden
      ));
    }

    // Validar cada entrada: productoId presente, posición entera >= 1,
    // sin duplicados de producto ni de posición (una posición duplicada es
    // ambigua: no se puede saber qué producto va ahí).
    const vistos = new Set<string>();
    const posiciones = new Set<number>();
    for (const item of dto.orden) {
      if (!item.productoId || item.productoId.trim().length === 0) {
        return failure(ValidationError.create(
          'El ID del producto es requerido',
          'productoId',
          item.productoId
        ));
      }
      if (!Number.isInteger(item.posicion) || item.posicion < 1) {
        return failure(ValidationError.create(
          'La posición debe ser un número entero mayor o igual a 1',
          'posicion',
          item.posicion
        ));
      }
      if (vistos.has(item.productoId)) {
        return failure(ValidationError.create(
          `El producto ${item.productoId} aparece más de una vez en el orden`,
          'orden',
          dto.orden
        ));
      }
      vistos.add(item.productoId);
      if (posiciones.has(item.posicion)) {
        return failure(ValidationError.create(
          `La posición ${item.posicion} aparece más de una vez en el orden`,
          'orden',
          dto.orden
        ));
      }
      posiciones.add(item.posicion);
    }

    // 2. Verificar que la lista existe
    const listaResult = await this.listaRepository.findById(dto.listaId);
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

    // 3. Verificar acceso de escritura: propietario o colaborador con
    // permiso de escritura (mismo criterio a nivel de lista que AddProduct,
    // CU-09). El criterio por producto de UpdateProduct (solo el creador)
    // no puede aplicarse aquí: el reorden toca toda la lista, incluidos
    // productos que el usuario no creó.
    if (!lista.esPropietario(usuarioId)) {
      const permiso = await this.permisoRepository.findUniqueByUsuarioAndLista(
        usuarioId,
        dto.listaId
      );
      if (!permiso || !permiso.tipoPermiso.canWrite()) {
        return failure(new UnauthorizedError(
          'No tienes permisos para reordenar los productos de esta lista'
        ));
      }
    }

    // 4. Verificar que la lista está activa
    if (!lista.estaActiva()) {
      return failure(ValidationError.create(
        'No se pueden reordenar los productos de una lista inactiva',
        'lista',
        dto.listaId
      ));
    }

    // 5. Cargar todos los productos de la lista y verificar pertenencia.
    // Si alguno no pertenece, no se cambia nada.
    const productosResult = await this.productoRepository.findByList(dto.listaId);
    if (productosResult.isFailure) {
      return failure(productosResult.error);
    }

    const productos = productosResult.value.items;
    const idsEnLista = new Set(productos.map(p => p.id));
    const ajeno = dto.orden.find(item => !idsEnLista.has(item.productoId));
    if (ajeno) {
      return failure(ValidationError.create(
        `El producto ${ajeno.productoId} no pertenece a la lista`,
        'orden',
        dto.orden
      ));
    }

    // 6. Calcular el orden final: el payload ordenado por posición, con
    // posiciones normalizadas a 1..N (los huecos se cierran); los productos
    // no incluidos conservan su orden relativo actual y quedan después.
    const payloadOrdenado = [...dto.orden].sort((a, b) => a.posicion - b.posicion);
    const ordenFinal: Array<{ productoId: string; posicion: number }> = payloadOrdenado.map((item, i) => ({
      productoId: item.productoId,
      posicion: i + 1
    }));
    let siguiente = ordenFinal.length + 1;
    for (const producto of productos) {
      if (!vistos.has(producto.id)) {
        ordenFinal.push({ productoId: producto.id, posicion: siguiente });
        siguiente += 1;
      }
    }

    // 7. Aplicar en una sola operación atómica (todo o nada en Prisma).
    const updateResult = await this.productoRepository.updateOrden(dto.listaId, ordenFinal);
    if (updateResult.isFailure) {
      return failure(updateResult.error);
    }

    const n = payloadOrdenado.length;
    return success({
      listaId: dto.listaId,
      productos: updateResult.value,
      mensaje: `${n} ${n === 1 ? 'producto reordenado' : 'productos reordenados'}`
    });
  }
}
