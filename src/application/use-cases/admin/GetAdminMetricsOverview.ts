/**
 * Caso de uso: métricas del panel de administración (fase 7).
 * GET /admin/metrics/overview con datos REALES: crecimiento (registros,
 * listas y productos por día/mes), embudo de usuarios, actividad diaria
 * (emails distintos con login correcto) y salud de copias y de uso de IA.
 *
 * Como en la fase 5, cada sección que no se puede calcular no se inventa:
 * el embudo llega con los tramos a null y el motivo en `reason`; las
 * series temporales y los totales llegan a cero (nunca null en los
 * arrays). La retención por cohortes nunca se calcula: `available` es
 * siempre false con el motivo (sin última conexión por usuario y
 * cohortes demasiado pequeñas para un % con sentido).
 */

import type { IAdminMetricsRepository } from '@application/ports/repositories/IAdminMetricsRepository';
import type { ILoginAttemptRepository } from '@application/ports/repositories/ILoginAttemptRepository';
import type { IBackupRepository } from '@application/ports/repositories/IBackupRepository';
import type { IAIUsageEventRepository } from '@application/ports/repositories/IAIUsageEventRepository';
import type {
  AdminMetricsOverviewDto,
  MetricsActivityDto,
  MetricsAiUsage7dDto,
  MetricsBackupHealthDto,
  MetricsDayCountDto,
  MetricsFunnelDto,
  MetricsGrowthDto,
  MetricsMonthCountDto,
} from '@application/dto/admin/MetricsDto';
import { Logger } from '@infrastructure/observability/logger/Logger';

const logger = new Logger('GetAdminMetricsOverview');

const DAYS_30 = 30;
const MONTHS_12 = 12;
const DAYS_7 = 7;
const STALE_AFTER_HOURS = 24;
const MS_PER_HOUR = 60 * 60 * 1000;

export const RETENTION_NOT_AVAILABLE_REASON =
  'La retención por cohortes no es calculable con sentido: no se registra la última conexión por usuario y las cohortes actuales son demasiado pequeñas para un porcentaje fiable.';

function dateKeyUTC(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function monthKeyUTC(d: Date): string {
  return d.toISOString().slice(0, 7);
}

function startOfDayUTC(d: Date): Date {
  const copy = new Date(d);
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
}

function startOfMonthUTC(d: Date): Date {
  const copy = new Date(d);
  copy.setUTCDate(1);
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function pct(part: number, total: number): number {
  return total === 0 ? 0 : round1((part / total) * 100);
}

/** Claves YYYY-MM-DD de los últimos `n` días, de más antiguo a hoy. */
function lastNDayKeys(now: Date, n: number): string[] {
  const today = startOfDayUTC(now);
  const keys: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const day = new Date(today);
    day.setUTCDate(day.getUTCDate() - i);
    keys.push(dateKeyUTC(day));
  }
  return keys;
}

/** Claves YYYY-MM de los últimos `n` meses, de más antiguo al actual. */
function lastNMonthKeys(now: Date, n: number): string[] {
  const thisMonth = startOfMonthUTC(now);
  const keys: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const month = new Date(thisMonth);
    month.setUTCMonth(month.getUTCMonth() - i);
    keys.push(monthKeyUTC(month));
  }
  return keys;
}

function zeroDaySeries(now: Date, n: number): MetricsDayCountDto[] {
  return lastNDayKeys(now, n).map((date) => ({ date, count: 0 }));
}

function zeroMonthSeries(now: Date, n: number): MetricsMonthCountDto[] {
  return lastNMonthKeys(now, n).map((month) => ({ month, count: 0 }));
}

export class GetAdminMetricsOverview {
  constructor(
    private readonly metricsRepository: IAdminMetricsRepository,
    private readonly loginAttemptRepository: ILoginAttemptRepository,
    private readonly backupRepository: IBackupRepository,
    private readonly aiUsageEventRepository: IAIUsageEventRepository
  ) {}

