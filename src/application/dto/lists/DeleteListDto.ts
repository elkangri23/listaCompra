/**
 * DTOs para el caso de uso DeleteList
 */

export interface DeleteListDto {
  /**
   * Si es true, elimina la lista permanentemente de la base de datos
   * Si es false (por defecto), solo la marca como inactiva
   */
  permanente?: boolean;
}

export interface DeleteListResponseDto {
  /**
   * ID de la lista eliminada
   */
  id: string;

  /**
   * Indica si la lista fue eliminada exitosamente
   */
  eliminada: boolean;

  /**
   * Indica si fue una eliminación permanente o soft delete
   */
  permanente: boolean;

  /**
   * Fecha y hora de la eliminación en formato ISO
   */
  fechaEliminacion: string;

  /**
   * Mensaje descriptivo del resultado
   */
  mensaje: string;
}