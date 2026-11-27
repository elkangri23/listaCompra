/**
 * Implementación del repositorio de códigos de restablecimiento de contraseña (item 9c)
 * usando Prisma. Sigue los patrones de PrismaMfaRepository.
 */

import type { PrismaClient } from '@prisma/client';
import type { Result } from '@shared/result';
import { success, failure } from '@shared/result';
import type { UUID } from '@shared/types';
import type {
  IPasswordResetCodeRepository,
  PasswordResetCodeData,
} from '@application/ports/repositories/IPasswordResetCodeRepository';

function toData(raw: {
  id: string;
  usuarioId: string;
  codeHash: string;
  intentos: number;
  expiraAt: Date;
  usado: boolean;
  usadoAt: Date | null;
  createdAt: Date;
}): PasswordResetCodeData {
  return {
    id: raw.id,
    usuarioId: raw.usuarioId,
    codeHash: raw.codeHash,
    intentos: raw.intentos,
    expiraAt: raw.expiraAt,
    usado: raw.usado,
    usadoAt: raw.usadoAt,
    createdAt: raw.createdAt,
  };
}

export class PrismaPasswordResetCodeRepository implements IPasswordResetCodeRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(params: {
    usuarioId: UUID;
    codeHash: string;
    ttlSeconds: number;
  }): Promise<Result<PasswordResetCodeData, Error>> {
    try {
      // Un solo código vivo por usuario: invalida los pendientes anteriores
      await this.prisma.passwordResetCode.updateMany({
        where: { usuarioId: params.usuarioId, usado: false },
        data: { usado: true },
      });

      const created = await this.prisma.passwordResetCode.create({
        data: {
          usuarioId: params.usuarioId,
          codeHash: params.codeHash,
          expiraAt: new Date(Date.now() + params.ttlSeconds * 1000),
        },
      });

      return success(toData(created));
    } catch (error) {
      return failure(error instanceof Error ? error : new Error('Error al crear el código de restablecimiento'));
    }
  }

  async findLatestPendingByUsuarioId(
    usuarioId: UUID
  ): Promise<Result<PasswordResetCodeData | null, Error>> {
    try {
      const raw = await this.prisma.passwordResetCode.findFirst({
        where: { usuarioId, usado: false, expiraAt: { gt: new Date() } },
        orderBy: { createdAt: 'desc' },
      });
      return success(raw ? toData(raw) : null);
    } catch (error) {
      return failure(error instanceof Error ? error : new Error('Error al buscar el código de restablecimiento'));
    }
  }

  async findLatestByUsuarioId(
    usuarioId: UUID
  ): Promise<Result<PasswordResetCodeData | null, Error>> {
    try {
      const raw = await this.prisma.passwordResetCode.findFirst({
        where: { usuarioId },
        orderBy: { createdAt: 'desc' },
      });
      return success(raw ? toData(raw) : null);
    } catch (error) {
      return failure(error instanceof Error ? error : new Error('Error al buscar el código de restablecimiento'));
    }
  }

  async incrementAttempts(id: string, maxAttempts: number): Promise<Result<number, Error>> {
    try {
      // Atómico: solo incrementa si intentos < max (0 filas = bloqueado/inexistente)
      const result = await this.prisma.passwordResetCode.updateMany({
        where: { id, usado: false, intentos: { lt: maxAttempts } },
        data: { intentos: { increment: 1 } },
      });
      if (result.count === 0) {
        return success(0);
      }
      const raw = await this.prisma.passwordResetCode.findUnique({
        where: { id },
        select: { intentos: true },
      });
      return success(raw?.intentos ?? 0);
    } catch (error) {
      return failure(error instanceof Error ? error : new Error('Error al incrementar intentos'));
    }
  }

  async markUsed(id: string): Promise<Result<void, Error>> {
    try {
      await this.prisma.passwordResetCode.update({
        where: { id },
        data: { usado: true, usadoAt: new Date() },
      });
      return success(undefined);
    } catch (error) {
      return failure(error instanceof Error ? error : new Error('Error al marcar el código como usado'));
    }
  }
}
