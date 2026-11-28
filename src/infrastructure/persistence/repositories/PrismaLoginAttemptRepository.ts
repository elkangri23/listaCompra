/**
 * Repositorio de intentos de inicio de sesión usando Prisma.
 *
 * Nota: el cliente Prisma se recibe como `unknown` y se proyecta al
 * delegado en vez de importar `PrismaClient` (mismo patrón que
 * PrismaAIUsageEventRepository, fase 3): en local no se puede ejecutar
 * `prisma generate` y el cliente generado no incluye todavía el modelo
 * nuevo, así que el import tipado rompería la compilación local. En CI
 * `prisma migrate deploy` + generate crean el delegado real.
 *
 * El delegado de `LoginAttempt` es `loginAttempt` (Prisma solo minúscula
 * la primera letra; aquí no hay trampa de doble mayúscula como con
 * `AIUsageEvent` → `aIUsageEvent`).
 */

import type {
  ILoginAttemptRepository,
  LoginAttempt,
  LoginAttemptFilters,
  NewLoginAttempt,
  PaginatedLoginAttempts,
} from '../../../application/ports/repositories/ILoginAttemptRepository';

interface LoginAttemptWhere {
  email?: string;
  success?: boolean;
  createdAt?: { gte?: Date; lte?: Date };
}

interface LoginAttemptDelegate {
  create(args: { data: NewLoginAttempt }): Promise<LoginAttempt>;
  count(args: { where: LoginAttemptWhere }): Promise<number>;
  findMany(args: {
    where: LoginAttemptWhere;
    orderBy: { createdAt: 'desc' };
    skip?: number;
    take?: number;
  }): Promise<LoginAttempt[]>;
}

export class PrismaLoginAttemptRepository implements ILoginAttemptRepository {
  private readonly delegate: LoginAttemptDelegate;

  constructor(prisma: unknown) {
    this.delegate = (prisma as { loginAttempt: LoginAttemptDelegate }).loginAttempt;
  }

  async save(attempt: NewLoginAttempt): Promise<LoginAttempt> {
    return this.delegate.create({ data: attempt });
  }

  async findMany(
    filters: LoginAttemptFilters,
    page: number,
    pageSize: number
  ): Promise<PaginatedLoginAttempts> {
    const where: LoginAttemptWhere = {};
    if (filters.email) {
      where.email = filters.email;
    }
    if (filters.success !== undefined) {
      where.success = filters.success;
    }
    if (filters.startDate || filters.endDate) {
      where.createdAt = {
        ...(filters.startDate ? { gte: filters.startDate } : {}),
        ...(filters.endDate ? { lte: filters.endDate } : {}),
      };
    }

    const [attempts, total] = await Promise.all([
      this.delegate.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.delegate.count({ where }),
    ]);

    return {
      attempts,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async findFailedSince(since: Date): Promise<LoginAttempt[]> {
    return this.delegate.findMany({
      where: { success: false, createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async countFailedSince(since: Date): Promise<number> {
    return this.delegate.count({
      where: { success: false, createdAt: { gte: since } },
    });
  }
}
