/**
 * Value Object para representar tipos de permisos
 * Define los diferentes niveles de acceso en el sistema
 */

import type { Result } from '@shared/result';
import { success, failure } from '@shared/result';
import { InvalidValueError } from '@domain/errors/DomainError';

export enum PermissionLevel {
  LECTURA = 'LECTURA',
  ESCRITURA = 'ESCRITURA', 
  ADMIN = 'ADMIN'
}

export class PermissionType {
  private constructor(private readonly _level: PermissionLevel) {}

  static create(level: string | PermissionLevel): Result<PermissionType, InvalidValueError> {
    // Normalizar entrada
    const normalizedLevel = typeof level === 'string' ? level.toUpperCase() : level;

    // Validar que sea un nivel válido
    if (!Object.values(PermissionLevel).includes(normalizedLevel as PermissionLevel)) {
      return failure(new InvalidValueError(
        `Tipo de permiso inválido: ${level}. Debe ser uno de: ${Object.values(PermissionLevel).join(', ')}`,
        'permissionType',
        level
      ));
    }

    return success(new PermissionType(normalizedLevel as PermissionLevel));
  }

  static createUnsafe(level: string | PermissionLevel): PermissionType {
    const result = PermissionType.create(level);
    if (result.isFailure) {
      throw result.error;
    }
    return result.value;
  }

  // Factory methods para los tipos más comunes
  static lectura(): PermissionType {
    return new PermissionType(PermissionLevel.LECTURA);
  }

  static escritura(): PermissionType {
    return new PermissionType(PermissionLevel.ESCRITURA);
  }

  static admin(): PermissionType {
    return new PermissionType(PermissionLevel.ADMIN);
  }

  get level(): PermissionLevel {
    return this._level;
  }

  get value(): string {
    return this._level;
  }

  equals(other: PermissionType): boolean {
    return this._level === other._level;
  }

  toString(): string {
    return this._level;
  }

  toJSON(): string {
    return this._level;
  }

  // Métodos para verificar permisos
  canRead(): boolean {
    return true; // Todos los tipos pueden leer
  }

  canWrite(): boolean {
    return this._level === PermissionLevel.ESCRITURA || this._level === PermissionLevel.ADMIN;
  }

  canAdmin(): boolean {
    return this._level === PermissionLevel.ADMIN;
  }

  // Verificar si tiene al menos cierto nivel de permiso
  hasLevel(requiredLevel: PermissionLevel): boolean {
    const hierarchy = {
      [PermissionLevel.LECTURA]: 1,
      [PermissionLevel.ESCRITURA]: 2,
      [PermissionLevel.ADMIN]: 3,
    };

    return hierarchy[this._level] >= hierarchy[requiredLevel];
  }

  // Obtener descripción amigable
  getDescription(): string {
    switch (this._level) {
      case PermissionLevel.LECTURA:
        return 'Solo lectura - Puede ver el contenido pero no modificarlo';
      case PermissionLevel.ESCRITURA:
        return 'Lectura y escritura - Puede ver y modificar el contenido';
      case PermissionLevel.ADMIN:
        return 'Administrador - Control total sobre el contenido y permisos';
      default:
        return 'Permiso desconocido';
    }
  }
}