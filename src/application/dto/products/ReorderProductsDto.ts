/**
 * DTOs para el caso de uso ReorderProducts
 */

export interface ReorderProductsDto {
  /**
   * ID de la lista cuyos productos se reordenan
   */
  listaId: string;

  /**
   * Orden final de los productos.
   * La posición comienza en 1. El frontend envía la lista completa
   * reordenada (fletchas ↑ ↓ y arrastre táctil); si algún producto de la
   * lista no viene en el payload, el caso de uso lo deja después de los
   * reordenados, en su orden actual. Los huecos en las posiciones se
   * normalizan a 1..N en el orden indicado por `posicion`.
   */
  orden: Array<{
    /** ID del producto a reordenar */
    productoId: string;
    /** Nueva posición (1-indexada) */
    posicion: number;
  }>;
}

export interface ReorderProductsResponseDto {
  /** ID de la lista afectada */
  listaId: string;

  /**
   * Lista de productos confirmados con su nueva posición, en el orden
   * final (primero los reordenados, luego los no incluidos si los había).
   */
  productos: Array<{
    id: string;
    posicion: number;
  }>;

  /** Mensaje informativo */
  mensaje: string;
}
