/**
 * Caso de uso: CU-26 - Actualizar tienda
 * Permite actualizar los datos de una tienda existente
 */

import type { Result } from '@shared/result';
import { success, failure } from '@shared/result';
import { InvalidValueError, BusinessRuleViolationError } from '@domain/errors/DomainError';
import type { ITiendaRepository } from '@application/ports/repositories/ITiendaRepository';
import type { UpdateStoreDto, StoreResponseDto } from '@application/dto/stores';

export class UpdateStore {
  constructor(
    private readonly tiendaRepository: ITiendaRepository
  ) {}

  async execute(dto: UpdateStoreDto): Promise<Result<StoreResponseDto, InvalidValueError | BusinessRuleViolationError>> {
    // Buscar la tienda existente
    const tiendaResult = await this.tiendaRepository.findById(dto.id);
    if (tiendaResult.isFailure) {
      return failure(tiendaResult.error);
    }

    const tienda = tiendaResult.value;
    if (!tienda) {
      return failure(new InvalidValueError(
        'La tienda especificada no existe',
        'id',
        dto.id
      ));
    }

    // Verificar nombre único si se está cambiando
    if (dto.nombre && dto.nombre !== tienda.nombre) {
      const existsResult = await this.tiendaRepository.existsByNombre(dto.nombre, dto.id);
      
      if (existsResult.isFailure) {
        return failure(existsResult.error);
      }

      if (existsResult.value) {
        return failure(new BusinessRuleViolationError(
          `Ya existe una tienda con el nombre "${dto.nombre}"`,
          'TIENDA_DUPLICADA'
        ));
      }
    }

    // Aplicar actualizaciones
    let hasErrors = false;
    const errors: string[] = [];

    // Actualizar nombre
    if (dto.nombre) {
      const nombreResult = tienda.updateNombre(dto.nombre);
      if (nombreResult.isFailure) {
        hasErrors = true;
        errors.push(nombreResult.error.message);
      }
    }

    // Actualizar dirección
    if (dto.direccion !== undefined) {
      const direccionResult = tienda.updateDireccion(dto.direccion);
      if (direccionResult.isFailure) {
        hasErrors = true;
        errors.push(direccionResult.error.message);
      }
    }

    // Actualizar teléfono
    if (dto.telefono !== undefined) {
      const telefonoResult = tienda.updateTelefono(dto.telefono);
      if (telefonoResult.isFailure) {
        hasErrors = true;
        errors.push(telefonoResult.error.message);
      }
    }

    // Actualizar sitio web
    if (dto.sitioWeb !== undefined) {
      const sitioWebResult = tienda.updateSitioWeb(dto.sitioWeb);
      if (sitioWebResult.isFailure) {
        hasErrors = true;
        errors.push(sitioWebResult.error.message);
      }
    }

    // Actualizar estado activo
    if (dto.activa !== undefined) {
      if (dto.activa) {
        tienda.activar();
      } else {
        tienda.desactivar();
      }
    }

    // Si hay errores de validación, devolverlos
    if (hasErrors) {
      return failure(new InvalidValueError(
        `Errores de validación: ${errors.join(', ')}`,
        'validacion',
        errors
      ));
    }

    // Guardar cambios
    const updateResult = await this.tiendaRepository.update(tienda);
    if (updateResult.isFailure) {
      return failure(updateResult.error);
    }

    const updatedTienda = updateResult.value;

    // Obtener estadísticas actualizadas
    let totalCategorias = 0;
    const statsResult = await this.tiendaRepository.getStats(updatedTienda.id);
    if (statsResult.isSuccess) {
      totalCategorias = statsResult.value.totalCategorias;
    }

    // Construir respuesta
    const response: StoreResponseDto = {
      id: updatedTienda.id,
      nombre: updatedTienda.nombre,
      activa: updatedTienda.activa,
      fechaCreacion: updatedTienda.fechaCreacion,
      fechaActualizacion: updatedTienda.fechaActualizacion,
      totalCategorias,
      ...(updatedTienda.direccion && { direccion: updatedTienda.direccion }),
      ...(updatedTienda.telefono && { telefono: updatedTienda.telefono }),
      ...(updatedTienda.sitioWeb && { sitioWeb: updatedTienda.sitioWeb }),
    };

    return success(response);
  }
}