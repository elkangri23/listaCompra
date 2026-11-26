/**
 * Puerto de repositorio de códigos de verificación de email (item 3)
 * Gestiona códigos de 6 dígitos de un solo uso con expiración e intentos.
 * Nunca se persiste el código en claro, solo su HMAC.
 */

import type { Result } from '@shared/result';
import type { UUID } from '@shared/types';

/** Datos de un código de verificación persistido (nunca el código en claro) */
export interface EmailVerificationCodeData {
  id: string;
  usuarioId: UUID;
  codeHash: string;
  intentos: number;
  expiraAt: Date;
  usado: boolean;
  usadoAt: Date | null;
  createdAt: Date;
}

export interface IEmailVerificationCodeRepository {
  /**
   * Crea un código nuevo para el usuario e invalida los pendientes
   * anteriores del mismo usuario (un solo código vivo por usuario).
   */
  create(params: {
    usuarioId: UUID;
    codeHash: string;
    ttlSeconds: number;
  }): Promise<Result<EmailVerificationCodeData, Error>>;

  /** Último código pendiente (no usado, no caducado) del usuario, si lo hay */
  findLatestPendingByUsuarioId(
    usuarioId: UUID
  ): Promise<Result<EmailVerificationCodeData | null, Error>>;

  /** Último código creado para el usuario (para el enfriamiento de reenvío) */
  findLatestByUsuarioId(
    usuarioId: UUID
  ): Promise<Result<EmailVerificationCodeData | null, Error>>;

  /**
   * Incremento de intentos con cap; devuelve los intentos tras incrementar.
   * Si el código ya no existe o está usado, devuelve 0.
   */
  incrementAttempts(
    id: string,
    maxAttempts: number
  ): Promise<Result<number, Error>>;

  /** Marca el código como usado (consumo tras verificar con éxito) */
  markUsed(id: string): Promise<Result<void, Error>>;
}
