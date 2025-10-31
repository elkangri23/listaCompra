/**
 * DTOs para consultas de productos
 */

export interface GetProductsDto {
  /**
   * ID de la lista para filtrar productos
   */
  listaId: string;

  /**
   * Número de página (por defecto: 1)
   */
  page?: number;

  /**
   * Elementos por página (por defecto: 20, máximo: 100)
   */
  limit?: number;

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

export interface ProductoListDto {
  /**
   * ID del producto
   */
  id: string;

  /**
   * Nombre del producto
   */
  nombre: string;

  /**
   * Descripción del producto
   */
  descripcion?: string;

  /**
   * Cantidad del producto
   */
  cantidad: number;

  /**
   * Unidad de medida
   */
  unidad?: string;

  /**
   * Precio del producto
   */
  precio?: number;

  /**
   * Estado de comprado
   */
  comprado: boolean;

  /**
   * Si es urgente
   */
  urgente: boolean;

  /**
   * ID de la categoría
   */
  categoriaId?: string;

  /**
   * Fecha de creación en formato ISO
   */
  fechaCreacion: string;

  /**
   * Fecha de compra en formato ISO (si está comprado)
   */
  fechaCompra?: string;

  /**
   * Valor total (cantidad * precio)
   */
  valorTotal?: number;
}

export interface GetProductsResponseDto {
  /**
   * Lista de productos
   */
  items: ProductoListDto[];

  /**
   * Total de productos encontrados
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

  /**
   * Resumen de estados
   */
  resumen: {
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
    valorTotal?: number;
  };
}