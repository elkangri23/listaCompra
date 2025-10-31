/**
 * Puerto (interface) para el servicio de hash de contraseñas
 * Define las operaciones criptográficas para el manejo seguro de contraseñas
 */

import type { Result } from '@shared/result';
import type { Password } from '@domain/value-objects/Password';

export interface IPasswordHasher {
  /**
   * Genera un hash seguro de la contraseña
   * @param password - Contraseña en texto plano
   * @returns Hash de la contraseña
   */
  hash(password: Password): Promise<Result<string, Error>>;

  /**
   * Verifica si una contraseña coincide con su hash
   * @param password - Contraseña en texto plano
   * @param hash - Hash almacenado
   * @returns true si la contraseña es correcta, false en caso contrario
   */
  verify(password: Password, hash: string): Promise<Result<boolean, Error>>;

  /**
   * Verifica si un hash necesita ser regenerado (por ejemplo, si el algoritmo cambió)
   * @param hash - Hash a verificar
   * @returns true si necesita regeneración, false en caso contrario
   */
  needsRehash(hash: string): Promise<Result<boolean, Error>>;
}