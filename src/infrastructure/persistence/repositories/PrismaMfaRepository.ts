/**
 * Repositorio Prisma para MFA (TOTP fase 1)
 * Implementa IMfaRepository con operaciones atómicas para
 * challenges de un uso y códigos de respaldo.
 */

import type { PrismaClient } from '@prisma/client';
import type { IMfaRepository, MfaChallengeData, MfaBackupCodeData } from '@application/ports/repositories/IMfaRepository';
import type { UUID } from '@shared/types';
import { success, failure } from '@shared/result';
import type { Result } from '@shared/result';
import { MfaMapper } from '../mappers/MfaMapper';

export class PrismaMfaRepository implements IMfaRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createTotpChallenge(usuarioId: UUID, ttlSeconds: number): Promise<Result<MfaChallengeData, Error>> {
    try {
      // Un solo uso: revoca challenges TOTP VIVOS y expirados del usuario antes de crear
      await this.prisma.mfaChallenge.deleteMany({
        where: { usuarioId, tipo: 'TOTP' },
      });

      const created = await this.prisma.mfaChallenge.create({
        data: {
          usuarioId,
          tipo: 'TOTP',
          expiraAt: new Date(Date.now() + ttlSeconds * 1000),
        },
      });

      return success(MfaMapper.challengeToData(created));
    } catch (error) {
      return failure(error instanceof Error ? error : new Error('Error al crear challenge TOTP'));
    }
  }

  async findChallengeById(id: string): Promise<Result<MfaChallengeData | null, Error>> {
    try {
      const raw = await this.prisma.mfaChallenge.findUnique({ where: { id } });
      return success(raw ? MfaMapper.challengeToData(raw) : null);
    } catch (error) {
      return failure(error instanceof Error ? error : new Error('Error al buscar challenge'));
    }
  }

  async deleteChallenge(id: string): Promise<Result<void, Error>> {
    try {
      await this.prisma.mfaChallenge.deleteMany({ where: { id } });
      return success(undefined);
    } catch (error) {
      return failure(error instanceof Error ? error : new Error('Error al borrar challenge'));
    }
  }

  async incrementChallengeAttempts(id: string, maxAttempts: number): Promise<Result<number, Error>> {
    try {
      // Atómico: solo incrementa si intentos < max (0 filas actualizadas = bloqueado/inexistente)
      const result = await this.prisma.mfaChallenge.updateMany({
        where: { id, intentos: { lt: maxAttempts } },
        data: { intentos: { increment: 1 } },
      });
      if (result.count === 0) {
        return success(-1); // señal de bloqueado o inexistente
      }
      const raw = await this.prisma.mfaChallenge.findUnique({ where: { id }, select: { intentos: true } });
      return success(raw?.intentos ?? -1);
    } catch (error) {
      return failure(error instanceof Error ? error : new Error('Error al incrementar intentos'));
    }
  }

  async createWebauthnChallenge(params: {
    usuarioId: string | null;
    tipo: 'PASSKEY_REG' | 'PASSKEY_LOGIN';
    challenge: string;
    ttlSeconds: number;
  }): Promise<Result<MfaChallengeData, Error>> {
    try {
      // Un intento = una fila: revoca challenges vivos del mismo tipo primero
      if (params.usuarioId) {
        await this.prisma.mfaChallenge.deleteMany({
          where: { usuarioId: params.usuarioId, tipo: params.tipo },
        });
      }
      const created = await this.prisma.mfaChallenge.create({
        data: {
          ...(params.usuarioId && { usuarioId: params.usuarioId }),
          tipo: params.tipo,
          challenge: params.challenge,
          expiraAt: new Date(Date.now() + params.ttlSeconds * 1000),
        },
      });
      return success(MfaMapper.challengeToData(created));
    } catch (error) {
      return failure(error instanceof Error ? error : new Error('Error al crear challenge WebAuthn'));
    }
  }

  async revokeLiveChallenges(
    usuarioId: string,
    tipo: 'PASSKEY_REG' | 'PASSKEY_LOGIN'
  ): Promise<Result<void, Error>> {
    try {
      await this.prisma.mfaChallenge.deleteMany({ where: { usuarioId, tipo } });
      return success(undefined);
    } catch (error) {
      return failure(error instanceof Error ? error : new Error('Error al revocar challenges'));
    }
  }

  async deleteExpiredChallenges(): Promise<Result<number, Error>> {
    try {
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const result = await this.prisma.mfaChallenge.deleteMany({
        where: { expiraAt: { lt: cutoff } },
      });
      return success(result.count);
    } catch (error) {
      return failure(error instanceof Error ? error : new Error('Error en sweep de challenges'));
    }
  }

  async listActiveBackupCodes(usuarioId: UUID): Promise<Result<MfaBackupCodeData[], Error>> {
    try {
      const raws = await this.prisma.mfaBackupCode.findMany({
        where: { usuarioId, usado: false },
      });
      return success(raws.map(MfaMapper.backupCodeToData));
    } catch (error) {
      return failure(error instanceof Error ? error : new Error('Error al listar backup codes'));
    }
  }

  async replaceBackupCodes(usuarioId: UUID, codeHashes: string[]): Promise<Result<void, Error>> {
    try {
      await this.prisma.$transaction([
        this.prisma.mfaBackupCode.deleteMany({ where: { usuarioId } }),
        this.prisma.mfaBackupCode.createMany({
          data: codeHashes.map((codeHash) => ({ usuarioId, codeHash })),
        }),
      ]);
      return success(undefined);
    } catch (error) {
      return failure(error instanceof Error ? error : new Error('Error al crear backup codes'));
    }
  }

  async consumeBackupCode(id: string): Promise<Result<boolean, Error>> {
    try {
      // Atómico y de un solo uso: solo marca usado si aún no lo está (race-safe)
      const result = await this.prisma.mfaBackupCode.updateMany({
        where: { id, usado: false },
        data: { usado: true, usadoAt: new Date() },
      });
      return success(result.count > 0);
    } catch (error) {
      return failure(error instanceof Error ? error : new Error('Error al consumir backup code'));
    }
  }

  async countActiveBackupCodes(usuarioId: UUID): Promise<Result<number, Error>> {
    try {
      const count = await this.prisma.mfaBackupCode.count({ where: { usuarioId, usado: false } });
      return success(count);
    } catch (error) {
      return failure(error instanceof Error ? error : new Error('Error al contar backup codes'));
    }
  }

  async deleteBackupCodes(usuarioId: UUID): Promise<Result<void, Error>> {
    try {
      await this.prisma.mfaBackupCode.deleteMany({ where: { usuarioId } });
      return success(undefined);
    } catch (error) {
      return failure(error instanceof Error ? error : new Error('Error al borrar backup codes'));
    }
  }
}
