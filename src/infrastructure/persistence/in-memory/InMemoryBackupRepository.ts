/**
 * Repositorio en memoria de copias de seguridad.
 * Misma semántica que PrismaBackupRepository, para el entorno de tests
 * (NODE_ENV=test), donde el container usa repos en memoria y no hay
 * PrismaClient.
 */
import { randomUUID } from 'node:crypto';

import type {
  Backup,
  BackupUpdate,
  IBackupRepository,
  NewBackup,
  PaginatedBackups,
} from '../../../application/ports/repositories/IBackupRepository';

export class InMemoryBackupRepository implements IBackupRepository {
  private readonly backups = new Map<string, Backup>();

  async save(backup: NewBackup): Promise<Backup> {
    const created: Backup = {
      id: randomUUID(),
      ...backup,
      createdAt: new Date(),
    };
    this.backups.set(created.id, created);
    return created;
  }

  async findById(id: string): Promise<Backup | null> {
    return this.backups.get(id) ?? null;
  }

  async findMany(page: number, pageSize: number): Promise<PaginatedBackups> {
    const sorted = Array.from(this.backups.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
    const total = sorted.length;
    const start = (page - 1) * pageSize;
    return {
      backups: sorted.slice(start, start + pageSize),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async findPending(): Promise<Backup | null> {
    return (
      Array.from(this.backups.values())
        .filter((b) => b.status === 'PENDING')
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] ?? null
    );
  }

  async findLatestCreated(): Promise<Backup | null> {
    return (
      Array.from(this.backups.values())
        .filter((b) => b.status === 'CREATED')
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] ?? null
    );
  }

  async findRestoring(): Promise<Backup | null> {
    return (
      Array.from(this.backups.values())
        .filter((b) => b.status === 'RESTORING' && b.restoreRequestedAt !== null)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] ?? null
    );
  }

  async update(id: string, patch: BackupUpdate): Promise<Backup | null> {
    const existing = this.backups.get(id);
    if (!existing) {
      return null;
    }
    const updated: Backup = { ...existing, ...patch };
    this.backups.set(id, updated);
    return updated;
  }
}
