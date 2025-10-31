/**
 * Caso de uso: CU-26 - Obtener tiendas
 * Permite obtener todas las tiendas disponibles con sus estadísticas
 */

import type { Result } from '@shared/result';
import { success, failure } from '@shared/result';
import { InvalidValueError } from '@domain/errors/DomainError';
import type { ITiendaRepository } from '@application/ports/repositories/ITiendaRepository';
import type { GetStoresDto, StoresListResponseDto, StoreResponseDto } from '@application/dto/stores';

export class GetStores {
  constructor(
    private readonly tiendaRepository: ITiendaRepository
  ) {}

  async execute(dto: GetStoresDto): Promise<Result<StoresListResponseDto, InvalidValueError>> {
    // Determinar si incluir tiendas inactivas
    const includeInactive = dto.includeInactive ?? false;

    // Obtener tiendas básicas
    const tiendasResult = await this.tiendaRepository.findAll(includeInactive);

    if (tiendasResult.isFailure) {
      return failure(tiendasResult.error);
    }

    let tiendas = tiendasResult.value;

    // Filtrar por estado activo si se especifica
    if (dto.activas !== undefined) {
      tiendas = tiendas.filter(tienda => tienda.activa === dto.activas);
    }

    // Aplicar paginación si se especifica
    if (dto.limit || dto.offset) {
      const offset = dto.offset ?? 0;
      const limit = dto.limit ?? 50;
      tiendas = tiendas.slice(offset, offset + limit);
    }

    // Mapear a DTOs de respuesta
    const tiendasResponse: StoreResponseDto[] = await Promise.all(
      tiendas.map(async (tienda) => {
        // Obtener estadísticas de la tienda
        let totalCategorias = 0;
        const statsResult = await this.tiendaRepository.getStats(tienda.id);
        if (statsResult.isSuccess) {
          totalCategorias = statsResult.value.totalCategorias;
        }

        const response: StoreResponseDto = {
          id: tienda.id,
          nombre: tienda.nombre,
          activa: tienda.activa,
          fechaCreacion: tienda.fechaCreacion,
          fechaActualizacion: tienda.fechaActualizacion,
          totalCategorias,
          ...(tienda.direccion && { direccion: tienda.direccion }),
          ...(tienda.telefono && { telefono: tienda.telefono }),
          ...(tienda.sitioWeb && { sitioWeb: tienda.sitioWeb }),
        };

        // Incluir categorías si se solicitaron
        if (dto.withCategories) {
          const categoriesResult = await this.tiendaRepository.findByIdWithCategories(tienda.id);
          if (categoriesResult.isSuccess && categoriesResult.value) {
            response.categorias = categoriesResult.value.categorias.map(categoria => ({
              id: categoria.id,
              nombre: categoria.nombre,
              activa: categoria.activa,
              ...(categoria.color && { color: categoria.color }),
              ...(categoria.icono && { icono: categoria.icono }),
            }));
          }
        }

        return response;
      })
    );

    // Construir respuesta
    const response: StoresListResponseDto = {
      tiendas: tiendasResponse,
      total: tiendasResponse.length,
    };

    return success(response);
  }
}