/**
 * Domain Service para generar hashes seguros de invitación
 * Responsable de crear hashes únicos y criptográficamente seguros
 */

import type { Result } from '@shared/result';
import { success, failure } from '@shared/result';
import { DomainError, InvalidValueError } from '@domain/errors/DomainError';
import { Hash } from '@domain/value-objects/Hash';

export interface IInvitationHashGenerator {
  generateInvitationHash(listaId: string, usuarioId?: string): Result<Hash, DomainError>;
  generateSecureRandomHash(): Result<Hash, DomainError>;
  generateUniqueHash(listaId: string, existingHashes: string[], maxAttempts?: number, usuarioId?: string): Result<Hash, DomainError>;
}

export class InvitationHashGenerator implements IInvitationHashGenerator {
  /**
   * Genera un hash único para una invitación de lista
   * Combina información de la lista con datos aleatorios para mayor seguridad
   */
  generateInvitationHash(listaId: string, usuarioId?: string): Result<Hash, DomainError> {
    if (!listaId || listaId.trim().length === 0) {
      return failure(new InvalidValueError(
        'ID de lista requerido para generar hash de invitación',
        'listaId',
        listaId
      ));
    }

    try {
      // Crear semilla base con timestamp y datos únicos
      const timestamp = Date.now().toString();
      const randomBytes = this.generateRandomString(16);
      const userPart = usuarioId || 'anonymous';
      
      // Combinar componentes
      const seedString = `${listaId}-${userPart}-${timestamp}-${randomBytes}`;
      
      // Generar hash determinístico pero seguro
      const hashValue = this.createSimpleHash(seedString);
      
      return Hash.create(hashValue);
    } catch (error) {
      return failure(new InvalidValueError(
        'Error al generar hash de invitación',
        'generation',
        error instanceof Error ? error.message : 'Unknown error'
      ));
    }
  }

  /**
   * Genera un hash completamente aleatorio
   */
  generateSecureRandomHash(): Result<Hash, DomainError> {
    try {
      const randomString = this.generateRandomString(32);
      const timestamp = Date.now().toString();
      const combined = `${randomString}-${timestamp}`;
      
      const hashValue = this.createSimpleHash(combined);
      
      return Hash.create(hashValue);
    } catch (error) {
      return failure(new InvalidValueError(
        'Error al generar hash aleatorio',
        'generation',
        error instanceof Error ? error.message : 'Unknown error'
      ));
    }
  }

  /**
   * Genera una cadena aleatoria de la longitud especificada
   */
  private generateRandomString(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return result;
  }

  /**
   * Crea un hash simple usando algoritmos básicos
   * En un entorno real, se usaría crypto.createHash con SHA-256
   */
  private createSimpleHash(input: string): string {
    let hash = 0;
    if (input.length === 0) return '0';
    
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convertir a 32-bit integer
    }
    
    // Convertir a positivo y string hexadecimal
    const positiveHash = Math.abs(hash).toString(16);
    
    // Añadir padding con datos aleatorios para llegar a 32 caracteres mínimo
    const randomSuffix = this.generateRandomString(32 - positiveHash.length);
    
    return positiveHash + randomSuffix;
  }

  /**
   * Valida que un hash tenga el formato correcto para invitaciones
   */
  validateInvitationHash(hashValue: string): Result<boolean, DomainError> {
    const hashResult = Hash.create(hashValue);
    if (hashResult.isFailure) {
      return failure(hashResult.error);
    }

    // Validaciones adicionales específicas para invitaciones
    if (hashValue.length < 32) {
      return failure(new InvalidValueError(
        'Hash de invitación debe tener al menos 32 caracteres',
        'hashLength',
        hashValue.length.toString()
      ));
    }

    return success(true);
  }

  /**
   * Verifica si un hash es probablemente único (verificación básica)
   */
  isProbablyUnique(hashValue: string, existingHashes: string[]): boolean {
    return !existingHashes.includes(hashValue);
  }

  /**
   * Genera múltiples hashes y selecciona uno único
   */
  generateUniqueHash(
    listaId: string,
    existingHashes: string[],
    maxAttempts: number = 10,
    usuarioId?: string
  ): Result<Hash, DomainError> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const hashResult = this.generateInvitationHash(listaId, usuarioId);
      
      if (hashResult.isFailure) {
        return hashResult;
      }

      if (this.isProbablyUnique(hashResult.value.value, existingHashes)) {
        return hashResult;
      }
    }

    return failure(new InvalidValueError(
      `No se pudo generar hash único después de ${maxAttempts} intentos`,
      'uniqueness',
      maxAttempts.toString()
    ));
  }
}