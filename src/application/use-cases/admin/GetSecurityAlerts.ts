/**
 * Caso de uso: alertas de seguridad CALCULADAS con datos reales para el
 * panel de administración (fase 5). Las reglas y umbrales están
 * documentados en securityCalculations.ts. Sin datos que las disparen,
 * la lista es vacía: nunca se inventan alertas.
 */

import type { ILoginAttemptRepository } from '@application/ports/repositories/ILoginAttemptRepository';
import type { IUsuarioRepository } from '@application/ports/repositories/IUsuarioRepository';
import type { GetSecurityAlertsResponseDto } from '@application/dto/admin/SecurityDto';
import {
  BRUTE_FORCE_WINDOW_HOURS,
  computeSecurityAlerts,
} from '@application/use-cases/admin/securityCalculations';

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

export class GetSecurityAlerts {
  constructor(
    private readonly loginAttemptRepository: ILoginAttemptRepository,
    private readonly usuarioRepository: IUsuarioRepository
  ) {}

  async execute(
    pageInput?: number,
    pageSizeInput?: number
  ): Promise<GetSecurityAlertsResponseDto> {
    const page = normalizePage(pageInput);
    const pageSize = normalizePageSize(pageSizeInput);
    const now = new Date();

    const [failedAttempts, adminsResult, graceResult] = await Promise.all([
      this.loginAttemptRepository.findFailedSince(
        new Date(now.getTime() - BRUTE_FORCE_WINDOW_HOURS * 60 * 60 * 1000)
      ),
      this.usuarioRepository.findAdminsWithoutTotp(),
      this.usuarioRepository.findGracePeriodAccounts(),
    ]);

    // Los repositorios de usuario devuelven Result: un fallo aquí es un
    // error del endpoint (500), no una lista vacía — una alerta que no se
    // puede calcular no debe parecer "todo en orden".
    if (adminsResult.isFailure) {
      throw adminsResult.error;
    }
    if (graceResult.isFailure) {
      throw graceResult.error;
    }

    const alerts = computeSecurityAlerts({
      failedAttempts,
      adminsWithoutTotp: adminsResult.value,
      graceAccounts: graceResult.value,
      now,
    });

    const total = alerts.length;
    const start = (page - 1) * pageSize;
    return {
      alerts: alerts.slice(start, start + pageSize),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }
}
