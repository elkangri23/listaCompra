/**
 * Tests unitarios para GetAIUsage (panel admin, fase 3).
 * Agregados reales a partir de eventos de `ai_usage_events`.
 */

import { GetAIUsage } from '../../../../../src/application/use-cases/ai/GetAIUsage';
import type { AIUsageEvent } from '../../../../../src/application/ports/repositories/IAIUsageEventRepository';

const makeEvent = (over: Partial<AIUsageEvent> = {}): AIUsageEvent => ({
  id: `evt-${Math.random()}`,
  userId: null,
  provider: 'freellmapi',
  model: 'qwen3.8-27b',
  operation: 'category-suggestions',
  latencyMs: 100,
  success: true,
  cached: false,
  createdAt: new Date(),
  ...over,
});

const todayKey = (): string => new Date().toISOString().slice(0, 10);

describe('GetAIUsage', () => {
  const getProviderInfo = () => ({ provider: 'freellmapi', model: 'qwen3.8-27b' });

  it('sin eventos: ceros, avgLatencyMs null, cachedPercentage null, hasData false', async () => {
    const repo = { save: jest.fn(), findSince: jest.fn().mockResolvedValue([]) };
    const useCase = new GetAIUsage(repo as any, getProviderInfo);

    const result = await useCase.execute();

    expect(result.provider).toBe('freellmapi');
    expect(result.model).toBe('qwen3.8-27b');
    expect(result.hasData).toBe(false);
    expect(result.today).toEqual({
      total: 0,
      byOperation: { 'category-suggestions': 0, 'bulk-categorize': 0, 'config-test': 0 },
      success: 0,
      failed: 0,
      avgLatencyMs: null,
      cached: 0,
      cachedPercentage: null,
    });
    expect(result.last7Days).toHaveLength(7);
    // 7 entradas, de más antiguo a más reciente, incluyendo hoy
    expect(result.last7Days[6]!.date).toBe(todayKey());
    expect(result.last7Days.every((d) => d.total === 0)).toBe(true);
  });

  it('agrega hoy y los últimos 7 días por día con los conteos correctos', async () => {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const eightDaysAgo = new Date(now);
    eightDaysAgo.setUTCDate(eightDaysAgo.getUTCDate() - 8);

    const events = [
      makeEvent({ latencyMs: 100, success: true, cached: false }),
      makeEvent({ latencyMs: 200, success: true, cached: true }),
      makeEvent({ latencyMs: 300, success: false, cached: false, operation: 'bulk-categorize' }),
      makeEvent({ createdAt: yesterday, operation: 'config-test', latencyMs: 50 }),
      // Fuera de la ventana de 7 días: el caso de uso no debe contarlo
      makeEvent({ createdAt: eightDaysAgo }),
    ];
    const repo = { save: jest.fn(), findSince: jest.fn().mockResolvedValue(events) };
    const useCase = new GetAIUsage(repo as any, getProviderInfo);

    const result = await useCase.execute();

    expect(result.hasData).toBe(true);
    // findSince se llama con el inicio de hace 6 días (UTC)
    const sinceArg: Date = repo.findSince.mock.calls[0][0];
    const expectedSince = new Date(now);
    expectedSince.setUTCHours(0, 0, 0, 0);
    expectedSince.setUTCDate(expectedSince.getUTCDate() - 6);
    expect(sinceArg.getTime()).toBe(expectedSince.getTime());

    expect(result.today.total).toBe(3);
    expect(result.today.success).toBe(2);
    expect(result.today.failed).toBe(1);
    expect(result.today.byOperation).toEqual({
      'category-suggestions': 2,
      'bulk-categorize': 1,
      'config-test': 0,
    });
    expect(result.today.avgLatencyMs).toBe(200); // (100+200+300)/3
    expect(result.today.cached).toBe(1);
    expect(result.today.cachedPercentage).toBe(33); // 1/3 redondeado

    const yesterdayKey = yesterday.toISOString().slice(0, 10);
    const yesterdayStats = result.last7Days.find((d) => d.date === yesterdayKey)!;
    expect(yesterdayStats.total).toBe(1);
    expect(yesterdayStats.byOperation['config-test']).toBe(1);

    // El evento de hace 8 días no aparece en ningún día
    expect(result.last7Days.reduce((acc, d) => acc + d.total, 0)).toBe(4);
  });

  it('cachedPercentage 100 cuando todo es cache y avgLatencyMs entero redondeado', async () => {
    const events = [
      makeEvent({ latencyMs: 101, cached: true }),
      makeEvent({ latencyMs: 100, cached: true }),
    ];
    const repo = { save: jest.fn(), findSince: jest.fn().mockResolvedValue(events) };
    const useCase = new GetAIUsage(repo as any, getProviderInfo);

    const result = await useCase.execute();

    expect(result.today.avgLatencyMs).toBe(101); // 201/2 = 100.5 → 101
    expect(result.today.cachedPercentage).toBe(100);
  });
});
