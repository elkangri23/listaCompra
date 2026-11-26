/**
 * Repositorio Prisma para credenciales passkey (WebAuthn fase 2)
 */

import type { PrismaClient, PasskeyCredential } from '@prisma/client';
import type {
  IPasskeyRepository,
  PasskeyCredentialData,
  NewPasskeyData,
} from '@application/ports/repositories/IPasskeyRepository';
import type { UUID } from '@shared/types';
import { success, failure } from '@shared/result';
import type { Result } from '@shared/result';

export class PasskeyMapper {
  static credentialToData(raw: PasskeyCredential): PasskeyCredentialData {
    return {
      id: raw.id,
      credentialId: raw.credentialId,
      usuarioId: raw.usuarioId,
      publicKey: Buffer.from(raw.publicKey),
      contador: raw.contador,
      transports: raw.transports,
      deviceType: raw.deviceType,
      aaguid: raw.aaguid,
      nombre: raw.nombre,
      activo: raw.activo,
      createdAt: raw.createdAt,
      ultimoUso: raw.ultimoUso,
    };
  }
}

export class PrismaPasskeyRepository implements IPasskeyRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: NewPasskeyData): Promise<Result<PasskeyCredentialData, Error>> {
    try {
      const created = await this.prisma.passkeyCredential.create({ data });
      return success(PasskeyMapper.credentialToData(created));
    } catch (error) {
      return failure(error instanceof Error ? error : new Error('Error al crear passkey'));
    }
  }

  async findByCredentialId(credentialId: string): Promise<Result<PasskeyCredentialData | null, Error>> {
    try {
      const raw = await this.prisma.passkeyCredential.findUnique({ where: { credentialId } });
      return success(raw ? PasskeyMapper.credentialToData(raw) : null);
    } catch (error) {
      return failure(error instanceof Error ? error : new Error('Error al buscar passkey'));
    }
  }

  async findById(id: string): Promise<Result<PasskeyCredentialData | null, Error>> {
    try {
      const raw = await this.prisma.passkeyCredential.findUnique({ where: { id } });
      return success(raw ? PasskeyMapper.credentialToData(raw) : null);
    } catch (error) {
      return failure(error instanceof Error ? error : new Error('Error al buscar passkey'));
    }
  }

  async listByUsuario(usuarioId: UUID): Promise<Result<PasskeyCredentialData[], Error>> {
    try {
      const rows = await this.prisma.passkeyCredential.findMany({
        where: { usuarioId },
        orderBy: { createdAt: 'asc' },
      });
      return success(rows.map(PasskeyMapper.credentialToData));
    } catch (error) {
      return failure(error instanceof Error ? error : new Error('Error al listar passkeys'));
    }
  }

  async countByUsuario(usuarioId: UUID): Promise<Result<number, Error>> {
    try {
      const count = await this.prisma.passkeyCredential.count({ where: { usuarioId, activo: true } });
      return success(count);
    } catch (error) {
      return failure(error instanceof Error ? error : new Error('Error al contar passkeys'));
    }
  }

  async rename(id: string, nombre: string): Promise<Result<void, Error>> {
    try {
      await this.prisma.passkeyCredential.update({ where: { id }, data: { nombre } });
      return success(undefined);
    } catch (error) {
      return failure(error instanceof Error ? error : new Error('Error al renombrar passkey'));
    }
  }

  async updateCounterAndUsage(id: string, contador: number): Promise<Result<void, Error>> {
    try {
      await this.prisma.passkeyCredential.update({
        where: { id },
        data: { contador, ultimoUso: new Date() },
      });
      return success(undefined);
    } catch (error) {
      return failure(error instanceof Error ? error : new Error('Error al actualizar contador'));
    }
  }

  async deactivate(id: string): Promise<Result<void, Error>> {
    try {
      await this.prisma.passkeyCredential.update({ where: { id }, data: { activo: false } });
      return success(undefined);
    } catch (error) {
      return failure(error instanceof Error ? error : new Error('Error al desactivar passkey'));
    }
  }

  async delete(id: string): Promise<Result<void, Error>> {
    try {
      await this.prisma.passkeyCredential.delete({ where: { id } });
      return success(undefined);
    } catch (error) {
      return failure(error instanceof Error ? error : new Error('Error al eliminar passkey'));
    }
  }
}
