/**
 * Caso de uso: Obtener listas del usuario
 * Recupera todas las listas de un usuario con filtros y paginación
 */

import type { Result } from '@shared/result';
import { success, failure } from '@shared/result';
import type {
  IListaRepository,
  PaginatedResult,
  ListaFilters,
  ListaSortOption
} from '@application/ports/repositories/IListaRepository';
import type { GetUserListsDto, GetUserListsResponseDto } from '@application/dto/lists/GetUserListsDto';
import { ValidationError } from '@application/errors/ValidationError';

export class GetUserLists {
  constructor(
    private readonly listaRepository: IListaRepository
  ) {}

  async execute(dto: GetUserListsDto, propietarioId: string): Promise<Result<PaginatedResult<GetUserListsResponseDto>, ValidationError | Error>> {
    // 1. Validar propietarioId
    if (!propietarioId || propietarioId.trim().length === 0) {
      return failure(ValidationError.create(
        'El ID del propietario es requerido',
        'propietarioId',
        propietarioId
      ));
    }

    // 2. Preparar filtros
    const filters: ListaFilters = {
      propietarioId,
    };

    if (dto.activa !== undefined) {
      filters.activa = dto.activa;
    }

    if (dto.tiendaId) {
      filters.tiendaId = dto.tiendaId;
    }

    if (dto.busqueda) {
      const terminoBusqueda = dto.busqueda.trim();
      if (terminoBusqueda.length > 0) {
        filters.busqueda = terminoBusqueda;
      }
    }

    if (dto.fechaCreacionDesde) {
      const fechaCreacionDesde = new Date(dto.fechaCreacionDesde);
      if (Number.isNaN(fechaCreacionDesde.getTime())) {
        return failure(ValidationError.create(
          'La fecha de inicio de creación no es válida',
          'fechaCreacionDesde',
          dto.fechaCreacionDesde
        ));
      }
      filters.fechaCreacionDesde = fechaCreacionDesde;
    }

    if (dto.fechaCreacionHasta) {
      const fechaCreacionHasta = new Date(dto.fechaCreacionHasta);
      if (Number.isNaN(fechaCreacionHasta.getTime())) {
        return failure(ValidationError.create(
          'La fecha de fin de creación no es válida',
          'fechaCreacionHasta',
          dto.fechaCreacionHasta
        ));
      }
      filters.fechaCreacionHasta = fechaCreacionHasta;
    }

    if (
      filters.fechaCreacionDesde &&
      filters.fechaCreacionHasta &&
      filters.fechaCreacionDesde > filters.fechaCreacionHasta
    ) {
      return failure(ValidationError.create(
        'La fecha de inicio de creación no puede ser posterior a la fecha de fin',
        'rangoFechaCreacion',
        `${dto.fechaCreacionDesde} > ${dto.fechaCreacionHasta}`
      ));
    }

    if (dto.fechaActualizacionDesde) {
      const fechaActualizacionDesde = new Date(dto.fechaActualizacionDesde);
      if (Number.isNaN(fechaActualizacionDesde.getTime())) {
        return failure(ValidationError.create(
          'La fecha de inicio de actualización no es válida',
          'fechaActualizacionDesde',
          dto.fechaActualizacionDesde
        ));
      }
      filters.fechaActualizacionDesde = fechaActualizacionDesde;
    }

    if (dto.fechaActualizacionHasta) {
      const fechaActualizacionHasta = new Date(dto.fechaActualizacionHasta);
      if (Number.isNaN(fechaActualizacionHasta.getTime())) {
        return failure(ValidationError.create(
          'La fecha de fin de actualización no es válida',
          'fechaActualizacionHasta',
          dto.fechaActualizacionHasta
        ));
      }
      filters.fechaActualizacionHasta = fechaActualizacionHasta;
    }

    if (
      filters.fechaActualizacionDesde &&
      filters.fechaActualizacionHasta &&
      filters.fechaActualizacionDesde > filters.fechaActualizacionHasta
    ) {
      return failure(ValidationError.create(
        'La fecha de inicio de actualización no puede ser posterior a la fecha de fin',
        'rangoFechaActualizacion',
        `${dto.fechaActualizacionDesde} > ${dto.fechaActualizacionHasta}`
      ));
    }

    const sortOptions: ListaSortOption[] = [];
    if (dto.sort && dto.sort.length > 0) {
      for (const sortOption of dto.sort) {
        if (!['nombre', 'fechaCreacion', 'fechaActualizacion', 'activa'].includes(sortOption.field)) {
          return failure(ValidationError.create(
            `Campo de ordenamiento inválido: ${sortOption.field}`,
            'sort',
            sortOption.field
          ));
        }

        if (sortOption.direction !== 'asc' && sortOption.direction !== 'desc') {
          return failure(ValidationError.create(
            `Dirección de ordenamiento inválida: ${sortOption.direction}`,
            'sort',
            sortOption.direction
          ));
        }

        sortOptions.push({
          field: sortOption.field,
          direction: sortOption.direction,
        });
      }
    }

    // 3. Preparar paginación
    const pagination = {
      page: dto.page || 1,
      limit: Math.min(dto.limit || 20, 100), // Máximo 100 elementos por página
    };

    // Validar página
    if (pagination.page < 1) {
      return failure(ValidationError.create(
        'El número de página debe ser mayor a 0',
        'page',
        dto.page
      ));
    }

    // Validar límite
    if (dto.limit !== undefined && dto.limit < 1) {
      return failure(ValidationError.create(
        'El límite debe ser mayor a 0',
        'limit',
        dto.limit
      ));
    }

    // 4. Buscar listas
    const listasResult = await this.listaRepository.findByOwner(
      propietarioId,
      filters,
      pagination,
      sortOptions.length > 0 ? sortOptions : undefined
    );
    if (listasResult.isFailure) {
      return failure(listasResult.error);
    }

    const paginatedListas = listasResult.value;

    // 5. Mapear a DTOs de respuesta
    const listasResponse = paginatedListas.items.map(lista => {
      const response: GetUserListsResponseDto = {
        id: lista.id,
        nombre: lista.nombre,
        ...(lista.descripcion && { descripcion: lista.descripcion }),
        propietarioId: lista.propietarioId,
        ...(lista.tiendaId && { tiendaId: lista.tiendaId }),
        activa: lista.activa,
        fechaCreacion: lista.fechaCreacion.toISOString(),
        fechaActualizacion: lista.fechaActualizacion.toISOString(),
        // TODO: Agregar conteo de productos cuando se implemente la entidad Producto
        // totalProductos: lista.productos?.length || 0,
        // productosComprados: lista.productos?.filter(p => p.comprado).length || 0,
      };
      return response;
    });

    // 6. Retornar resultado paginado
    const response: PaginatedResult<GetUserListsResponseDto> = {
      items: listasResponse,
      total: paginatedListas.total,
      page: paginatedListas.page,
      limit: paginatedListas.limit,
      totalPages: paginatedListas.totalPages,
    };

    return success(response);
  }
}