  async execute(): Promise<AdminMetricsOverviewDto> {
    const now = new Date();
    const todayStart = startOfDayUTC(now);

    const since30 = new Date(todayStart);
    since30.setUTCDate(since30.getUTCDate() - (DAYS_30 - 1));

    const since12Months = startOfMonthUTC(now);
    since12Months.setUTCMonth(since12Months.getUTCMonth() - (MONTHS_12 - 1));

    const since7 = new Date(todayStart);
    since7.setUTCDate(since7.getUTCDate() - (DAYS_7 - 1));

    const [growth, funnel, activity, backupHealth, aiUsage7d] =
      await Promise.all([
        this.buildGrowth(now, since30, since12Months),
        this.buildFunnel(),
        this.buildActivity(now, since30),
        this.buildBackupHealth(now),
        this.buildAiUsage7d(now, since7),
      ]);

    return { growth, funnel, activity, backupHealth, aiUsage7d };
  }

  private async buildGrowth(
    now: Date,
    since30: Date,
    since12Months: Date
  ): Promise<MetricsGrowthDto> {
    try {
      const [
        users,
        verifiedUsers,
        lists,
        products,
        categorizedProducts,
        registrationsByDayRows,
        registrationsByMonthRows,
        listsByDayRows,
        productsByDayRows,
      ] = await Promise.all([
        this.metricsRepository.countUsers(),
        this.metricsRepository.countVerifiedUsers(),
        this.metricsRepository.countLists(),
        this.metricsRepository.countProducts(),
        this.metricsRepository.countCategorizedProducts(),
        this.metricsRepository.registrationsByDay(since30),
        this.metricsRepository.registrationsByMonth(since12Months),
        this.metricsRepository.listsByDay(since30),
        this.metricsRepository.productsByDay(since30),
      ]);

      const dayKeys = lastNDayKeys(now, DAYS_30);
      const monthKeys = lastNMonthKeys(now, MONTHS_12);

      const fillDays = (
        rows: Array<{ date: string; count: number }>
      ): MetricsDayCountDto[] => {
        const byDate = new Map(rows.map((r) => [r.date, r.count]));
        return dayKeys.map((date) => ({ date, count: byDate.get(date) ?? 0 }));
      };
      const fillMonths = (
        rows: Array<{ month: string; count: number }>
      ): MetricsMonthCountDto[] => {
        const byMonth = new Map(rows.map((r) => [r.month, r.count]));
        return monthKeys.map((month) => ({
          month,
          count: byMonth.get(month) ?? 0,
        }));
      };

      return {
        registrationsByDay: fillDays(registrationsByDayRows),
        registrationsByMonth: fillMonths(registrationsByMonthRows),
        listsByDay: fillDays(listsByDayRows),
        productsByDay: fillDays(productsByDayRows),
        totals: {
          users,
          verifiedUsers,
          verifiedPct: pct(verifiedUsers, users),
          lists,
          products,
          categorizedProducts,
          categorizedPct: pct(categorizedProducts, products),
        },
      };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      logger.error('No se pudieron calcular las métricas de crecimiento', {
        error: reason,
      });
      return this.zeroGrowth(now);
    }
  }

  private zeroGrowth(now: Date): MetricsGrowthDto {
    return {
      registrationsByDay: zeroDaySeries(now, DAYS_30),
      registrationsByMonth: zeroMonthSeries(now, MONTHS_12),
      listsByDay: zeroDaySeries(now, DAYS_30),
      productsByDay: zeroDaySeries(now, DAYS_30),
      totals: {
        users: 0,
        verifiedUsers: 0,
        verifiedPct: 0,
        lists: 0,
        products: 0,
        categorizedProducts: 0,
        categorizedPct: 0,
      },
    };
  }

