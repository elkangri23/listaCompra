/**
 * Repositorio de copias de seguridad usando Prisma.
 *
 * Nota: el cliente Prisma se recibe como `unknown` y se proyecta al
 * delegado en vez de importar `PrismaClient` (mismo patrón que
 * PrismaLoginAttemptRepository, fase 5): en local no se puede ejecutar
 * `prisma generate` y el cliente generado no incluye todavía el modelo
 * nuevo, así que el import tipado rompería la compilación local. En CI
 * `prisma migrate deploy` + generate crean el delegado real.
 *
 * El delegado de `Backup` es `backup` (Prisma solo minúscula la primera
 * letra; aquí no hay trampa de doble mayúscula como con
 * `AIUsageEvent` → `aIUsageEvent`).
 */

import type {
  Backup,
  BackupUpdate,
  IBackupRepository,
  NewBackup,
  PaginatedBackups,
} from '../../../application/ports/repositories/IBackupRepository';

interface BackupDelegate {
  create(args: { data: NewBackup }): Promise<Backup>;
  findUnique(args: { where: { id: string } }): Promise<Backup | null>;
  findFirst(args: {
    where: Record<string, unknown>;
    orderBy: { createdAt: 'desc' };
  }): Promise<Backup | null>;
  findMany(args: {
    orderBy: { createdAt: 'desc' };
    skip?: number;
    take?: number;
  }): Promise<Backup[]>;
  count(): Promise<number>;
  update(args: { where: { id: string }; data: BackupUpdate }): Promise<Backup>;
}

export class PrismaBackupRepository implements IBackupRepository {
  private readonly delegate: BackupDelegate;

  constructor(prisma: unknown) {
    this.delegate = (prisma as { backup: BackupDelegate }).backup;
  }

  async save(backup: NewBackup): Promise<Backup> {
    return this.delegate.create({ data: backup });
  }

  async findById(id: string): Promise<Backup | null> {
    return this.delegate.findUnique({ where: { id } });
  }

  async findMany(page: number, pageSize: number): Promise<PaginatedBackups> {
    const [backups, total] = await Promise.all([
      this.delegate.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.delegate.count(),
    ]);

    return {
      backups,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async findPending(): Promise<Backup | null> {
    return this.delegate.findFirst({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findLatestCreated(): Promise<Backup | null> {
    return this.delegate.findFirst({
      where: { status: 'CREATED' },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findRestoring(): Promise<Backup | null> {
    return this.delegate.findFirst({
      where: { status: 'RESTORING', restoreRequestedAt: { not: null } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(id: string, patch: BackupUpdate): Promise<Backup | null> {
    try {
      return await this.delegate.update({ where: { id }, data: patch });
    } catch {
      return null;
    }
  }
}
