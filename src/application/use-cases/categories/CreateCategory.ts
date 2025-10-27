/**
 * Caso de uso: CU-11 - Crear categoría
 * Permite crear una nueva categoría para organizar productos
 */

import type { Result } from '@shared/result';
import { success, failure } from '@shared/result';
import { InvalidValueError, BusinessRuleViolationError } from '@domain/errors/DomainError';
import { Categoria } from '@domain/entities/Categoria';
import type { ICategoriaRepository } from '@application/ports/repositories/ICategoriaRepository';
import type { ITiendaRepository } from '@application/ports/repositories/ITiendaRepository';
import type { CreateCategoryDto, CategoryResponseDto } from '@application/dto/categories';

export class CreateCategory {
  constructor(
    private readonly categoriaRepository: ICategoriaRepository,
    private readonly tiendaRepository: ITiendaRepository
  ) {}

  async execute(dto: CreateCategoryDto): Promise<Result<CategoryResponseDto, InvalidValueError | BusinessRuleViolationError>> {
    // Validar que la tienda existe si se proporciona
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
          'No se puede crear una categoría en una tienda inactiva',
          'TIENDA_INACTIVA'
        ));
      }
    }

    // Verificar que no existe otra categoría con el mismo nombre en la misma tienda
    const existsResult = await this.categoriaRepository.existsByNombreAndTienda(
      dto.nombre,
      dto.tiendaId || null
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

    // Crear la entidad categoría
    const categoriaProps = {
      nombre: dto.nombre,
      ...(dto.descripcion && { descripcion: dto.descripcion }),
      ...(dto.color && { color: dto.color }),
      ...(dto.icono && { icono: dto.icono }),
      ...(dto.tiendaId && { tiendaId: dto.tiendaId }),
    };

    const categoriaResult = Categoria.create(categoriaProps);

    if (categoriaResult.isFailure) {
      return failure(categoriaResult.error);
    }

    const categoria = categoriaResult.value;

    // Guardar en el repositorio
    const saveResult = await this.categoriaRepository.save(categoria);
    if (saveResult.isFailure) {
      return failure(saveResult.error);
    }

    const savedCategoria = saveResult.value;

    // Obtener nombre de la tienda si aplica
    let tiendaNombre: string | undefined;
    if (dto.tiendaId) {
      const tiendaResult = await this.tiendaRepository.findById(dto.tiendaId);
      if (tiendaResult.isSuccess && tiendaResult.value) {
        tiendaNombre = tiendaResult.value.nombre;
      }
    }

    // Construir respuesta
    const response: CategoryResponseDto = {
      id: savedCategoria.id,
      nombre: savedCategoria.nombre,
      activa: savedCategoria.activa,
      fechaCreacion: savedCategoria.fechaCreacion,
      fechaActualizacion: savedCategoria.fechaActualizacion,
      ...(savedCategoria.descripcion && { descripcion: savedCategoria.descripcion }),
      ...(savedCategoria.color && { color: savedCategoria.color }),
      ...(savedCategoria.icono && { icono: savedCategoria.icono }),
      ...(savedCategoria.tiendaId && { tiendaId: savedCategoria.tiendaId }),
      ...(tiendaNombre && { tiendaNombre }),
    };

    return success(response);
  }
}