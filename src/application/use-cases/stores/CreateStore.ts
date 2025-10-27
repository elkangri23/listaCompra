/**
 * Caso de uso: CU-26 - Crear tienda
 * Permite crear una nueva tienda donde se pueden organizar categorías
 */

import type { Result } from '@shared/result';
import { success, failure } from '@shared/result';
import { InvalidValueError, BusinessRuleViolationError } from '@domain/errors/DomainError';
import { Tienda } from '@domain/entities/Tienda';
import type { ITiendaRepository } from '@application/ports/repositories/ITiendaRepository';
import type { CreateStoreDto, StoreResponseDto } from '@application/dto/stores';

export class CreateStore {
  constructor(
    private readonly tiendaRepository: ITiendaRepository
  ) {}

  async execute(dto: CreateStoreDto): Promise<Result<StoreResponseDto, InvalidValueError | BusinessRuleViolationError>> {
    // Verificar que no existe otra tienda con el mismo nombre
    const existsResult = await this.tiendaRepository.existsByNombre(dto.nombre);
    
    if (existsResult.isFailure) {
      return failure(existsResult.error);
    }

    if (existsResult.value) {
      return failure(new BusinessRuleViolationError(
        `Ya existe una tienda con el nombre "${dto.nombre}"`,
        'TIENDA_DUPLICADA'
      ));
    }

    // Crear la entidad tienda
    const tiendaProps = {
      nombre: dto.nombre,
      ...(dto.direccion && { direccion: dto.direccion }),
      ...(dto.telefono && { telefono: dto.telefono }),
      ...(dto.sitioWeb && { sitioWeb: dto.sitioWeb }),
    };

    const tiendaResult = Tienda.create(tiendaProps);

    if (tiendaResult.isFailure) {
      return failure(tiendaResult.error);
    }

    const tienda = tiendaResult.value;

    // Guardar en el repositorio
    const saveResult = await this.tiendaRepository.save(tienda);
    if (saveResult.isFailure) {
      return failure(saveResult.error);
    }

    const savedTienda = saveResult.value;

    // Construir respuesta
    const response: StoreResponseDto = {
      id: savedTienda.id,
      nombre: savedTienda.nombre,
      activa: savedTienda.activa,
      fechaCreacion: savedTienda.fechaCreacion,
      fechaActualizacion: savedTienda.fechaActualizacion,
      totalCategorias: 0, // Nueva tienda no tiene categorías
      ...(savedTienda.direccion && { direccion: savedTienda.direccion }),
      ...(savedTienda.telefono && { telefono: savedTienda.telefono }),
      ...(savedTienda.sitioWeb && { sitioWeb: savedTienda.sitioWeb }),
    };

    return success(response);
  }
}