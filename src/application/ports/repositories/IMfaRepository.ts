/**
 * Puerto de repositorio MFA (TOTP fase 1)
 * Gestiona challenges de login de un solo uso y códigos de respaldo.
 */

import type { Result } from '@shared/result';
import type { UUID } from '@shared/types';

/** Datos de un challenge MFA persistido */
export interface MfaChallengeData {
  id: string;
  usuarioId: string | null;
  tipo: 'TOTP' | 'PASSKEY_REG' | 'PASSKEY_LOGIN';
  challenge: string | null;
  intentos: number;
  expiraAt: Date;
}

/** Datos de un código de respaldo persistido (nunca el código en claro) */
export interface MfaBackupCodeData {
  id: string;
  usuarioId: UUID;
  codeHash: string;
  usado: boolean;
  usadoAt: Date | null;
}

export interface IMfaRepository {
  /**
   * Crea un challenge WebAuthn (PASSKEY_REG | PASSKEY_LOGIN) con el challenge
   * base64url persistido para poder verificarlo en el verify (fase 2).
   * usuarioId null para PASSKEY_LOGIN (login usernameless).
   */
  createWebauthnChallenge(params: {
    usuarioId: string | null;
    tipo: 'PASSKEY_REG' | 'PASSKEY_LOGIN';
    challenge: string;
    ttlSeconds: number;
  }): Promise<Result<MfaChallengeData, Error>>;

  /** Revoca challenges vivos de un tipo para un usuario (un uso por intento) */
  revokeLiveChallenges(usuarioId: string, tipo: 'PASSKEY_REG' | 'PASSKEY_LOGIN'): Promise<Result<void, Error>>;

  /** Cuenta credenciales passkey activas del usuario (para GetMfaStatus) */

  /**
   * Crea un challenge TOTP nuevo para el usuario y BORRA los challenges TOTP
   * vivos previos del mismo usuario (revocación de un uso).
   */
  createTotpChallenge(usuarioId: UUID, ttlSeconds: number): Promise<Result<MfaChallengeData, Error>>;

  /** Busca un challenge por id */
  findChallengeById(id: string): Promise<Result<MfaChallengeData | null, Error>>;

  /** Borra un challenge (consumo tras éxito o tras fallo definitivo) */
  deleteChallenge(id: string): Promise<Result<void, Error>>;

  /** Incremento atómico de intentos con cap; 0 filas = bloqueado/inyexistente */
  incrementChallengeAttempts(id: string, maxAttempts: number): Promise<Result<number, Error>>;

  /** Sweeper: borra challenges expirados hace más de 1 día */
  deleteExpiredChallenges(): Promise<Result<number, Error>>;

  /** Lista los códigos de respaldo NO usados de un usuario */
  listActiveBackupCodes(usuarioId: UUID): Promise<Result<MfaBackupCodeData[], Error>>;

  /** Reemplaza todos los códigos de respaldo del usuario (emisión inicial/regeneración) */
  replaceBackupCodes(usuarioId: UUID, codeHashes: string[]): Promise<Result<void, Error>>;

  /** Consume un código por id (de un uso, atómico: solo si usado=false). 0 filas = ya usado */
  consumeBackupCode(id: string): Promise<Result<boolean, Error>>;

  /** Cuenta códigos no usados restantes */
  countActiveBackupCodes(usuarioId: UUID): Promise<Result<number, Error>>;

  /** Elimina todos los backup codes del usuario (al desactivar TOTP) */
  deleteBackupCodes(usuarioId: UUID): Promise<Result<void, Error>>;
}
