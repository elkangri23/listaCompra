/**
 * Caso de uso: Crear nueva lista
 * Orquesta el proceso de creación de una nueva lista de compras
 */

import type { Result } from '@shared/result';
import { success, failure } from '@shared/result';
import type { IListaRepository } from '@application/ports/repositories/IListaRepository';
import type { CreateListDto, CreateListResponseDto } from '@application/dto/lists/CreateListDto';
import { Lista } from '@domain/entities/Lista';
import { ValidationError } from '@application/errors/ValidationError';
import { BusinessRuleViolationError } from '@domain/errors/DomainError';

export class CreateList {
  constructor(
    private readonly listaRepository: IListaRepository
  ) {}

  async execute(dto: CreateListDto, propietarioId: string): Promise<Result<CreateListResponseDto, ValidationError | BusinessRuleViolationError | Error>> {
    // 1. Validar datos básicos
    if (!dto.nombre || dto.nombre.trim().length === 0) {
      return failure(ValidationError.create(
        'El nombre de la lista es requerido',
        'nombre',
        dto.nombre
      ));
    }

    if (!propietarioId || propietarioId.trim().length === 0) {
      return failure(ValidationError.create(
        'El ID del propietario es requerido',
        'propietarioId',
        propietarioId
      ));
    }

    // 2. Verificar que no exista otra lista con el mismo nombre para este usuario
    const existsResult = await this.listaRepository.existsByNameAndOwner(dto.nombre.trim(), propietarioId);
    if (existsResult.isFailure) {
      return failure(existsResult.error);
    }

    if (existsResult.value) {
      return failure(ValidationError.create(
        'Ya existe una lista con ese nombre',
        'nombre',
        dto.nombre
      ));
    }

    // 3. Verificar límite de listas por usuario (regla de negocio: máximo 50 listas activas)
    const countResult = await this.listaRepository.countByOwner(propietarioId);
    if (countResult.isFailure) {
      return failure(countResult.error);
    }

    if (countResult.value >= 50) {
      return failure(new BusinessRuleViolationError(
        'Has alcanzado el límite máximo de listas (50). Elimina algunas listas antes de crear nuevas.',
        'MAX_LISTS_EXCEEDED'
      ));
    }

    // 4. Crear la entidad lista
    const listaResult = Lista.create({
      nombre: dto.nombre,
      ...(dto.descripcion && { descripcion: dto.descripcion }),
      propietarioId,
      ...(dto.tiendaId && { tiendaId: dto.tiendaId }),
    });

    if (listaResult.isFailure) {
      return failure(ValidationError.create(
        listaResult.error.message,
        'lista',
        dto
      ));
    }

    const lista = listaResult.value;

    // 5. Guardar la lista
    const saveResult = await this.listaRepository.save(lista);
    if (saveResult.isFailure) {
      return failure(saveResult.error);
    }

    const listaGuardada = saveResult.value;

    // 6. Retornar respuesta
    const response: CreateListResponseDto = {
      id: listaGuardada.id,
      nombre: listaGuardada.nombre,
      ...(listaGuardada.descripcion && { descripcion: listaGuardada.descripcion }),
      propietarioId: listaGuardada.propietarioId,
      ...(listaGuardada.tiendaId && { tiendaId: listaGuardada.tiendaId }),
      activa: listaGuardada.activa,
      fechaCreacion: listaGuardada.fechaCreacion.toISOString(),
      fechaActualizacion: listaGuardada.fechaActualizacion.toISOString(),
    };

    return success(response);
  }
}