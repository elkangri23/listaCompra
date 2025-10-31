/**
 * Puerto (interface) para el repositorio de tiendas
 * Define las operaciones de persistencia para la entidad Tienda
 */

import type { Result } from '@shared/result';
import type { Tienda } from '@domain/entities/Tienda';
import type { Categoria } from '@domain/entities/Categoria';
import { InvalidValueError, BusinessRuleViolationError } from '@domain/errors/DomainError';

export interface ITiendaRepository {
  /**
   * Guarda una nueva tienda
   */
  save(tienda: Tienda): Promise<Result<Tienda, InvalidValueError | BusinessRuleViolationError>>;

  /**
   * Actualiza una tienda existente
   */
  update(tienda: Tienda): Promise<Result<Tienda, InvalidValueError | BusinessRuleViolationError>>;

  /**
   * Encuentra una tienda por su ID
   */
  findById(id: string): Promise<Result<Tienda | null, InvalidValueError>>;

  /**
   * Encuentra una tienda por nombre
   */
  findByNombre(nombre: string): Promise<Result<Tienda | null, InvalidValueError>>;

  /**
   * Encuentra todas las tiendas
   */
  findAll(includeInactive?: boolean): Promise<Result<Tienda[], InvalidValueError>>;

  /**
   * Verifica si existe una tienda con el mismo nombre
   */
  existsByNombre(nombre: string, excludeId?: string): Promise<Result<boolean, InvalidValueError>>;

  /**
   * Elimina una tienda por ID
   * Solo permite eliminar si no tiene categorías asociadas
   */
  delete(id: string): Promise<Result<boolean, InvalidValueError | BusinessRuleViolationError>>;

  /**
   * Busca tiendas con filtros avanzados
   */
  search(filters: {
    query?: string;
    activa?: boolean;
    hasWebsite?: boolean;
    hasPhysicalLocation?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<Result<{
    tiendas: Tienda[];
    total: number;
  }, InvalidValueError>>;

  /**
   * Obtiene una tienda con sus categorías
   */
  findByIdWithCategories(id: string, includeInactiveCategories?: boolean): Promise<Result<{
    tienda: Tienda;
    categorias: Categoria[];
  } | null, InvalidValueError>>;

  /**
   * Obtiene todas las tiendas con sus categorías
   */
  findAllWithCategories(includeInactive?: boolean): Promise<Result<Array<{
    tienda: Tienda;
    categorias: Categoria[];
  }>, InvalidValueError>>;

  /**
   * Cuenta el número de categorías de una tienda
   */
  countCategorias(tiendaId: string, onlyActive?: boolean): Promise<Result<number, InvalidValueError>>;

  /**
   * Verifica si una tienda tiene categorías asociadas
   */
  hasCategories(tiendaId: string): Promise<Result<boolean, InvalidValueError>>;

  /**
   * Obtiene estadísticas de una tienda
   */
  getStats(tiendaId: string): Promise<Result<{
    totalCategorias: number;
    categoriasActivas: number;
    categoriasInactivas: number;
    fechaUltimaCategoria?: Date;
  }, InvalidValueError>>;

  /**
   * Obtiene estadísticas generales de todas las tiendas
   */
  getAllStats(): Promise<Result<Array<{
    tienda: Tienda;
    totalCategorias: number;
    categoriasActivas: number;
    categoriasInactivas: number;
    fechaUltimaCategoria?: Date;
  }>, InvalidValueError>>;

  /**
   * Obtiene las tiendas más utilizadas (con más categorías)
   */
  getMostUsed(limit?: number): Promise<Result<Array<{
    tienda: Tienda;
    totalCategorias: number;
  }>, InvalidValueError>>;

  /**
   * Desactiva una tienda y todas sus categorías
   */
  deactivateWithCategories(tiendaId: string): Promise<Result<{
    tienda: Tienda;
    categoriasDesactivadas: number;
  }, InvalidValueError | BusinessRuleViolationError>>;

  /**
   * Activa una tienda (las categorías mantienen su estado individual)
   */
  activate(tiendaId: string): Promise<Result<Tienda, InvalidValueError | BusinessRuleViolationError>>;
}