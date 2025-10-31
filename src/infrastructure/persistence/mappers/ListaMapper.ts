/**
 * Mapper para convertir entre entidad Lista de dominio y modelo de persistencia
 */

import type { Result } from '@shared/result';
import { success, failure } from '@shared/result';
import { Lista } from '@domain/entities/Lista';
import { InvalidValueError, BusinessRuleViolationError } from '@domain/errors/DomainError';

export class ListaMapper {
  /**
   * Convierte de entidad de dominio a modelo de persistencia
   */
  static toPersistence(lista: Lista) {
    return {
      id: lista.id,
      nombre: lista.nombre,
      descripcion: lista.descripcion,
      propietarioId: lista.propietarioId,
      activa: lista.activa,
      fechaCreacion: lista.fechaCreacion,
      fechaActualizacion: lista.fechaActualizacion,
    };
  }

  /**
   * Convierte de modelo de persistencia a entidad de dominio
   */
  static toDomain(data: any): Result<Lista, InvalidValueError | BusinessRuleViolationError> {
    try {
      return Lista.create({
        id: data.id,
        nombre: data.nombre,
        descripcion: data.descripcion,
        propietarioId: data.propietarioId,
        activa: data.activa,
        fechaCreacion: data.fechaCreacion,
        fechaActualizacion: data.fechaActualizacion,
      });
    } catch (error) {
      return failure(new InvalidValueError(
        'Error al mapear datos de persistencia a entidad Lista',
        'data',
        data
      ));
    }
  }

  /**
   * Convierte múltiples entidades de dominio a modelos de persistencia
   */
  static toPersistenceArray(listas: Lista[]) {
    return listas.map(lista => this.toPersistence(lista));
  }

  /**
   * Convierte múltiples modelos de persistencia a entidades de dominio
   */
  static toDomainArray(data: any[]): Result<Lista[], InvalidValueError | BusinessRuleViolationError> {
    const listas: Lista[] = [];
    
    for (const item of data) {
      const listaResult = this.toDomain(item);
      if (listaResult.isFailure) {
        return failure(listaResult.error);
      }
      listas.push(listaResult.value);
    }
    
    return success(listas);
  }
}