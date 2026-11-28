/**
 * Caso de uso: lista paginada de intentos de inicio de sesión para el
 * panel de administración (fase 5). Ordenada por fecha descendente.
 */

import type {
  ILoginAttemptRepository,
  LoginAttemptFilters,
} from '@application/ports/repositories/ILoginAttemptRepository';
import type {
  GetLoginAttemptsQueryDto,
  GetLoginAttemptsResponseDto,
} from '@application/dto/admin/SecurityDto';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

function normalizePage(page?: number): number {
  if (!page || !Number.isFinite(page) || page < 1) {
    return DEFAULT_PAGE;
  }
  return Math.floor(page);
}

function normalizePageSize(pageSize?: number): number {
  if (!pageSize || !Number.isFinite(pageSize) || pageSize < 1) {
    return DEFAULT_PAGE_SIZE;
  }
  return Math.min(Math.floor(pageSize), MAX_PAGE_SIZE);
}

export class GetLoginAttempts {
  constructor(private readonly loginAttemptRepository: ILoginAttemptRepository) {}

  async execute(query: GetLoginAttemptsQueryDto): Promise<GetLoginAttemptsResponseDto> {
    const page = normalizePage(query.page);
    const pageSize = normalizePageSize(query.pageSize);

    const filters: LoginAttemptFilters = {
      ...(query.email ? { email: query.email.trim().toLowerCase() } : {}),
      ...(query.success !== undefined ? { success: query.success } : {}),
      ...(query.startDate ? { startDate: query.startDate } : {}),
      ...(query.endDate ? { endDate: query.endDate } : {}),
    };

    const result = await this.loginAttemptRepository.findMany(filters, page, pageSize);

    return {
      attempts: result.attempts.map((a) => ({
        id: a.id,
        email: a.email,
        success: a.success,
        reason: a.reason,
        ipAddress: a.ipAddress,
        userAgent: a.userAgent,
        createdAt: a.createdAt.toISOString(),
      })),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: result.totalPages,
    };
  }
}
