/**
 * Puerto para el repositorio de invitaciones
 * Define las operaciones de persistencia para invitaciones
 */

import type { Invitacion } from '@domain/entities/Invitacion';

export interface IInvitacionRepository {
  /**
   * Guarda una invitación
   */
  save(invitacion: Invitacion): Promise<void>;

  /**
   * Busca una invitación por su ID
   */
  findById(id: string): Promise<Invitacion | null>;

  /**
   * Busca una invitación por su hash
   */
  findByHash(hash: string): Promise<Invitacion | null>;

  /**
   * Busca todas las invitaciones de una lista
   */
  findByListaId(listaId: string): Promise<Invitacion[]>;

  /**
   * Busca invitaciones activas de una lista
   */
  findActiveByListaId(listaId: string): Promise<Invitacion[]>;

  /**
   * Obtiene todos los hashes activos (para verificar unicidad)
   */
  getAllActiveHashes(): Promise<string[]>;

  /**
   * Elimina una invitación
   */
  delete(id: string): Promise<void>;

  /**
   * Actualiza una invitación
   */
  update(invitacion: Invitacion): Promise<void>;

  /**
   * Busca invitaciones expiradas
   */
  findExpired(): Promise<Invitacion[]>;

  /**
   * Desactiva invitaciones expiradas
   */
  deactivateExpired(): Promise<number>;
}