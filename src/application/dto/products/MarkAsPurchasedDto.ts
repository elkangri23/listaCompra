/**
 * DTOs para el caso de uso MarkProductAsPurchased
 */

export interface MarkAsPurchasedDto {
  /**
   * Estado de comprado a establecer
   * true = marcar como comprado
   * false = marcar como no comprado
   */
  comprado: boolean;
}

export interface MarkAsPurchasedResponseDto {
  /**
   * ID del producto actualizado
   */
  id: string;

  /**
   * ID de la lista a la que pertenece el producto
   */
  listaId: string;

  /**
   * Nombre del producto
   */
  nombre: string;

  /**
   * Estado de comprado actualizado
   */
  comprado: boolean;

  /**
   * Fecha de compra en formato ISO (null si no está comprado)
   */
  fechaCompra?: string;

  /**
   * Fecha de última actualización en formato ISO
   */
  fechaActualizacion: string;

  /**
   * Mensaje descriptivo de la acción realizada
   */
  mensaje: string;
}