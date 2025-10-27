/**
 * Caso de uso: CU-12 - Obtener categorías por tienda
 * Permite obtener todas las categorías de una tienda específica o categorías generales
 */

import type { Result } from '@shared/result';
import { success, failure } from '@shared/result';
import { InvalidValueError } from '@domain/errors/DomainError';
import type { ICategoriaRepository } from '@application/ports/repositories/ICategoriaRepository';
import type { ITiendaRepository } from '@application/ports/repositories/ITiendaRepository';
import type { GetCategoriesByStoreDto, CategoriesListResponseDto, CategoryResponseDto } from '@application/dto/categories';

export class GetCategoriesByStore {
  constructor(
    private readonly categoriaRepository: ICategoriaRepository,
    private readonly tiendaRepository: ITiendaRepository
  ) {}

  async execute(dto: GetCategoriesByStoreDto): Promise<Result<CategoriesListResponseDto, InvalidValueError>> {
    let tiendaInfo: { id: string; nombre: string } | undefined;

    // Si se especifica una tienda, validar que existe
    if (dto.tiendaId) {
      const tiendaResult = await this.tiendaRepository.findById(dto.tiendaId);
      if (tiendaResult.isFailure) {
        return failure(tiendaResult.error);
      }
      
      const tienda = tiendaResult.value;
      if (!tienda) {
        return failure(new InvalidValueError(
          'La tienda especificada no existe',
          'tiendaId',
          dto.tiendaId
        ));
      }

      tiendaInfo = {
        id: tienda.id,
        nombre: tienda.nombre
      };
    }

    // Obtener categorías
    const includeInactive = dto.includeInactive ?? false;
    const categoriasResult = await this.categoriaRepository.findByTienda(
      dto.tiendaId || null,
      includeInactive
    );

    if (categoriasResult.isFailure) {
      return failure(categoriasResult.error);
    }

    const categorias = categoriasResult.value;

    // Filtrar por estado activo si se especifica
    let categoriasFiltradas = categorias;
    if (dto.activas !== undefined) {
      categoriasFiltradas = categorias.filter(categoria => categoria.activa === dto.activas);
    }

    // Mapear a DTOs de respuesta
    const categoriasResponse: CategoryResponseDto[] = await Promise.all(
      categoriasFiltradas.map(async (categoria) => {
        let tiendaNombre: string | undefined;
        
        // Si la categoría tiene tienda y no tenemos la info ya, obtenerla
        if (categoria.tiendaId && (!tiendaInfo || tiendaInfo.id !== categoria.tiendaId)) {
          const tiendaResult = await this.tiendaRepository.findById(categoria.tiendaId);
          if (tiendaResult.isSuccess && tiendaResult.value) {
            tiendaNombre = tiendaResult.value.nombre;
          }
        } else if (tiendaInfo) {
          tiendaNombre = tiendaInfo.nombre;
        }

        return {
          id: categoria.id,
          nombre: categoria.nombre,
          activa: categoria.activa,
          fechaCreacion: categoria.fechaCreacion,
          fechaActualizacion: categoria.fechaActualizacion,
          ...(categoria.descripcion && { descripcion: categoria.descripcion }),
          ...(categoria.color && { color: categoria.color }),
          ...(categoria.icono && { icono: categoria.icono }),
          ...(categoria.tiendaId && { tiendaId: categoria.tiendaId }),
          ...(tiendaNombre && { tiendaNombre }),
        };
      })
    );

    // Construir respuesta
    const response: CategoriesListResponseDto = {
      categorias: categoriasResponse,
      total: categoriasResponse.length,
      ...(tiendaInfo && { tienda: tiendaInfo }),
    };

    return success(response);
  }
}