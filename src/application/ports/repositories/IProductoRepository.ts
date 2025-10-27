/**
 * Puerto (interface) para el repositorio de productos
 * Define el contrato para operaciones de persistencia de productos
 */

import type { Result } from '@shared/result';
import type { Producto } from '@domain/entities/Producto';

export interface ProductoFilters {
  /**
   * Filtrar por estado de comprado
   */
  comprado?: boolean;

  /**
   * Filtrar por urgente
   */
  urgente?: boolean;

  /**
   * Filtrar por categoría
   */
  categoriaId?: string;

  /**
   * Buscar por nombre o descripción
   */
  busqueda?: string;
}

export interface PaginationOptions {
  /**
   * Número de página (empezando en 1)
   */
  page: number;

  /**
   * Elementos por página
   */
  limit: number;
}

export interface PaginatedResult<T> {
  /**
   * Elementos de la página actual
   */
  items: T[];

  /**
   * Total de elementos encontrados
   */
  total: number;

  /**
   * Página actual
   */
  page: number;

  /**
   * Elementos por página
   */
  limit: number;

  /**
   * Total de páginas
   */
  totalPages: number;
}

export interface ProductoResumen {
  /**
   * Total de productos comprados
   */
  comprados: number;

  /**
   * Total de productos pendientes
   */
  pendientes: number;

  /**
   * Total de productos urgentes
   */
  urgentes: number;

  /**
   * Valor total de productos con precio
   */
  valorTotal: number;
}

export interface IProductoRepository {
  /**
   * Guarda un producto (crear o actualizar)
   */
  save(producto: Producto): Promise<Result<Producto, Error>>;

  /**
   * Busca un producto por ID
   */
  findById(id: string): Promise<Result<Producto | null, Error>>;

  /**
   * Busca un producto por ID y verifica que pertenezca a la lista especificada
   */
  findByIdAndList(id: string, listaId: string): Promise<Result<Producto | null, Error>>;

  /**
   * Busca todos los productos de una lista con filtros y paginación
   */
  findByList(
    listaId: string, 
    filters?: ProductoFilters,
    pagination?: PaginationOptions
  ): Promise<Result<PaginatedResult<Producto>, Error>>;

  /**
   * Busca productos por nombre en una lista específica
   */
  findByNameAndList(nombre: string, listaId: string): Promise<Result<Producto[], Error>>;

  /**
   * Elimina un producto por ID
   */
  deleteById(id: string): Promise<Result<void, Error>>;

  /**
   * Verifica si existe un producto por ID
   */
  existsById(id: string): Promise<Result<boolean, Error>>;

  /**
   * Cuenta el total de productos de una lista
   */
  countByList(listaId: string): Promise<Result<number, Error>>;

  /**
   * Obtiene un resumen de productos de una lista
   */
  getResumenByList(listaId: string): Promise<Result<ProductoResumen, Error>>;

  /**
   * Marca todos los productos de una lista como comprados/no comprados
   */
  markAllAsPurchased(listaId: string, comprado: boolean): Promise<Result<number, Error>>;

  /**
   * Busca productos por categoría
   */
  findByCategory(categoriaId: string): Promise<Result<Producto[], Error>>;

  /**
   * Busca productos urgentes de un usuario
   */
  findUrgentByUser(userId: string): Promise<Result<Producto[], Error>>;

  /**
   * Elimina todos los productos de una lista
   */
  deleteAllByList(listaId: string): Promise<Result<number, Error>>;
}