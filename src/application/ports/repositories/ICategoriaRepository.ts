/**
 * Puerto (interface) para el repositorio de categorías
 * Define las operaciones de persistencia para la entidad Categoria
 */

import type { Result } from '@shared/result';
import type { Categoria } from '@domain/entities/Categoria';
import { InvalidValueError, BusinessRuleViolationError } from '@domain/errors/DomainError';

export interface ICategoriaRepository {
  /**
   * Guarda una nueva categoría
   */
  save(categoria: Categoria): Promise<Result<Categoria, InvalidValueError | BusinessRuleViolationError>>;

  /**
   * Actualiza una categoría existente
   */
  update(categoria: Categoria): Promise<Result<Categoria, InvalidValueError | BusinessRuleViolationError>>;

  /**
   * Encuentra una categoría por su ID
   */
  findById(id: string): Promise<Result<Categoria | null, InvalidValueError>>;

  /**
   * Encuentra categorías por tienda
   * @param tiendaId - ID de la tienda, null para categorías generales
   * @param includeInactive - Incluir categorías inactivas
   */
  findByTienda(tiendaId: string | null, includeInactive?: boolean): Promise<Result<Categoria[], InvalidValueError>>;

  /**
   * Encuentra todas las categorías de un usuario/contexto
   */
  findAll(includeInactive?: boolean): Promise<Result<Categoria[], InvalidValueError>>;

  /**
   * Busca categorías por nombre
   */
  findByNombre(nombre: string, tiendaId?: string | null): Promise<Result<Categoria[], InvalidValueError>>;

  /**
   * Busca categorías por color
   */
  findByColor(color: string, tiendaId?: string | null): Promise<Result<Categoria[], InvalidValueError>>;

  /**
   * Verifica si existe una categoría con el mismo nombre en la misma tienda
   */
  existsByNombreAndTienda(nombre: string, tiendaId: string | null, excludeId?: string): Promise<Result<boolean, InvalidValueError>>;

  /**
   * Elimina una categoría por ID
   */
  delete(id: string): Promise<Result<boolean, InvalidValueError | BusinessRuleViolationError>>;

  /**
   * Cuenta el número de categorías por tienda
   */
  countByTienda(tiendaId: string | null): Promise<Result<number, InvalidValueError>>;

  /**
   * Busca categorías con filtros avanzados
   */
  search(filters: {
    query?: string;
    tiendaId?: string | null;
    color?: string;
    activa?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<Result<{
    categorias: Categoria[];
    total: number;
  }, InvalidValueError>>;

  /**
   * Obtiene categorías más utilizadas
   */
  getMostUsed(limit?: number, tiendaId?: string | null): Promise<Result<Categoria[], InvalidValueError>>;

  /**
   * Cambia la tienda de una categoría
   */
  moveToTienda(categoriaId: string, newTiendaId: string | null): Promise<Result<Categoria, InvalidValueError | BusinessRuleViolationError>>;

  /**
   * Desactiva todas las categorías de una tienda
   */
  deactivateByTienda(tiendaId: string): Promise<Result<number, InvalidValueError>>;

  /**
   * Obtiene estadísticas de categorías
   */
  getStats(tiendaId?: string | null): Promise<Result<{
    total: number;
    activas: number;
    inactivas: number;
    porColor: Record<string, number>;
  }, InvalidValueError>>;
}