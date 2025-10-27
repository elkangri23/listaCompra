/**
 * DTO para crear una nueva lista
 */

export interface CreateListDto {
  nombre: string;
  descripcion?: string;
  tiendaId?: string;
}

export interface CreateListResponseDto {
  id: string;
  nombre: string;
  descripcion?: string;
  propietarioId: string;
  tiendaId?: string;
  activa: boolean;
  fechaCreacion: string;
  fechaActualizacion: string;
}