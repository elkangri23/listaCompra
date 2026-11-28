/**
 * Caso de uso: agregados reales de uso de IA (panel admin, fase 3).
 * Lee los eventos de `ai_usage_events` y agrega hoy + últimos 7 días.
 * NUNCA devuelve valores inventados: sin eventos, todo a cero con
 * `avgLatencyMs: null`, `cachedPercentage: null` y `hasData: false`.
 */

import type { AIUsageOperation } from '../../ports/external/IAIUsageRecorder';
import type { IAIUsageEventRepository } from '../../ports/repositories/IAIUsageEventRepository';

export type AIUsageByOperation = Record<AIUsageOperation, number>;

export interface AIUsageDayStats {
  date: string;
  total: number;
  success: number;
  failed: number;
  byOperation: AIUsageByOperation;
}

export interface AIUsageTodayStats {
  total: number;
  byOperation: AIUsageByOperation;
  success: number;
  failed: number;
  avgLatencyMs: number | null;
  cached: number;
  cachedPercentage: number | null;
}

export interface GetAIUsageResult {
  provider: string;
  model: string;
  today: AIUsageTodayStats;
  last7Days: AIUsageDayStats[];
  hasData: boolean;
}

function emptyByOperation(): AIUsageByOperation {
  return {
    'category-suggestions': 0,
    'bulk-categorize': 0,
    'config-test': 0,
  };
}

function dateKeyUTC(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfDayUTC(d: Date): Date {
  const copy = new Date(d);
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
}

export class GetAIUsage {
  constructor(
    private readonly usageEventRepository: IAIUsageEventRepository,
    private readonly getProviderInfo: () => { provider: string; model: string }
  ) {}

  async execute(): Promise<GetAIUsageResult> {
    const now = new Date();
    const todayStart = startOfDayUTC(now);
    const since = new Date(todayStart);
    since.setUTCDate(since.getUTCDate() - 6);

    const events = await this.usageEventRepository.findSince(since);

    // 7 días: de más antiguo a más reciente, incluyendo hoy.
    const days: AIUsageDayStats[] = [];
    for (let i = 6; i >= 0; i--) {
      const day = new Date(todayStart);
      day.setUTCDate(day.getUTCDate() - i);
      days.push({
        date: dateKeyUTC(day),
        total: 0,
        success: 0,
        failed: 0,
        byOperation: emptyByOperation(),
      });
    }
    const byDate = new Map(days.map((d) => [d.date, d]));

    let todayLatencySum = 0;
    let todayCached = 0;

    for (const event of events) {
      const day = byDate.get(dateKeyUTC(event.createdAt));
      if (!day) continue;
      day.total += 1;
      day.byOperation[event.operation] += 1;
      if (event.success) day.success += 1;
      else day.failed += 1;

      if (dateKeyUTC(event.createdAt) === dateKeyUTC(todayStart)) {
        todayLatencySum += event.latencyMs;
        if (event.cached) todayCached += 1;
      }
    }

    const today = byDate.get(dateKeyUTC(todayStart))!;
    const todayStats: AIUsageTodayStats = {
      total: today.total,
      byOperation: today.byOperation,
      success: today.success,
      failed: today.failed,
      avgLatencyMs:
        today.total > 0 ? Math.round(todayLatencySum / today.total) : null,
      cached: todayCached,
      cachedPercentage:
        today.total > 0 ? Math.round((todayCached / today.total) * 100) : null,
    };

    const { provider, model } = this.getProviderInfo();

    return {
      provider,
      model,
      today: todayStats,
      last7Days: days,
      hasData: events.length > 0,
    };
  }
}
