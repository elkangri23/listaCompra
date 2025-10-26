/**
 * Implementación del hasher de contraseñas usando bcrypt
 */

import * as bcrypt from 'bcrypt';
import type { Result } from '@shared/result';
import { success, failure } from '@shared/result';
import type { IPasswordHasher } from '@application/ports/auth/IPasswordHasher';
import type { Password } from '@domain/value-objects/Password';

export class BcryptPasswordHasher implements IPasswordHasher {
  private readonly SALT_ROUNDS = 12;
  private readonly MIN_COST = 10; // Mínimo para considerar si necesita rehash

  async hash(password: Password): Promise<Result<string, Error>> {
    try {
      const hash = await bcrypt.hash(password.value, this.SALT_ROUNDS);
      return success(hash);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido al hashear contraseña';
      return failure(new Error(`Error al hashear contraseña: ${errorMessage}`));
    }
  }

  async verify(password: Password, hash: string): Promise<Result<boolean, Error>> {
    try {
      // Validar que el hash no esté vacío
      if (!hash || typeof hash !== 'string') {
        return success(false);
      }

      const isValid = await bcrypt.compare(password.value, hash);
      return success(isValid);
    } catch (error) {
      // En caso de error, retornamos false por seguridad
      // pero también loggeamos el error para debugging
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido al verificar contraseña';
      return failure(new Error(`Error al verificar contraseña: ${errorMessage}`));
    }
  }

  async needsRehash(hash: string): Promise<Result<boolean, Error>> {
    try {
      // Validar que el hash no esté vacío
      if (!hash || typeof hash !== 'string') {
        return success(true); // Si no hay hash válido, necesita rehash
      }

      // Extraer el costo del hash (formato: $2b$XX$...)
      const costMatch = hash.match(/^\$2[aby]\$(\d{2})\$/);
      if (!costMatch) {
        return success(true); // Si no podemos determinar el costo, necesita rehash
      }

      const currentCost = parseInt(costMatch[1]!, 10);
      
      // Necesita rehash si el costo actual es menor al mínimo requerido
      const needsRehash = currentCost < this.MIN_COST;
      
      return success(needsRehash);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido al verificar si necesita rehash';
      return failure(new Error(`Error al verificar rehash: ${errorMessage}`));
    }
  }

  // Método adicional para validar el formato de un hash bcrypt
  isValidHash(hash: string): boolean {
    if (!hash || typeof hash !== 'string') {
      return false;
    }

    // Formato bcrypt: $2a$, $2b$, o $2y$ seguido de costo de 2 dígitos
    const bcryptRegex = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;
    return bcryptRegex.test(hash);
  }

  // Método para obtener el costo de un hash
  getHashCost(hash: string): number | null {
    const costMatch = hash.match(/^\$2[aby]\$(\d{2})\$/);
    return costMatch ? parseInt(costMatch[1]!, 10) : null;
  }
}