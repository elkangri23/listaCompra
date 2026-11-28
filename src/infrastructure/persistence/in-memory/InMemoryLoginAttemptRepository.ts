/**
 * Repositorio en memoria de intentos de inicio de sesión.
 * Misma semántica que PrismaLoginAttemptRepository, para el entorno de
 * tests (NODE_ENV=test), donde el container usa repos en memoria y no
 * hay PrismaClient.
 */
import { randomUUID } from 'node:crypto';

import type {
  ILoginAttemptRepository,
  LoginAttempt,
  LoginAttemptFilters,
  NewLoginAttempt,
  PaginatedLoginAttempts,
} from '../../../application/ports/repositories/ILoginAttemptRepository';

export class InMemoryLoginAttemptRepository implements ILoginAttemptRepository {
  private readonly attempts = new Map<string, LoginAttempt>();

  async save(attempt: NewLoginAttempt): Promise<LoginAttempt> {
    const created: LoginAttempt = {
      id: randomUUID(),
      ...attempt,
      createdAt: new Date(),
    };
    this.attempts.set(created.id, created);
    return created;
  }

  async findMany(
    filters: LoginAttemptFilters,
    page: number,
    pageSize: number
  ): Promise<PaginatedLoginAttempts> {
    const filtered = Array.from(this.attempts.values())
      .filter((a) => (filters.email ? a.email === filters.email : true))
      .filter((a) => (filters.success !== undefined ? a.success === filters.success : true))
      .filter((a) => (filters.startDate ? a.createdAt >= filters.startDate : true))
      .filter((a) => (filters.endDate ? a.createdAt <= filters.endDate : true))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const total = filtered.length;
    const start = (page - 1) * pageSize;
    return {
      attempts: filtered.slice(start, start + pageSize),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async findFailedSince(since: Date): Promise<LoginAttempt[]> {
    return Array.from(this.attempts.values())
      .filter((a) => !a.success && a.createdAt >= since)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async findSuccessfulSince(since: Date): Promise<LoginAttempt[]> {
    return Array.from(this.attempts.values())
      .filter((a) => a.success && a.createdAt >= since)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async countFailedSince(since: Date): Promise<number> {
    return Array.from(this.attempts.values()).filter(
      (a) => !a.success && a.createdAt >= since
    ).length;
  }
}
