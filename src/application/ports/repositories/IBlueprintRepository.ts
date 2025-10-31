/**
 * Puerto para el repositorio de blueprints
 * Define las operaciones de persistencia para las plantillas de listas
 */

import type { Result } from '@shared/result';
import type { Blueprint } from '@domain/entities/Blueprint';

export interface PaginationOptions {
  page?: number;
  limit?: number;
}

export interface BlueprintFilters {
  activo?: boolean;
  usuarioId?: string;
  nombre?: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface IBlueprintRepository {
  /**
   * Guarda un blueprint (nuevo o actualizado)
   */
  save(blueprint: Blueprint): Promise<Result<Blueprint, Error>>;

  /**
   * Busca un blueprint por su ID
   */
  findById(id: string): Promise<Result<Blueprint | null, Error>>;

  /**
   * Busca blueprints por usuario
   */
  findByUsuarioId(
    usuarioId: string, 
    pagination?: PaginationOptions,
    filters?: Omit<BlueprintFilters, 'usuarioId'>
  ): Promise<Result<PaginatedResult<Blueprint>, Error>>;

  /**
   * Busca blueprints activos de un usuario
   */
  findActiveByUsuarioId(usuarioId: string): Promise<Result<Blueprint[], Error>>;

  /**
   * Busca blueprints por nombre (búsqueda parcial)
   */
  findByNombre(
    nombre: string, 
    usuarioId: string,
    pagination?: PaginationOptions
  ): Promise<Result<PaginatedResult<Blueprint>, Error>>;

  /**
   * Elimina un blueprint por su ID
   */
  deleteById(id: string): Promise<Result<void, Error>>;

  /**
   * Verifica si existe un blueprint por ID
   */
  existsById(id: string): Promise<Result<boolean, Error>>;

  /**
   * Verifica si un usuario tiene un blueprint con un nombre específico
   */
  existsByNombreAndUsuario(nombre: string, usuarioId: string, excludeId?: string): Promise<Result<boolean, Error>>;

  /**
   * Cuenta los blueprints de un usuario
   */
  countByUsuarioId(usuarioId: string, onlyActive?: boolean): Promise<Result<number, Error>>;

  /**
   * Obtiene todos los blueprints (para admin)
   */
  findAll(
    pagination?: PaginationOptions,
    filters?: BlueprintFilters
  ): Promise<Result<PaginatedResult<Blueprint>, Error>>;

  /**
   * Desactiva todos los blueprints de un usuario
   */
  deactivateAllByUsuarioId(usuarioId: string): Promise<Result<void, Error>>;
}