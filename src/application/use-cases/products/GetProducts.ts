/**
 * Caso de uso: Obtener productos de una lista
 * Permite obtener los productos de una lista con filtros y paginación
 */

import type { Result } from '@shared/result';
import { success, failure } from '@shared/result';
import type { IProductoRepository } from '@application/ports/repositories/IProductoRepository';
import type { IListaRepository } from '@application/ports/repositories/IListaRepository';
import type { 
  GetProductsDto, 
  GetProductsResponseDto, 
  ProductoListDto 
} from '@application/dto/products/GetProductsDto';
import { ValidationError } from '@application/errors/ValidationError';
import { NotFoundError } from '@application/errors/NotFoundError';
import { UnauthorizedError } from '@application/errors/UnauthorizedError';

export class GetProducts {
  constructor(
    private readonly productoRepository: IProductoRepository,
    private readonly listaRepository: IListaRepository
  ) {}

  async execute(
    dto: GetProductsDto,
    usuarioId: string
  ): Promise<Result<GetProductsResponseDto, ValidationError | NotFoundError | UnauthorizedError | Error>> {
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

    // 2. Validar parámetros de paginación
    const page = dto.page || 1;
    const limit = Math.min(dto.limit || 20, 100); // Máximo 100 productos por página

    if (page < 1) {
      return failure(ValidationError.create(
        'El número de página debe ser mayor a 0',
        'page',
        dto.page
      ));
    }

    if (limit < 1) {
      return failure(ValidationError.create(
        'El límite debe ser mayor a 0',
        'limit',
        dto.limit
      ));
    }

    // 3. Verificar que la lista existe y el usuario tiene acceso
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

    // 4. Verificar permisos de acceso
    if (!lista.esPropietario(usuarioId)) {
      return failure(new UnauthorizedError(
        'No tienes permisos para ver los productos de esta lista'
      ));
    }

    // 5. Preparar filtros
    const filters = {
      ...(dto.comprado !== undefined && { comprado: dto.comprado }),
      ...(dto.urgente !== undefined && { urgente: dto.urgente }),
      ...(dto.categoriaId && { categoriaId: dto.categoriaId }),
      ...(dto.busqueda && { busqueda: dto.busqueda }),
    };

    // 6. Obtener productos con paginación
    const productosResult = await this.productoRepository.findByList(
      dto.listaId,
      filters,
      { page, limit }
    );

    if (productosResult.isFailure) {
      return failure(productosResult.error);
    }

    const productosPage = productosResult.value;

    // 7. Obtener resumen de la lista
    const resumenResult = await this.productoRepository.getResumenByList(dto.listaId);
    if (resumenResult.isFailure) {
      return failure(resumenResult.error);
    }

    const resumen = resumenResult.value;

    // 8. Mapear productos a DTOs
    const productosDto: ProductoListDto[] = productosPage.items.map(producto => ({
      id: producto.id,
      nombre: producto.nombre,
      ...(producto.descripcion && { descripcion: producto.descripcion }),
      cantidad: producto.cantidad,
      ...(producto.unidad && { unidad: producto.unidad }),
      ...(producto.precio !== null && { precio: producto.precio }),
      comprado: producto.comprado,
      urgente: producto.urgente,
      ...(producto.categoriaId && { categoriaId: producto.categoriaId }),
      fechaCreacion: producto.fechaCreacion.toISOString(),
      ...(producto.fechaCompra && { fechaCompra: producto.fechaCompra.toISOString() }),
      ...(producto.calcularValorTotal() !== null && { valorTotal: producto.calcularValorTotal()! }),
    }));

    // 9. Construir respuesta
    const response: GetProductsResponseDto = {
      items: productosDto,
      total: productosPage.total,
      page: productosPage.page,
      limit: productosPage.limit,
      totalPages: productosPage.totalPages,
      resumen: {
        comprados: resumen.comprados,
        pendientes: resumen.pendientes,
        urgentes: resumen.urgentes,
        ...(resumen.valorTotal > 0 && { valorTotal: resumen.valorTotal }),
      },
    };

    return success(response);
  }
}