/**
 * DTOs para el caso de uso UpdateProduct
 */

export interface UpdateProductDto {
  /**
   * Nuevo nombre del producto
   * Máximo 200 caracteres
   */
  nombre?: string;

  /**
   * Nueva descripción del producto
   * Máximo 1000 caracteres
   */
  descripcion?: string;

  /**
   * Nueva cantidad del producto
   * Mínimo: 1, máximo: 999,999
   */
  cantidad?: number;

  /**
   * Nueva unidad de medida
   * Máximo 20 caracteres
   */
  unidad?: string;

  /**
   * Nuevo precio del producto
   * Mínimo: 0, máximo: 999,999.99
   */
  precio?: number;

  /**
   * Nuevo estado urgente
   */
  urgente?: boolean;

  /**
   * Nueva categoría del producto
   */
  categoriaId?: string;
}

export interface UpdateProductResponseDto {
  /**
   * ID del producto actualizado
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
   * Valor total actualizado (cantidad * precio)
   */
  valorTotal?: number;
}