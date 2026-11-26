/**
 * Puerto de repositorio de credenciales passkey (WebAuthn fase 2)
 */

import type { Result } from '@shared/result';
import type { UUID } from '@shared/types';

/** Datos de una credencial passkey persistida */
export interface PasskeyCredentialData {
  id: string;
  credentialId: string; // base64url
  usuarioId: UUID;
  publicKey: Buffer;
  contador: number;
  transports: string[];
  deviceType: string; // 'singleDevice' | 'multiDevice'
  aaguid: string | null;
  nombre: string;
  activo: boolean;
  createdAt: Date;
  ultimoUso: Date | null;
}

/** Datos nuevos para registrar una credencial tras verificar la ceremonia */
export interface NewPasskeyData {
  credentialId: string;
  usuarioId: UUID;
  publicKey: Buffer;
  contador: number;
  transports: string[];
  deviceType: string;
  aaguid: string | null;
  nombre: string;
}

export interface IPasskeyRepository {
  /** Crea una credencial nueva tras verificar la ceremonia de registro */
  create(data: NewPasskeyData): Promise<Result<PasskeyCredentialData, Error>>;

  /** Busca por credentialId WebAuthn (base64url) — uso en login */
  findByCredentialId(credentialId: string): Promise<Result<PasskeyCredentialData | null, Error>>;

  /** Busca por id interno */
  findById(id: string): Promise<Result<PasskeyCredentialData | null, Error>>;

  /** Lista todas las credenciales del usuario */
  listByUsuario(usuarioId: UUID): Promise<Result<PasskeyCredentialData[], Error>>;

  /** Cuenta credenciales activas del usuario (tope de registro) */
  countByUsuario(usuarioId: UUID): Promise<Result<number, Error>>;

  /** Renombra una credencial */
  rename(id: string, nombre: string): Promise<Result<void, Error>>;

  /** Persiste el contador observado + marca último uso (login normal) */
  updateCounterAndUsage(id: string, contador: number): Promise<Result<void, Error>>;

  /** Bloquea una credencial (regresión de contador = posible clon) */
  deactivate(id: string): Promise<Result<void, Error>>;

  /** Elimina una credencial */
  delete(id: string): Promise<Result<void, Error>>;
}
