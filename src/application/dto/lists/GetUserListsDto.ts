/**
 * DTO para obtener listas del usuario
 */

import type { ListaSortOption } from '@application/ports/repositories/IListaRepository';
export type { ListaSortField, ListaSortDirection, ListaSortOption } from '@application/ports/repositories/IListaRepository';

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
  busqueda?: string;
  fechaCreacionDesde?: string;
  fechaCreacionHasta?: string;
  fechaActualizacionDesde?: string;
  fechaActualizacionHasta?: string;
  sort?: ListaSortOption[];
  page?: number;
  limit?: number;
}