import { ProductoPlantilla } from '../../../domain/entities/Blueprint';

export interface CreateBlueprintDto {
  nombre: string;
  descripcion?: string;
  publico: boolean;
  productos: ProductoPlantilla[];
  creadoPorId: string;
}

export interface CreateBlueprintResponseDto {
  id: string;
  nombre: string;
  descripcion?: string;
  publico: boolean;
  productos: ProductoPlantilla[];
  fechaCreacion: Date;
  fechaActualizacion: Date;
  creadoPorId: string;
}