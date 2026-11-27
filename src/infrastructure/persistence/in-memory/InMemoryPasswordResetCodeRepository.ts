/**
 * Repositorio en memoria de códigos de restablecimiento de contraseña (item 9c).
 * Misma semántica que PrismaPasswordResetCodeRepository, para el
 * entorno de tests (NODE_ENV=test), donde el container usa repos
 * en memoria y no hay PrismaClient.
 */
import { randomUUID } from 'node:crypto';

import type { Result } from '@shared/result';
import { success } from '@shared/result';
import type { UUID } from '@shared/types';
import type {
  IPasswordResetCodeRepository,
  PasswordResetCodeData,
} from '@application/ports/repositories/IPasswordResetCodeRepository';

export class InMemoryPasswordResetCodeRepository implements IPasswordResetCodeRepository {
  private readonly codigos = new Map<string, PasswordResetCodeData>();

  async create(params: {
    usuarioId: UUID;
    codeHash: string;
    ttlSeconds: number;
  }): Promise<Result<PasswordResetCodeData, Error>> {
    // Un solo código vivo por usuario: invalida los pendientes anteriores
    for (const codigo of this.codigos.values()) {
      if (codigo.usuarioId === params.usuarioId && !codigo.usado) {
        codigo.usado = true;
      }
    }

    const now = new Date();
    const created: PasswordResetCodeData = {
      id: randomUUID(),
      usuarioId: params.usuarioId,
      codeHash: params.codeHash,
      intentos: 0,
      expiraAt: new Date(now.getTime() + params.ttlSeconds * 1000),
      usado: false,
      usadoAt: null,
      createdAt: now,
    };
    this.codigos.set(created.id, created);
    return success(created);
  }

  async findLatestPendingByUsuarioId(
    usuarioId: UUID
  ): Promise<Result<PasswordResetCodeData | null, Error>> {
    const now = new Date();
    // El Map conserva el orden de inserción: el último insertado es el más reciente
    const pendientes = Array.from(this.codigos.values())
      .reverse()
      .filter((c) => c.usuarioId === usuarioId && !c.usado && c.expiraAt > now);
    return success(pendientes[0] ?? null);
  }

  async findLatestByUsuarioId(
    usuarioId: UUID
  ): Promise<Result<PasswordResetCodeData | null, Error>> {
    const delUsuario = Array.from(this.codigos.values())
      .reverse()
      .filter((c) => c.usuarioId === usuarioId);
    return success(delUsuario[0] ?? null);
  }

  async incrementAttempts(id: string, maxAttempts: number): Promise<Result<number, Error>> {
    const codigo = this.codigos.get(id);
    if (!codigo || codigo.usado || codigo.intentos >= maxAttempts) {
      return success(0);
    }
    codigo.intentos += 1;
    return success(codigo.intentos);
  }

  async markUsed(id: string): Promise<Result<void, Error>> {
    const codigo = this.codigos.get(id);
    if (codigo) {
      codigo.usado = true;
      codigo.usadoAt = new Date();
    }
    return success(undefined);
  }

  /**
   * Costura solo para tests e2e: fija un código conocido (su HMAC) en una
   * fila pendiente. El código real es aleatorio y nunca se conoce en claro.
   */
  setCodeHashForTest(id: string, codeHash: string): void {
    const codigo = this.codigos.get(id);
    if (codigo) {
      codigo.codeHash = codeHash;
    }
  }
}
