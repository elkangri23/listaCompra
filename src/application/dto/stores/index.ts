/**
 * DTOs para la gestión de tiendas
 */

/**
 * DTO para crear una nueva tienda
 * Caso de uso: CU-26 - Gestión de tiendas
 */
export interface CreateStoreDto {
  nombre: string;
  direccion?: string;
  telefono?: string;
  sitioWeb?: string;
}

/**
 * DTO para actualizar una tienda existente
 */
export interface UpdateStoreDto {
  id: string;
  nombre?: string;
  direccion?: string;
  telefono?: string;
  sitioWeb?: string;
  activa?: boolean;
}

/**
 * DTO para eliminar una tienda
 */
export interface DeleteStoreDto {
  id: string;
}

/**
 * DTO para obtener tiendas
 */
export interface GetStoresDto {
  id?: string; // Para obtener una tienda específica
  activas?: boolean; // Filtrar solo tiendas activas
  includeInactive?: boolean; // Incluir tiendas inactivas
  withCategories?: boolean; // Incluir categorías asociadas
  limit?: number;
  offset?: number;
  page?: number;
  search?: string;
  tipo?: string;
}

/**
 * DTO para obtener una tienda específica
 */
export interface GetStoreDto {
  id: string;
  includeCategories?: boolean; // Incluir categorías de la tienda
}

/**
 * DTO de respuesta para una tienda
 */
export interface StoreResponseDto {
  id: string;
  nombre: string;
  direccion?: string;
  telefono?: string;
  sitioWeb?: string;
  activa: boolean;
  fechaCreacion: Date;
  fechaActualizacion: Date;
  categorias?: CategorySummaryDto[]; // Categorías asociadas si se solicitan
  totalCategorias?: number;
}

/**
 * DTO de respuesta resumida para categorías en tiendas
 */
export interface CategorySummaryDto {
  id: string;
  nombre: string;
  color?: string;
  icono?: string;
  activa: boolean;
}

/**
 * DTO de respuesta para lista de tiendas
 */
export interface StoresListResponseDto {
  tiendas: StoreResponseDto[];
  total: number;
}

/**
 * DTO para búsqueda de tiendas
 */
export interface SearchStoresDto {
  query?: string; // Buscar por nombre, dirección
  activa?: boolean;
  hasWebsite?: boolean; // Filtrar tiendas con sitio web
  hasPhysicalLocation?: boolean; // Filtrar tiendas con dirección física
  limit?: number;
  offset?: number;
}

/**
 * DTO para cambiar el estado de una tienda
 */
export interface ToggleStoreStatusDto {
  id: string;
  activa: boolean;
}

/**
 * DTO para estadísticas de tienda
 */
export interface StoreStatsDto {
  id: string;
  nombre: string;
  totalCategorias: number;
  categoriasActivas: number;
  categoriasInactivas: number;
  fechaUltimaCategoria?: Date;
}

/**
 * DTO para información completa de tienda con estadísticas
 */
export interface StoreDetailDto extends StoreResponseDto {
  stats: {
    totalCategorias: number;
    categoriasActivas: number;
    categoriasInactivas: number;
    fechaUltimaCategoria?: Date;
  };
}