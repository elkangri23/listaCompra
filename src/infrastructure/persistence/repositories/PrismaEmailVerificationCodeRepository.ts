/**
 * Implementación del repositorio de códigos de verificación de email (item 3)
 * usando Prisma. Sigue los patrones de PrismaMfaRepository.
 */

import type { PrismaClient } from '@prisma/client';
import type { Result } from '@shared/result';
import { success, failure } from '@shared/result';
import type { UUID } from '@shared/types';
import type {
  IEmailVerificationCodeRepository,
  EmailVerificationCodeData,
} from '@application/ports/repositories/IEmailVerificationCodeRepository';

function toData(raw: {
  id: string;
  usuarioId: string;
  codeHash: string;
  intentos: number;
  expiraAt: Date;
  usado: boolean;
  usadoAt: Date | null;
  createdAt: Date;
}): EmailVerificationCodeData {
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

export class PrismaEmailVerificationCodeRepository implements IEmailVerificationCodeRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(params: {
    usuarioId: UUID;
    codeHash: string;
    ttlSeconds: number;
  }): Promise<Result<EmailVerificationCodeData, Error>> {
    try {
      // Un solo código vivo por usuario: invalida los pendientes anteriores
      await this.prisma.emailVerificationCode.updateMany({
        where: { usuarioId: params.usuarioId, usado: false },
        data: { usado: true },
      });

      const created = await this.prisma.emailVerificationCode.create({
        data: {
          usuarioId: params.usuarioId,
          codeHash: params.codeHash,
          expiraAt: new Date(Date.now() + params.ttlSeconds * 1000),
        },
      });

      return success(toData(created));
    } catch (error) {
      return failure(error instanceof Error ? error : new Error('Error al crear el código de verificación'));
    }
  }

  async findLatestPendingByUsuarioId(
    usuarioId: UUID
  ): Promise<Result<EmailVerificationCodeData | null, Error>> {
    try {
      const raw = await this.prisma.emailVerificationCode.findFirst({
        where: { usuarioId, usado: false, expiraAt: { gt: new Date() } },
        orderBy: { createdAt: 'desc' },
      });
      return success(raw ? toData(raw) : null);
    } catch (error) {
      return failure(error instanceof Error ? error : new Error('Error al buscar el código de verificación'));
    }
  }

  async findLatestByUsuarioId(
    usuarioId: UUID
  ): Promise<Result<EmailVerificationCodeData | null, Error>> {
    try {
      const raw = await this.prisma.emailVerificationCode.findFirst({
        where: { usuarioId },
        orderBy: { createdAt: 'desc' },
      });
      return success(raw ? toData(raw) : null);
    } catch (error) {
      return failure(error instanceof Error ? error : new Error('Error al buscar el código de verificación'));
    }
  }

  async incrementAttempts(id: string, maxAttempts: number): Promise<Result<number, Error>> {
    try {
      // Atómico: solo incrementa si intentos < max (0 filas = bloqueado/inexistente)
      const result = await this.prisma.emailVerificationCode.updateMany({
        where: { id, usado: false, intentos: { lt: maxAttempts } },
        data: { intentos: { increment: 1 } },
      });
      if (result.count === 0) {
        return success(0);
      }
      const raw = await this.prisma.emailVerificationCode.findUnique({
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
      await this.prisma.emailVerificationCode.update({
        where: { id },
        data: { usado: true, usadoAt: new Date() },
      });
      return success(undefined);
    } catch (error) {
      return failure(error instanceof Error ? error : new Error('Error al marcar el código como usado'));
    }
  }
}
