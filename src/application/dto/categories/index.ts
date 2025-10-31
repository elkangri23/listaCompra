/**
 * DTOs para la gestión de categorías
 */

/**
 * DTO para crear una nueva categoría
 * Caso de uso: CU-11 - Crear categoría
 */
export interface CreateCategoryDto {
  nombre: string;
  descripcion?: string;
  color?: string;
  icono?: string;
  tiendaId?: string;
}

/**
 * DTO para actualizar una categoría existente
 * Caso de uso: CU-13 - Actualizar categoría
 */
export interface UpdateCategoryDto {
  id: string;
  nombre?: string;
  descripcion?: string;
  color?: string;
  icono?: string;
  activa?: boolean;
  tiendaId?: string;
}

/**
 * DTO para eliminar una categoría
 * Caso de uso: CU-14 - Eliminar categoría
 */
export interface DeleteCategoryDto {
  id: string;
}

/**
 * DTO para obtener categorías por tienda
 * Caso de uso: CU-12 - Obtener categorías por tienda
 */
export interface GetCategoriesByStoreDto {
  tiendaId?: string; // Si no se proporciona, obtiene categorías generales
  activas?: boolean; // Filtrar solo categorías activas
  includeInactive?: boolean; // Incluir categorías inactivas
}

/**
 * DTO para obtener una categoría específica
 */
export interface GetCategoryDto {
  id: string;
}

/**
 * DTO de respuesta para una categoría
 */
export interface CategoryResponseDto {
  id: string;
  nombre: string;
  descripcion?: string;
  color?: string;
  icono?: string;
  activa: boolean;
  tiendaId?: string;
  tiendaNombre?: string; // Incluido para mostrar información de la tienda
  fechaCreacion: Date;
  fechaActualizacion: Date;
}

/**
 * DTO de respuesta para lista de categorías
 */
export interface CategoriesListResponseDto {
  categorias: CategoryResponseDto[];
  total: number;
  tienda?: {
    id: string;
    nombre: string;
  };
}

/**
 * DTO para búsqueda de categorías
 */
export interface SearchCategoriesDto {
  query?: string; // Buscar por nombre o descripción
  tiendaId?: string;
  color?: string;
  activa?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * DTO para cambiar el estado de una categoría
 */
export interface ToggleCategoryStatusDto {
  id: string;
  activa: boolean;
}

/**
 * DTO para mover categoría entre tiendas
 */
export interface MoveCategoryToStoreDto {
  id: string;
  tiendaId?: string; // null para mover a categorías generales
}