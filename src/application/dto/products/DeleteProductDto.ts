/**
 * DTOs para el caso de uso DeleteProduct
 */

export interface DeleteProductDto {
  /**
   * Si es true, elimina el producto permanentemente de la base de datos
   * Si es false (por defecto), solo lo marca como eliminado (soft delete)
   * Nota: En productos, típicamente se hace hard delete directo
   */
  permanente?: boolean;
}

export interface DeleteProductResponseDto {
  /**
   * ID del producto eliminado
   */
  id: string;

  /**
   * Indica si el producto fue eliminado exitosamente
   */
  eliminado: boolean;

  /**
   * Indica si fue una eliminación permanente
   */
  permanente: boolean;

  /**
   * Fecha de eliminación en formato ISO
   */
  fechaEliminacion: string;

  /**
   * Mensaje descriptivo del resultado
   */
  mensaje: string;
}