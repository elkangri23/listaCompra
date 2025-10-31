/**
 * DTOs para el caso de uso AddProduct
 */

export interface AddProductDto {
  /**
   * Nombre del producto (requerido)
   * Máximo 200 caracteres
   */
  nombre: string;

  /**
   * Descripción opcional del producto
   * Máximo 1000 caracteres
   */
  descripcion?: string;

  /**
   * Cantidad del producto
   * Por defecto: 1, mínimo: 1, máximo: 999,999
   */
  cantidad?: number;

  /**
   * Unidad de medida del producto
   * Máximo 20 caracteres
   */
  unidad?: string;

  /**
   * Precio del producto
   * Mínimo: 0, máximo: 999,999.99
   */
  precio?: number;

  /**
   * Indica si el producto es urgente
   * Por defecto: false
   */
  urgente?: boolean;

  /**
   * ID de la categoría del producto (opcional)
   */
  categoriaId?: string;

  /**
   * ID de la lista a la que pertenece el producto (requerido)
   */
  listaId: string;
}

export interface AddProductResponseDto {
  /**
   * ID del producto creado
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
   * ID de la lista
   */
  listaId: string;

  /**
   * ID de la categoría
   */
  categoriaId?: string;

  /**
   * ID del usuario que creó el producto
   */
  creadoPorId: string;

  /**
   * Fecha de creación en formato ISO
   */
  fechaCreacion: string;

  /**
   * Fecha de última actualización en formato ISO
   */
  fechaActualizacion: string;

  /**
   * Valor total (cantidad * precio)
   */
  valorTotal?: number;
}