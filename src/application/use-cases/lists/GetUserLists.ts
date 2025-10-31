/**
 * Caso de uso: Obtener listas del usuario
 * Recupera todas las listas de un usuario con filtros y paginación
 */

import type { Result } from '@shared/result';
import { success, failure } from '@shared/result';
import type { IListaRepository, PaginatedResult } from '@application/ports/repositories/IListaRepository';
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
    const filters = {
      ...(dto.activa !== undefined && { activa: dto.activa }),
      ...(dto.tiendaId && { tiendaId: dto.tiendaId }),
      propietarioId,
    };

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
    const listasResult = await this.listaRepository.findByOwner(propietarioId, filters, pagination);
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