  private async buildFunnel(): Promise<MetricsFunnelDto> {
    try {
      const counts = await this.metricsRepository.funnelCounts();
      return {
        registered: counts.registered,
        verified: counts.verified,
        withList: counts.withList,
        withProduct: counts.withProduct,
        shared: counts.shared,
      };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      logger.error('No se pudo calcular el embudo de usuarios', {
        error: reason,
      });
      return {
        registered: null,
        verified: null,
        withList: null,
        withProduct: null,
        shared: null,
        reason:
          'No se pudieron calcular los tramos del embudo (fallo al consultar los datos).',
      };
    }
  }

  private async buildActivity(
    now: Date,
    since30: Date
  ): Promise<MetricsActivityDto> {
    const retention = {
      available: false as const,
      reason: RETENTION_NOT_AVAILABLE_REASON,
    };
    try {
      const attempts =
        await this.loginAttemptRepository.findSuccessfulSince(since30);
      const emailsByDay = new Map<string, Set<string>>();
      for (const attempt of attempts) {
        const key = dateKeyUTC(attempt.createdAt);
        let emails = emailsByDay.get(key);
        if (!emails) {
          emails = new Set<string>();
          emailsByDay.set(key, emails);
        }
        emails.add(attempt.email);
      }
      return {
        activeUsersByDay: lastNDayKeys(now, DAYS_30).map((date) => ({
          date,
          count: emailsByDay.get(date)?.size ?? 0,
        })),
        retention,
      };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      logger.error('No se pudo calcular la actividad diaria', {
        error: reason,
      });
      return { activeUsersByDay: zeroDaySeries(now, DAYS_30), retention };
    }
  }

  private async buildBackupHealth(now: Date): Promise<MetricsBackupHealthDto> {
    try {
      const latest = await this.backupRepository.findLatestCreated();
      if (!latest) {
        return {
          lastCreated: null,
          stale: true,
          reason: 'No hay ninguna copia de seguridad en estado CREATED registrada.',
        };
      }
      const ageHours = round1(
        (now.getTime() - latest.createdAt.getTime()) / MS_PER_HOUR
      );
      const stale = ageHours > STALE_AFTER_HOURS;
      return {
        lastCreated: {
          id: latest.id,
          filename: latest.filename,
          sizeBytes: latest.sizeBytes,
          createdAt: latest.createdAt.toISOString(),
          ageHours,
        },
        stale,
        reason: stale
          ? 'La última copia CREATED tiene más de 24 h.'
          : null,
      };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      logger.error('No se pudo consultar la última copia de seguridad', {
        error: reason,
      });
      return {
        lastCreated: null,
        stale: true,
        reason: 'No se pudo consultar la última copia de seguridad.',
      };
    }
  }

  private async buildAiUsage7d(
    now: Date,
    since7: Date
  ): Promise<MetricsAiUsage7dDto> {
    try {
      const events = await this.aiUsageEventRepository.findSince(since7);
      const dayKeys = lastNDayKeys(now, DAYS_7);
      const byDayMap = new Map<string, { total: number; success: number }>();
      let total = 0;
      let success = 0;
      let failed = 0;
      let cached = 0;
      for (const event of events) {
        total += 1;
        if (event.success) {
          success += 1;
        } else {
          failed += 1;
        }
        if (event.cached) {
          cached += 1;
        }
        const key = dateKeyUTC(event.createdAt);
        const day = byDayMap.get(key) ?? { total: 0, success: 0 };
        day.total += 1;
        if (event.success) {
          day.success += 1;
        }
        byDayMap.set(key, day);
      }
      return {
        total,
        success,
        failed,
        cached,
        byDay: dayKeys.map((date) => ({
          date,
          total: byDayMap.get(date)?.total ?? 0,
          success: byDayMap.get(date)?.success ?? 0,
        })),
      };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      logger.error('No se pudo calcular el uso de IA de los últimos 7 días', {
        error: reason,
      });
      return {
        total: 0,
        success: 0,
        failed: 0,
        cached: 0,
        byDay: lastNDayKeys(now, DAYS_7).map((date) => ({
          date,
          total: 0,
          success: 0,
        })),
      };
    }
  }
}
