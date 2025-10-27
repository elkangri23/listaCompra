/**
 * Puerto para el repositorio de permisos
 * Define las operaciones de persistencia para permisos de usuarios sobre listas
 */

import type { Permiso } from '@domain/entities/Permiso';

export interface IPermisoRepository {
  /**
   * Guarda un permiso
   */
  save(permiso: Permiso): Promise<void>;

  /**
   * Busca un permiso por su ID
   */
  findById(id: string): Promise<Permiso | null>;

  /**
   * Busca permisos de un usuario específico
   */
  findByUsuarioId(usuarioId: string): Promise<Permiso[]>;

  /**
   * Busca permisos de una lista específica
   */
  findByListaId(listaId: string): Promise<Permiso[]>;

  /**
   * Busca permisos de un usuario sobre una lista específica
   */
  findByUsuarioAndLista(usuarioId: string, listaId: string): Promise<Permiso[]>;

  /**
   * Busca un permiso específico por usuario y lista (debería ser único)
   */
  findUniqueByUsuarioAndLista(usuarioId: string, listaId: string): Promise<Permiso | null>;

  /**
   * Actualiza un permiso
   */
  update(permiso: Permiso): Promise<void>;

  /**
   * Elimina un permiso
   */
  delete(id: string): Promise<void>;

  /**
   * Elimina todos los permisos de un usuario sobre una lista
   */
  deleteByUsuarioAndLista(usuarioId: string, listaId: string): Promise<void>;

  /**
   * Elimina todos los permisos de una lista
   */
  deleteByListaId(listaId: string): Promise<void>;

  /**
   * Verifica si un usuario tiene algún permiso sobre una lista
   */
  hasPermission(usuarioId: string, listaId: string): Promise<boolean>;

  /**
   * Verifica si un usuario tiene un tipo específico de permiso sobre una lista
   */
  hasPermissionType(usuarioId: string, listaId: string, tipoPermiso: string): Promise<boolean>;
}