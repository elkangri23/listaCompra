/**
 * DTO para actualizar una lista existente
 */

export interface UpdateListDto {
  nombre?: string;
  descripcion?: string;
  tiendaId?: string;
}

export interface UpdateListResponseDto {
  id: string;
  nombre: string;
  descripcion?: string;
  propietarioId: string;
  tiendaId?: string;
  activa: boolean;
  fechaCreacion: string;
  fechaActualizacion: string;
}