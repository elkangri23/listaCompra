export interface CreateListFromBlueprintDto {
  blueprintId: string;
  nombre: string;
  descripcion?: string;
  usuarioId: string;
}

export interface CreateListFromBlueprintResponseDto {
  id: string;
  nombre: string;
  descripcion?: string;
  fechaCreacion: Date;
  propietarioId: string;
}