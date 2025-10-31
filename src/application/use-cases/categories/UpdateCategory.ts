/**
 * Caso de uso: CU-13 - Actualizar categoría
 * Permite actualizar los datos de una categoría existente
 */

import type { Result } from '@shared/result';
import { success, failure } from '@shared/result';
import { InvalidValueError, BusinessRuleViolationError } from '@domain/errors/DomainError';
import type { ICategoriaRepository } from '@application/ports/repositories/ICategoriaRepository';
import type { ITiendaRepository } from '@application/ports/repositories/ITiendaRepository';
import type { UpdateCategoryDto, CategoryResponseDto } from '@application/dto/categories';

export class UpdateCategory {
  constructor(
    private readonly categoriaRepository: ICategoriaRepository,
    private readonly tiendaRepository: ITiendaRepository
  ) {}

  async execute(dto: UpdateCategoryDto): Promise<Result<CategoryResponseDto, InvalidValueError | BusinessRuleViolationError>> {
    // Buscar la categoría existente
    const categoriaResult = await this.categoriaRepository.findById(dto.id);
    if (categoriaResult.isFailure) {
      return failure(categoriaResult.error);
    }

    const categoria = categoriaResult.value;
    if (!categoria) {
      return failure(new InvalidValueError(
        'La categoría especificada no existe',
        'id',
        dto.id
      ));
    }

    // Validar nueva tienda si se proporciona
    if (dto.tiendaId !== undefined) {
      if (dto.tiendaId) {
        const tiendaResult = await this.tiendaRepository.findById(dto.tiendaId);
        if (tiendaResult.isFailure) {
          return failure(tiendaResult.error);
        }
        
        const tienda = tiendaResult.value;
        if (!tienda) {
          return failure(new InvalidValueError(
            'La tienda especificada no existe',
            'tiendaId',
            dto.tiendaId
          ));
        }

        if (!tienda.isActive()) {
          return failure(new BusinessRuleViolationError(
            'No se puede asignar una categoría a una tienda inactiva',
            'TIENDA_INACTIVA'
          ));
        }
      }
    }

    // Verificar nombre único si se está cambiando
    if (dto.nombre && dto.nombre !== categoria.nombre) {
      const tiendaIdToCheck = dto.tiendaId !== undefined ? dto.tiendaId : categoria.tiendaId;
      const existsResult = await this.categoriaRepository.existsByNombreAndTienda(
        dto.nombre,
        tiendaIdToCheck,
        dto.id
      );
      
      if (existsResult.isFailure) {
        return failure(existsResult.error);
      }

      if (existsResult.value) {
        return failure(new BusinessRuleViolationError(
          `Ya existe una categoría con el nombre "${dto.nombre}" en esta tienda`,
          'CATEGORIA_DUPLICADA'
        ));
      }
    }

    // Aplicar actualizaciones
    let hasErrors = false;
    const errors: string[] = [];

    // Actualizar nombre
    if (dto.nombre) {
      const nombreResult = categoria.updateNombre(dto.nombre);
      if (nombreResult.isFailure) {
        hasErrors = true;
        errors.push(nombreResult.error.message);
      }
    }

    // Actualizar descripción
    if (dto.descripcion !== undefined) {
      const descripcionResult = categoria.updateDescripcion(dto.descripcion);
      if (descripcionResult.isFailure) {
        hasErrors = true;
        errors.push(descripcionResult.error.message);
      }
    }

    // Actualizar color
    if (dto.color !== undefined) {
      const colorResult = categoria.updateColor(dto.color);
      if (colorResult.isFailure) {
        hasErrors = true;
        errors.push(colorResult.error.message);
      }
    }

    // Actualizar icono
    if (dto.icono !== undefined) {
      categoria.updateIcono(dto.icono);
    }

    // Actualizar estado activo
    if (dto.activa !== undefined) {
      if (dto.activa) {
        categoria.activar();
      } else {
        categoria.desactivar();
      }
    }

    // Actualizar tienda
    if (dto.tiendaId !== undefined) {
      if (dto.tiendaId) {
        categoria.assignToTienda(dto.tiendaId);
      } else {
        categoria.removeFromTienda();
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
    const updateResult = await this.categoriaRepository.update(categoria);
    if (updateResult.isFailure) {
      return failure(updateResult.error);
    }

    const updatedCategoria = updateResult.value;

    // Obtener nombre de la tienda si aplica
    let tiendaNombre: string | undefined;
    if (updatedCategoria.tiendaId) {
      const tiendaResult = await this.tiendaRepository.findById(updatedCategoria.tiendaId);
      if (tiendaResult.isSuccess && tiendaResult.value) {
        tiendaNombre = tiendaResult.value.nombre;
      }
    }

    // Construir respuesta
    const response: CategoryResponseDto = {
      id: updatedCategoria.id,
      nombre: updatedCategoria.nombre,
      activa: updatedCategoria.activa,
      fechaCreacion: updatedCategoria.fechaCreacion,
      fechaActualizacion: updatedCategoria.fechaActualizacion,
      ...(updatedCategoria.descripcion && { descripcion: updatedCategoria.descripcion }),
      ...(updatedCategoria.color && { color: updatedCategoria.color }),
      ...(updatedCategoria.icono && { icono: updatedCategoria.icono }),
      ...(updatedCategoria.tiendaId && { tiendaId: updatedCategoria.tiendaId }),
      ...(tiendaNombre && { tiendaNombre }),
    };

    return success(response);
  }
}