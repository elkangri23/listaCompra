/**
 * Tests del caso de uso GetAdminMetricsOverview (fase 7): crecimiento
 * real con ceros rellenados, embudo, actividad diaria, salud de copias
 * y uso de IA; retención siempre no disponible con motivo.
 */

import {
  GetAdminMetricsOverview,
  RETENTION_NOT_AVAILABLE_REASON,
} from '@application/use-cases/admin/GetAdminMetricsOverview';
import type {
  IAdminMetricsRepository,
  MetricsDayCount,
  MetricsFunnelCounts,
  MetricsMonthCount,
} from '@application/ports/repositories/IAdminMetricsRepository';
import type {
  ILoginAttemptRepository,
  LoginAttempt,
} from '@application/ports/repositories/ILoginAttemptRepository';
import type {
  Backup,
  IBackupRepository,
} from '@application/ports/repositories/IBackupRepository';
import type {
  AIUsageEvent,
  IAIUsageEventRepository,
} from '@application/ports/repositories/IAIUsageEventRepository';

function daysAgo(n: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  d.setUTCHours(12, 0, 0, 0);
  return d;
}

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function monthKey(d: Date): string {
  return d.toISOString().slice(0, 7);
}

class StubMetricsRepository implements IAdminMetricsRepository {
  counts = { users: 0, verified: 0, lists: 0, products: 0, categorized: 0 };
  regByDayRows: MetricsDayCount[] = [];
  regByMonthRows: MetricsMonthCount[] = [];
  listsByDayRows: MetricsDayCount[] = [];
  productsByDayRows: MetricsDayCount[] = [];
  funnel: MetricsFunnelCounts = {
    registered: 0,
    verified: 0,
    withList: 0,
    withProduct: 0,
    shared: 0,
  };
  failOn = new Set<string>();

  private check(method: string): void {
    if (this.failOn.has(method)) {
      throw new Error(`fallo simulado en ${method}`);
    }
  }

  async countUsers(): Promise<number> {
    this.check('countUsers');
    return this.counts.users;
  }

  async countVerifiedUsers(): Promise<number> {
    this.check('countVerifiedUsers');
    return this.counts.verified;
  }

  async countLists(): Promise<number> {
    this.check('countLists');
    return this.counts.lists;
  }

  async countProducts(): Promise<number> {
    this.check('countProducts');
    return this.counts.products;
  }

  async countCategorizedProducts(): Promise<number> {
    this.check('countCategorizedProducts');
    return this.counts.categorized;
  }

  async registrationsByDay(): Promise<MetricsDayCount[]> {
    this.check('registrationsByDay');
    return this.regByDayRows;
  }

  async registrationsByMonth(): Promise<MetricsMonthCount[]> {
    this.check('registrationsByMonth');
    return this.regByMonthRows;
  }

  async listsByDay(): Promise<MetricsDayCount[]> {
    this.check('listsByDay');
    return this.listsByDayRows;
  }

  async productsByDay(): Promise<MetricsDayCount[]> {
    this.check('productsByDay');
    return this.productsByDayRows;
  }

  async funnelCounts(): Promise<MetricsFunnelCounts> {
    this.check('funnelCounts');
    return this.funnel;
  }
}

function makeLoginAttempt(
  email: string,
  createdAt: Date,
  success = true
): LoginAttempt {
  return {
    id: `attempt-${email}-${createdAt.getTime()}`,
    email,
    success,
    reason: success ? null : 'WRONG_PASSWORD',
    ipAddress: null,
    userAgent: null,
    createdAt,
  };
}

function makeBackup(createdAt: Date): Backup {
  return {
    id: 'backup-1',
    filename: 'listacompra-2026-11-28.sql.gz',
    sizeBytes: 9203,
    status: 'CREATED',
    source: 'SCHEDULED',
    createdByUserId: null,
    createdAt,
    restoreReason: null,
    restoredAt: null,
    restoreRequestedAt: null,
    restoreRequestedByUserId: null,
    failureReason: null,
  };
}

function makeAiEvent(
  createdAt: Date,
  success: boolean,
  cached: boolean
): AIUsageEvent {
  return {
    id: `ai-${createdAt.getTime()}-${success}-${cached}`,
    userId: null,
    provider: 'freellmapi',
    model: 'qwen3.8-27b',
    operation: 'category-suggestions',
    latencyMs: 120,
    success,
    cached,
    createdAt,
  };
}

function buildUseCase(opts: {
  metrics?: StubMetricsRepository;
  attempts?: LoginAttempt[] | Error;
  backup?: Backup | null | Error;
  aiEvents?: AIUsageEvent[] | Error;
}): GetAdminMetricsOverview {
  const metrics = opts.metrics ?? new StubMetricsRepository();
  const loginRepo = {
    findSuccessfulSince: async () => {
      if (opts.attempts instanceof Error) {
        throw opts.attempts;
      }
      return opts.attempts ?? [];
    },
  } as unknown as ILoginAttemptRepository;
  const backupRepo = {
    findLatestCreated: async () => {
      if (opts.backup instanceof Error) {
        throw opts.backup;
      }
      return opts.backup ?? null;
    },
  } as unknown as IBackupRepository;
  const aiRepo = {
    findSince: async () => {
      if (opts.aiEvents instanceof Error) {
        throw opts.aiEvents;
      }
      return opts.aiEvents ?? [];
    },
  } as unknown as IAIUsageEventRepository;
  return new GetAdminMetricsOverview(metrics, loginRepo, backupRepo, aiRepo);
}

