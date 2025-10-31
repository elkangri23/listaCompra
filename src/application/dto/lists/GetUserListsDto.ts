/**
 * DTO para obtener listas del usuario
 */

export interface GetUserListsResponseDto {
  id: string;
  nombre: string;
  descripcion?: string;
  propietarioId: string;
  tiendaId?: string;
  tiendaNombre?: string;
  activa: boolean;
  fechaCreacion: string;
  fechaActualizacion: string;
  totalProductos?: number;
  productosComprados?: number;
}

export interface GetUserListsDto {
  activa?: boolean;
  tiendaId?: string;
  page?: number;
  limit?: number;
}