/**
 * Puerto (interface) para el repositorio de usuarios
 * Define las operaciones de persistencia necesarias para la entidad Usuario
 */

import type { Result } from '@shared/result';
import type { UUID, PaginationParams, PaginationResult } from '@shared/types';
import type { Email } from '@domain/value-objects/Email';
import type { Usuario } from '@domain/entities/Usuario';

export interface IUsuarioRepository {
  /**
   * Guarda un nuevo usuario en el repositorio
   */
  save(usuario: Usuario): Promise<Result<Usuario, Error>>;

  /**
   * Actualiza un usuario existente
   */
  update(usuario: Usuario): Promise<Result<Usuario, Error>>;

  /**
   * Busca un usuario por su ID
   */
  findById(id: UUID): Promise<Result<Usuario | null, Error>>;

  /**
   * Busca un usuario por su email
   */
  findByEmail(email: Email): Promise<Result<Usuario | null, Error>>;

  /**
   * Verifica si existe un usuario con el email dado
   */
  existsByEmail(email: Email): Promise<Result<boolean, Error>>;

  /**
   * Busca usuarios con paginación
   */
  findAll(params: PaginationParams): Promise<Result<PaginationResult<Usuario>, Error>>;

  /**
   * Busca usuarios activos con paginación
   */
  findActive(params: PaginationParams): Promise<Result<PaginationResult<Usuario>, Error>>;

  /**
   * Busca usuarios por rol con paginación
   */
  findByRole(role: string, params: PaginationParams): Promise<Result<PaginationResult<Usuario>, Error>>;

  /**
   * Elimina un usuario por su ID (soft delete - marca como inactivo)
   */
  delete(id: UUID): Promise<Result<void, Error>>;

  /**
   * Elimina definitivamente un usuario (hard delete)
   * Solo para casos excepcionales como cumplimiento de GDPR
   */
  hardDelete(id: UUID): Promise<Result<void, Error>>;

  /**
   * Cuenta el total de usuarios registrados
   */
  count(): Promise<Result<number, Error>>;

  /**
   * Cuenta usuarios activos
   */
  countActive(): Promise<Result<number, Error>>;

  /**
   * Busca usuarios por término de búsqueda (nombre, apellidos, email)
   */
  search(term: string, params: PaginationParams): Promise<Result<PaginationResult<Usuario>, Error>>;
}