/**
 * Puerto para el repositorio de listas
 * Define las operaciones de persistencia para las listas
 */

import type { Result } from '@shared/result';
import type { Lista } from '@domain/entities/Lista';

export interface PaginationOptions {
  page?: number;
  limit?: number;
}

export type ListaSortField = 'nombre' | 'fechaCreacion' | 'fechaActualizacion' | 'activa';

export type ListaSortDirection = 'asc' | 'desc';

export interface ListaSortOption {
  field: ListaSortField;
  direction: ListaSortDirection;
}

export interface ListaFilters {
  activa?: boolean;
  tiendaId?: string;
  propietarioId?: string;
  busqueda?: string;
  fechaCreacionDesde?: Date;
  fechaCreacionHasta?: Date;
  fechaActualizacionDesde?: Date;
  fechaActualizacionHasta?: Date;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface IListaRepository {
  /**
   * Guarda una lista (nueva o actualizada)
   */
  save(lista: Lista): Promise<Result<Lista, Error>>;

  /**
   * Busca una lista por ID
   */
  findById(id: string): Promise<Result<Lista | null, Error>>;

  /**
   * Busca una lista por ID del propietario con validación de propiedad
   */
  findByIdAndOwner(id: string, propietarioId: string): Promise<Result<Lista | null, Error>>;

  /**
   * Busca todas las listas de un usuario con filtros y paginación
   */
  findByOwner(
    propietarioId: string,
    filters?: ListaFilters,
    pagination?: PaginationOptions,
    sort?: ListaSortOption[]
  ): Promise<Result<PaginatedResult<Lista>, Error>>;

  /**
   * Busca listas por nombre (para verificar duplicados)
   */
  findByNameAndOwner(nombre: string, propietarioId: string): Promise<Result<Lista | null, Error>>;

  /**
   * Elimina una lista por ID (soft delete)
   */
  deleteById(id: string): Promise<Result<void, Error>>;

  /**
   * Elimina una lista permanentemente por ID (hard delete)
   */
  hardDelete(id: string): Promise<Result<boolean, Error>>;

  /**
   * Verifica si existe una lista por ID
   */
  existsById(id: string): Promise<Result<boolean, Error>>;

  /**
   * Verifica si existe una lista con ese nombre para un usuario
   */
  existsByNameAndOwner(nombre: string, propietarioId: string): Promise<Result<boolean, Error>>;

  /**
   * Cuenta el total de listas de un usuario
   */
  countByOwner(propietarioId: string): Promise<Result<number, Error>>;

  /**
   * Actualiza el estado activo de una lista
   */
  updateActiveStatus(id: string, activa: boolean): Promise<Result<void, Error>>;
}