describe('GetAdminMetricsOverview', () => {
  it('devuelve crecimiento real con ceros rellenados y totales con porcentajes', async () => {
    const metrics = new StubMetricsRepository();
    metrics.counts = { users: 4, verified: 3, lists: 5, products: 10, categorized: 4 };
    metrics.regByDayRows = [
      { date: dateKey(daysAgo(0)), count: 2 },
      { date: dateKey(daysAgo(1)), count: 1 },
    ];
    metrics.regByMonthRows = [
      { month: monthKey(daysAgo(0)), count: 3 },
      { month: monthKey(daysAgo(60)), count: 1 },
    ];
    metrics.listsByDayRows = [{ date: dateKey(daysAgo(0)), count: 1 }];
    metrics.productsByDayRows = [{ date: dateKey(daysAgo(1)), count: 2 }];

    const overview = await buildUseCase({ metrics }).execute();

    expect(overview.growth.registrationsByDay).toHaveLength(30);
    expect(overview.growth.registrationsByDay[29]).toEqual({
      date: dateKey(daysAgo(0)),
      count: 2,
    });
    expect(overview.growth.registrationsByDay[28]).toEqual({
      date: dateKey(daysAgo(1)),
      count: 1,
    });
    expect(overview.growth.registrationsByDay[0]?.count).toBe(0);
    expect(overview.growth.registrationsByMonth).toHaveLength(12);
    expect(overview.growth.registrationsByMonth[11]).toEqual({
      month: monthKey(daysAgo(0)),
      count: 3,
    });
    expect(overview.growth.registrationsByMonth[10]?.count).toBe(0);
    expect(
      overview.growth.registrationsByMonth.find(
        (m) => m.month === monthKey(daysAgo(60))
      )?.count
    ).toBe(1);
    expect(overview.growth.listsByDay).toHaveLength(30);
    expect(overview.growth.listsByDay[29]?.count).toBe(1);
    expect(overview.growth.productsByDay).toHaveLength(30);
    expect(overview.growth.productsByDay[28]?.count).toBe(2);
    expect(overview.growth.totals).toEqual({
      users: 4,
      verifiedUsers: 3,
      verifiedPct: 75,
      lists: 5,
      products: 10,
      categorizedProducts: 4,
      categorizedPct: 40,
    });
  });

  it('sin datos → ceros, arrays completos y backup stale', async () => {
    const overview = await buildUseCase({}).execute();

    expect(overview.growth.totals).toEqual({
      users: 0,
      verifiedUsers: 0,
      verifiedPct: 0,
      lists: 0,
      products: 0,
      categorizedProducts: 0,
      categorizedPct: 0,
    });
    expect(overview.growth.registrationsByDay).toHaveLength(30);
    expect(
      overview.growth.registrationsByDay.every((d) => d.count === 0)
    ).toBe(true);
    expect(overview.growth.registrationsByMonth).toHaveLength(12);
    expect(
      overview.growth.registrationsByMonth.every((m) => m.count === 0)
    ).toBe(true);
    expect(overview.funnel).toEqual({
      registered: 0,
      verified: 0,
      withList: 0,
      withProduct: 0,
      shared: 0,
    });
    expect(overview.activity.activeUsersByDay).toHaveLength(30);
    expect(
      overview.activity.activeUsersByDay.every((d) => d.count === 0)
    ).toBe(true);
    expect(overview.backupHealth).toEqual({
      lastCreated: null,
      stale: true,
      reason: 'No hay ninguna copia de seguridad en estado CREATED registrada.',
    });
    expect(overview.aiUsage7d).toEqual({
      total: 0,
      success: 0,
      failed: 0,
      cached: 0,
      byDay: expect.arrayContaining([
        { date: dateKey(daysAgo(0)), total: 0, success: 0 },
      ]),
    });
    expect(overview.aiUsage7d.byDay).toHaveLength(7);
  });

  it('embudo con usuarios en cada tramo (cada tramo subconjunto del anterior)', async () => {
    const metrics = new StubMetricsRepository();
    metrics.funnel = {
      registered: 10,
      verified: 8,
      withList: 6,
      withProduct: 5,
      shared: 2,
    };

    const overview = await buildUseCase({ metrics }).execute();

    expect(overview.funnel).toEqual({
      registered: 10,
      verified: 8,
      withList: 6,
      withProduct: 5,
      shared: 2,
    });
  });

  it('actividad: cuenta emails distintos por día, sin duplicar el mismo email', async () => {
    const attempts = [
      makeLoginAttempt('a@ejemplo.com', daysAgo(0)),
      makeLoginAttempt('a@ejemplo.com', daysAgo(0)),
      makeLoginAttempt('b@ejemplo.com', daysAgo(0)),
      makeLoginAttempt('a@ejemplo.com', daysAgo(1)),
      // Fuera de la ventana de 30 días: no aparece en ningún día.
      makeLoginAttempt('c@ejemplo.com', daysAgo(40)),
    ];

    const overview = await buildUseCase({ attempts }).execute();

    expect(overview.activity.activeUsersByDay).toHaveLength(30);
    expect(overview.activity.activeUsersByDay[29]).toEqual({
      date: dateKey(daysAgo(0)),
      count: 2,
    });
    expect(overview.activity.activeUsersByDay[28]).toEqual({
      date: dateKey(daysAgo(1)),
      count: 1,
    });
    expect(overview.activity.activeUsersByDay[0]?.count).toBe(0);
  });

  it('retención siempre no disponible, con el motivo documentado', async () => {
    const overview = await buildUseCase({}).execute();

    expect(overview.activity.retention).toEqual({
      available: false,
      reason: RETENTION_NOT_AVAILABLE_REASON,
    });
    expect(RETENTION_NOT_AVAILABLE_REASON).toMatch(/última conexión/);
    expect(RETENTION_NOT_AVAILABLE_REASON).toMatch(/cohortes/);
  });

  it('backupHealth: copia CREATED reciente → stale false con edad en horas', async () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const overview = await buildUseCase({
      backup: makeBackup(twoHoursAgo),
    }).execute();

    expect(overview.backupHealth.stale).toBe(false);
    expect(overview.backupHealth.reason).toBeNull();
    expect(overview.backupHealth.lastCreated?.filename).toBe(
      'listacompra-2026-11-28.sql.gz'
    );
    expect(overview.backupHealth.lastCreated?.sizeBytes).toBe(9203);
    expect(overview.backupHealth.lastCreated?.ageHours).toBe(2);
  });

  it('backupHealth: copia CREATED de hace más de 24 h → stale true con motivo', async () => {
    const thirtyHoursAgo = new Date(Date.now() - 30 * 60 * 60 * 1000);
    const overview = await buildUseCase({
      backup: makeBackup(thirtyHoursAgo),
    }).execute();

    expect(overview.backupHealth.stale).toBe(true);
    expect(overview.backupHealth.reason).toBe(
      'La última copia CREATED tiene más de 24 h.'
    );
    expect(overview.backupHealth.lastCreated?.ageHours).toBe(30);
  });

  it('aiUsage7d: agrega totales y por día con ceros', async () => {
    const aiEvents = [
      makeAiEvent(daysAgo(0), true, false),
      makeAiEvent(daysAgo(0), false, true),
      makeAiEvent(daysAgo(1), true, true),
    ];

    const overview = await buildUseCase({ aiEvents }).execute();

    expect(overview.aiUsage7d.total).toBe(3);
    expect(overview.aiUsage7d.success).toBe(2);
    expect(overview.aiUsage7d.failed).toBe(1);
    expect(overview.aiUsage7d.cached).toBe(2);
    expect(overview.aiUsage7d.byDay).toHaveLength(7);
    expect(overview.aiUsage7d.byDay[6]).toEqual({
      date: dateKey(daysAgo(0)),
      total: 2,
      success: 1,
    });
    expect(overview.aiUsage7d.byDay[5]).toEqual({
      date: dateKey(daysAgo(1)),
      total: 1,
      success: 1,
    });
    expect(overview.aiUsage7d.byDay[0]).toEqual({
      date: dateKey(daysAgo(6)),
      total: 0,
      success: 0,
    });
  });

  it('un fallo en el embudo deja los tramos a null con reason, sin romper el resto', async () => {
    const metrics = new StubMetricsRepository();
    metrics.counts = { users: 2, verified: 1, lists: 1, products: 1, categorized: 0 };
    metrics.failOn.add('funnelCounts');

    const overview = await buildUseCase({ metrics }).execute();

    expect(overview.funnel).toEqual({
      registered: null,
      verified: null,
      withList: null,
      withProduct: null,
      shared: null,
      reason:
        'No se pudieron calcular los tramos del embudo (fallo al consultar los datos).',
    });
    expect(overview.growth.totals.users).toBe(2);
  });

  it('un fallo al leer los logins deja la actividad a cero pero la retención sigue documentada', async () => {
    const overview = await buildUseCase({
      attempts: new Error('base de datos caída'),
    }).execute();

    expect(overview.activity.activeUsersByDay).toHaveLength(30);
    expect(
      overview.activity.activeUsersByDay.every((d) => d.count === 0)
    ).toBe(true);
    expect(overview.activity.retention.available).toBe(false);
    expect(overview.activity.retention.reason).toBe(
      RETENTION_NOT_AVAILABLE_REASON
    );
  });

  it('un fallo en crecimiento deja los totales a cero con las series completas', async () => {
    const metrics = new StubMetricsRepository();
    metrics.failOn.add('countUsers');

    const overview = await buildUseCase({ metrics }).execute();

    expect(overview.growth.totals.users).toBe(0);
    expect(overview.growth.registrationsByDay).toHaveLength(30);
    expect(overview.growth.registrationsByMonth).toHaveLength(12);
  });
});
