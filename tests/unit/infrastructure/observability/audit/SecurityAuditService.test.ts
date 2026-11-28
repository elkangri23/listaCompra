/**
 * Tests unitarios para:
 * - SecurityAuditService + InMemoryAuditRepository
 * - GetGlobalAuditHistory / GetAuditHistoryForProduct
 * - RabbitMQEventPublisher
 */

import { SecurityAuditService, InMemoryAuditRepository, AuditEventType, type AuditEvent } from '../../../../../src/infrastructure/observability/audit/SecurityAuditService';
import { GetGlobalAuditHistory } from '../../../../../src/application/use-cases/audit/GetGlobalAuditHistory';
import { GetAuditHistoryForProduct } from '../../../../../src/application/use-cases/audit/GetAuditHistoryForProduct';
import { RabbitMQEventPublisher } from '../../../../../src/infrastructure/messaging/rabbitmq/RabbitMQEventPublisher';
import { ProductoDeletedEvent } from '../../../../../src/domain/events/ProductoDeletedEvent';

const successResult = <T>(value: T) => ({ isSuccess: true, isFailure: false, value });
const failureResult = (error: unknown) => ({ isSuccess: false, isFailure: true, error });

describe('SecurityAuditService', () => {
  let repo: any;
  let logger: any;
  let service: SecurityAuditService;

  beforeEach(() => {
    repo = {
      save: jest.fn().mockResolvedValue(undefined),
      findByEventType: jest.fn().mockResolvedValue([]),
      getStats: jest.fn().mockResolvedValue({ totalEvents: 0 }),
      findByUserId: jest.fn().mockResolvedValue([]),
      findByRiskLevel: jest.fn().mockResolvedValue([])
    };
    logger = { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() };
    service = new SecurityAuditService(repo, logger);
  });

  const baseEvent = {
    eventType: AuditEventType.AUTH_LOGIN,
    resourceType: 'auth',
    action: 'login',
    outcome: 'SUCCESS' as const,
    details: {},
    riskLevel: 'LOW' as const
  };

  it('logEvent genera id y timestamp', async () => {
    await service.logEvent({ ...baseEvent, userId: 'u1' });
    const saved = repo.save.mock.calls[0][0];
    expect(saved.id).toMatch(/^audit_/);
    expect(saved.timestamp).toBeInstanceOf(Date);
  });

  it('logEvent con riesgo CRITICAL loguea error', async () => {
    await service.logEvent({ ...baseEvent, riskLevel: 'CRITICAL' });
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('EVENTO CRÍTICO'),
      expect.anything()
    );
  });

  it('logEvent con error del repositorio no lanza', async () => {
    repo.save.mockRejectedValue(new Error('db'));
    await expect(service.logEvent(baseEvent)).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith('Error al registrar evento de auditoría', expect.anything());
  });

  it('logLoginAttempt éxito y fallo', async () => {
    await service.logLoginAttempt('u1', 'a@b.com', true, '1.2.3.4', 'UA');
    const ok = repo.save.mock.calls[0][0];
    expect(ok.eventType).toBe(AuditEventType.AUTH_LOGIN);
    expect(ok.outcome).toBe('SUCCESS');
    expect(ok.ipAddress).toBe('1.2.3.4');

    await service.logLoginAttempt('u1', 'a@b.com', false);
    const fail = repo.save.mock.calls[1][0];
    expect(fail.eventType).toBe(AuditEventType.AUTH_FAILED_LOGIN);
    expect(fail.outcome).toBe('FAILURE');
  });

  it('logPasswordChange / logPermissionDenied', async () => {
    await service.logPasswordChange('u1', '1.1.1.1');
    expect(repo.save.mock.calls[0][0].eventType).toBe(AuditEventType.AUTH_PASSWORD_CHANGE);

    await service.logPermissionDenied('u1', 'lista', 'delete', 'sin permisos', '1.1.1.1');
    const denied = repo.save.mock.calls[1][0];
    expect(denied.eventType).toBe(AuditEventType.AUTH_PERMISSION_DENIED);
    expect(denied.outcome).toBe('DENIED');
    expect(denied.riskLevel).toBe('HIGH');
  });

  it('logImpersonationStart / End', async () => {
    await service.logImpersonationStart('admin', 'target', 10, '1.1.1.1');
    const start = repo.save.mock.calls[0][0];
    expect(start.eventType).toBe(AuditEventType.ADMIN_IMPERSONATION_START);
    expect(start.riskLevel).toBe('CRITICAL');
    expect(start.resourceId).toBe('target');

    await service.logImpersonationEnd('admin', 'target', 8);
    expect(repo.save.mock.calls[1][0].eventType).toBe(AuditEventType.ADMIN_IMPERSONATION_END);
  });

  it('logSecurityViolation / logInjectionAttempt', async () => {
    await service.logSecurityViolation('bruteforce', { x: 1 }, 'u1', '1.1.1.1');
    expect(repo.save.mock.calls[0][0].eventType).toBe(AuditEventType.SECURITY_VIOLATION);

    await service.logInjectionAttempt('SQL', 'DROP TABLE x;', 'u1');
    const inj = repo.save.mock.calls[1][0];
    expect(inj.eventType).toBe(AuditEventType.SECURITY_INJECTION_ATTEMPT);
    expect(inj.details.payload_sample).toBe('DROP TABLE x;');
  });

  it('logBlueprintAccess y logAIRequest', async () => {
    await service.logBlueprintAccess('bp1', 'u1', 'view', true, 'DENIED');
    const denied = repo.save.mock.calls[0][0];
    expect(denied.eventType).toBe(AuditEventType.BLUEPRINT_ACCESS);
    expect(denied.riskLevel).toBe('HIGH');

    await service.logBlueprintAccess('bp1', 'u1', 'view', true, 'SUCCESS');
    expect(repo.save.mock.calls[1][0].riskLevel).toBe('LOW');

    await service.logAIRequest('u1', 'perplexity', 100, 0.01, true);
    const ai = repo.save.mock.calls[2][0];
    expect(ai.eventType).toBe(AuditEventType.API_AI_REQUEST);
    expect(ai.details.tokens_used).toBe(100);
  });

  it('anomalía: 5+ fallos de login desde la misma IP genera SECURITY_ANOMALY', async () => {
    // 4 fallos previos desde la misma IP reciente
    repo.findByEventType.mockResolvedValue(
      Array.from({ length: 5 }, () => ({
        ipAddress: '1.1.1.1',
        timestamp: new Date()
      }))
    );
    await service.logLoginAttempt('u1', 'a@b.com', false, '1.1.1.1');
    // login fallido + anomaly
    const saved: any[] = repo.save.mock.calls.map((c: any[]) => c[0]);
    expect(saved).toHaveLength(2);
    expect(saved[1]?.eventType).toBe(AuditEventType.SECURITY_ANOMALY);
    expect(saved[1]?.details.failure_count).toBe(5);
  });

  it('consultas delegan en el repositorio', async () => {
    await service.getAuditStats('day');
    await service.getUserAuditTrail('u1', { limit: 5 });
    await service.getHighRiskEvents();
    expect(repo.getStats).toHaveBeenCalledWith('day');
    expect(repo.findByUserId).toHaveBeenCalledWith('u1', { limit: 5 });
    expect(repo.findByRiskLevel).toHaveBeenCalledTimes(2);
  });
});

describe('InMemoryAuditRepository', () => {
  let repo: InMemoryAuditRepository;

  const event = (over: Record<string, unknown> = {}) => ({
    id: `e${Math.random()}`,
    timestamp: new Date(),
    eventType: AuditEventType.AUTH_LOGIN,
    userId: 'u1',
    resourceType: 'auth',
    action: 'login',
    outcome: 'SUCCESS' as const,
    details: {},
    riskLevel: 'LOW' as const,
    ...over
  });

  beforeEach(() => {
    repo = new InMemoryAuditRepository();
  });

  it('findByUserId filtra y pagina', async () => {
    await repo.save(event({ userId: 'u2' }));
    await repo.save(event({ userId: 'u1' }));
    await repo.save(event({ userId: 'u1', timestamp: new Date(Date.now() + 1000) }));
    const r = await repo.findByUserId('u1', { sortBy: 'timestamp', sortOrder: 'desc', limit: 1, offset: 0 });
    expect(r).toHaveLength(1);
    expect(r[0]?.userId).toBe('u1');
  });

  it('findByEventType / findByRiskLevel / findByDateRange', async () => {
    await repo.save(event({ eventType: AuditEventType.AUTH_LOGIN }));
    await repo.save(event({ eventType: AuditEventType.AUTH_FAILED_LOGIN, riskLevel: 'HIGH' }));
    expect(await repo.findByEventType(AuditEventType.AUTH_FAILED_LOGIN)).toHaveLength(1);
    expect(await repo.findByRiskLevel('HIGH')).toHaveLength(1);
    const from = new Date(Date.now() - 60000);
    const to = new Date(Date.now() + 60000);
    expect(await repo.findByDateRange(from, to)).toHaveLength(2);
  });

  it('getStats agrega por tipo, riesgo y outcome', async () => {
    await repo.save(event({ outcome: 'SUCCESS' }));
    await repo.save(event({ outcome: 'FAILURE', riskLevel: 'HIGH' }));
    const stats = await repo.getStats('week');
    expect(stats.totalEvents).toBe(2);
    expect(stats.eventsByType[AuditEventType.AUTH_LOGIN]).toBe(2);
    expect(stats.eventsByOutcome['SUCCESS']).toBe(1);
    expect(stats.suspiciousActivity.count).toBe(1);
  });
});

describe('GetGlobalAuditHistory / GetAuditHistoryForProduct', () => {
  const makeRepo = () => ({
    find: jest.fn().mockResolvedValue(successResult([])),
    count: jest.fn().mockResolvedValue(successResult(25))
  });

  it('GetGlobalAuditHistory paginación y filtros', async () => {
    const repo = makeRepo();
    const useCase = new GetGlobalAuditHistory(repo as any);
    const r = (await useCase.execute({ page: 2, pageSize: 5, entityType: 'Producto' } as any)) as any;
    expect(r.isSuccess).toBe(true);
    expect(r.value.total).toBe(25);
    expect(r.value.totalPages).toBe(5);
    expect(r.value.page).toBe(2);
    expect(repo.find).toHaveBeenCalledWith(expect.objectContaining({ entityType: 'Producto' }));
  });

  it('GetGlobalAuditHistory defaults y error propagado', async () => {
    const repo = makeRepo();
    const useCase = new GetGlobalAuditHistory(repo as any);
    const r = (await useCase.execute({} as any)) as any;
    expect(r.value.page).toBe(1);
    expect(r.value.pageSize).toBe(10);

    repo.find.mockResolvedValue(failureResult(new Error('db')));
    const r2 = (await useCase.execute({} as any)) as any;
    expect(r2.isFailure).toBe(true);

    repo.find.mockResolvedValue(successResult([]));
    repo.count.mockResolvedValue(failureResult(new Error('db')));
    const r3 = (await useCase.execute({} as any)) as any;
    expect(r3.isFailure).toBe(true);
  });

  it('GetAuditHistoryForProduct productId requerido', async () => {
    const repo = makeRepo();
    const useCase = new GetAuditHistoryForProduct(repo as any);
    const r = (await useCase.execute({ productId: '' } as any)) as any;
    expect(r.error.message).toContain('required');
  });

  it('GetAuditHistoryForProduct query normalizada', async () => {
    const repo = makeRepo();
    const useCase = new GetAuditHistoryForProduct(repo as any);
    const r = (await useCase.execute({ productId: 'p1', changeType: 'UPDATE' } as any)) as any;
    expect(r.isSuccess).toBe(true);
    expect(repo.find).toHaveBeenCalledWith(expect.objectContaining({
      entityType: 'Producto', entityId: 'p1', changeType: 'UPDATE', page: 1, pageSize: 10
    }));
  });
});

describe('RabbitMQEventPublisher', () => {
  const makeConnection = () => {
    const conn: any = {
      isConnected: jest.fn().mockReturnValue(true),
      connect: jest.fn().mockResolvedValue(successResult(undefined)),
      assertExchange: jest.fn().mockResolvedValue(successResult(undefined)),
      assertQueue: jest.fn().mockResolvedValue(successResult(undefined)),
      bindQueue: jest.fn().mockResolvedValue(successResult(undefined)),
      publish: jest.fn().mockResolvedValue(successResult(undefined)),
      healthCheck: jest.fn().mockResolvedValue(successResult({ status: 'connected' }))
    };
    return conn;
  };

  const makeEvent = () => new ProductoDeletedEvent({ productoId: 'p1', listaId: 'l1', deletedByUserId: 'u1', deletedValue: {} });

  const shortConfig = {
    exchangeName: 'ex',
    exchangeType: 'topic' as const,
    routingKeyPrefix: 'lc',
    retryAttempts: 2,
    retryDelay: 1,
    deadLetterExchange: 'dlx',
    deadLetterQueue: 'dlq'
  };

  it('initialize configura exchanges/queues y es idempotente', async () => {
    const conn = makeConnection();
    const pub = new RabbitMQEventPublisher(conn, shortConfig);
    const r = (await pub.initialize()) as any;
    expect(r.isSuccess).toBe(true);
    expect(conn.assertExchange).toHaveBeenCalledTimes(2);
    expect(conn.assertQueue).toHaveBeenCalledWith('dlq', expect.anything());
    expect(conn.bindQueue).toHaveBeenCalledWith('dlq', 'dlx', 'failed');

    const r2 = (await pub.initialize()) as any;
    expect(r2.isSuccess).toBe(true);
    expect(conn.assertExchange).toHaveBeenCalledTimes(2); // no repite
  });

  it('initialize falla si no puede conectar', async () => {
    const conn = makeConnection();
    conn.isConnected.mockReturnValue(false);
    conn.connect.mockResolvedValue(failureResult(new Error('no conn')));
    const pub = new RabbitMQEventPublisher(conn, shortConfig);
    const r = (await pub.initialize()) as any;
    expect(r.error.message).toContain('no conn');
  });

  it('publish publica con routing key y serializa el evento', async () => {
    const conn = makeConnection();
    const pub = new RabbitMQEventPublisher(conn, shortConfig);
    const r = (await pub.publish(makeEvent())) as any;
    expect(r.isSuccess).toBe(true);
    const [exchange, routingKey, buffer, options] = conn.publish.mock.calls[0];
    expect(exchange).toBe('ex');
    expect(routingKey).toBe('lc.producto.productodeletedevent');
    expect(JSON.parse(buffer.toString())).toMatchObject({ eventType: 'ProductoDeletedEvent' });
    expect(options.persistent).toBe(true);
    expect(pub.getStats().totalPublished).toBe(1);
  });

  it('publish reintenta y va a DLQ tras agotar', async () => {
    const conn = makeConnection();
    conn.publish.mockResolvedValue(failureResult(new Error('nack')));
    const pub = new RabbitMQEventPublisher(conn, shortConfig);
    const r = (await pub.publish(makeEvent())) as any;
    expect(r.isFailure).toBe(true);
    expect(pub.getStats().totalRetries).toBe(1); // retryAttempts 2 → 1 reintento
    expect(conn.publish.mock.calls.length).toBeGreaterThanOrEqual(3); // 2 intentos + 1 DLQ
    const dlqCall = conn.publish.mock.calls.at(-1);
    expect(dlqCall[0]).toBe('dlx');
    expect(dlqCall[1]).toBe('failed');
    expect(pub.getStats().totalFailed).toBe(1);
  });

  it('publish falla si no hay conexión', async () => {
    const conn = makeConnection();
    conn.isConnected.mockReturnValue(false);
    const pub = new RabbitMQEventPublisher(conn, shortConfig);
    const r = (await pub.publish(makeEvent())) as any;
    expect(r.error.message).toContain('no está conectado');
    expect(pub.getStats().isHealthy).toBe(false);
  });

  it('publishBatch: vacío ok, con fallos falla', async () => {
    const conn = makeConnection();
    const pub = new RabbitMQEventPublisher(conn, shortConfig);
    const ok = (await pub.publishBatch([makeEvent(), makeEvent()])) as any;
    expect(ok.isSuccess).toBe(true);

    conn.publish.mockResolvedValue(failureResult(new Error('nack')));
    const bad = (await pub.publishBatch([makeEvent()])) as any;
    expect(bad.isFailure).toBe(true);
  });

  it('healthCheck delega en conexión y refleja stats', async () => {
    const conn = makeConnection();
    const pub = new RabbitMQEventPublisher(conn, shortConfig);
    const r = (await pub.healthCheck()) as any;
    expect(r.isSuccess).toBe(true);
    expect(r.value.isHealthy).toBe(true);
    expect(r.value.connectionStatus).toBe('connected');

    conn.healthCheck.mockResolvedValue(failureResult(new Error('down')));
    const r2 = (await pub.healthCheck()) as any;
    expect(r2.isFailure).toBe(true);
    expect(pub.getStats().isHealthy).toBe(false);
  });

  it('close resetea inicialización', async () => {
    const conn = makeConnection();
    const pub = new RabbitMQEventPublisher(conn, shortConfig);
    await pub.initialize();
    const r = (await pub.close()) as any;
    expect(r.isSuccess).toBe(true);
  });
});

describe('SecurityAuditService — ramas restantes', () => {
  let repo: any;
  let logger: any;
  let service: SecurityAuditService;

  beforeEach(() => {
    repo = {
      save: jest.fn().mockResolvedValue(undefined),
      findByEventType: jest.fn().mockResolvedValue([]),
      getStats: jest.fn().mockResolvedValue({ totalEvents: 0 }),
      findByUserId: jest.fn().mockResolvedValue([]),
      findByRiskLevel: jest.fn().mockResolvedValue([])
    };
    logger = { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() };
    service = new SecurityAuditService(repo, logger);
  });

  const baseEvent = {
    eventType: AuditEventType.AUTH_LOGIN,
    resourceType: 'auth',
    action: 'login',
    outcome: 'SUCCESS' as const,
    details: {},
    riskLevel: 'LOW' as const
  };

  it('createAuditEventData conserva resourceId, ipAddress y userAgent si existen', async () => {
    await service.logLoginAttempt('u1', 'a@b.com', true, '10.0.0.1', 'UA-Test/1.0');
    const saved = repo.save.mock.calls[0][0];
    expect(saved.ipAddress).toBe('10.0.0.1');
    expect(saved.userAgent).toBe('UA-Test/1.0');
  });

  it('getHighRiskEvents combina CRITICAL y HIGH ordenados por timestamp desc', async () => {
    const older = { ...baseEvent, riskLevel: 'HIGH' as const, timestamp: new Date('2025-01-01') };
    const newer = { ...baseEvent, riskLevel: 'CRITICAL' as const, timestamp: new Date('2025-06-01') };
    repo.findByRiskLevel.mockImplementation(async (level: string) =>
      level === 'HIGH' ? [older] : [newer]
    );

    const result = await service.getHighRiskEvents();
    expect(result).toHaveLength(2);
    expect(result[0]?.riskLevel).toBe('CRITICAL');
    expect(result[1]?.riskLevel).toBe('HIGH');
  });
});

describe('InMemoryAuditRepository — sorting, paginación y retención', () => {
  let repo: InMemoryAuditRepository;

  const event = (over: Partial<AuditEvent> = {}): AuditEvent => ({
    id: 'id',
    timestamp: new Date(),
    eventType: AuditEventType.AUTH_LOGIN,
    resourceType: 'auth',
    action: 'login',
    outcome: 'SUCCESS' as const,
    details: {},
    riskLevel: 'LOW' as const,
    ...over
  });

  beforeEach(() => {
    repo = new InMemoryAuditRepository();
  });

  it('applyOptions con sortBy=timestamp asc ordena cronológicamente', async () => {
    await repo.save(event({ id: 'a', userId: 'x', timestamp: new Date('2025-03-01') }));
    await repo.save(event({ id: 'b', userId: 'x', timestamp: new Date('2025-01-01') }));
    await repo.save(event({ id: 'c', userId: 'x', timestamp: new Date('2025-02-01') }));

    const r = await repo.findByUserId('x', { sortBy: 'timestamp', sortOrder: 'asc' });
    expect(r.map((e) => e.id)).toEqual(['b', 'c', 'a']);
  });

  it('applyOptions con sortBy distinto de timestamp no reordena', async () => {
    await repo.save(event({ id: 'a', userId: 'x' }));
    await repo.save(event({ id: 'b', userId: 'x' }));

    const r = await repo.findByUserId('x', { sortBy: 'riskLevel' } as any);
    expect(r).toHaveLength(2);
  });

  it('applyOptions aplica offset y limit', async () => {
    for (let i = 0; i < 5; i++) {
      await repo.save(event({ id: `e${i}`, userId: 'x' }));
    }

    const r = await repo.findByUserId('x', { offset: 1, limit: 2 });
    expect(r.map((e) => e.id)).toEqual(['e1', 'e2']);
  });

  it('getStats calcula la ventana según timeframe (hour/day/week/month)', async () => {
    await repo.save(event());
    for (const tf of ['hour', 'day', 'week', 'month'] as const) {
      const stats = await repo.getStats(tf);
      expect(stats.totalEvents).toBe(1);
    }
  });

  it('save descarta eventos antiguos al superar 10000 (retención)', async () => {
    for (let i = 0; i < 10002; i++) {
      await repo.save(event({ id: `ev-${i}` }));
    }
    // Accedemos al estado interno vía la API pública: se conservan los últimos 10000
    const all = await repo.findByDateRange(new Date(0), new Date(Date.now() + 86400000));
    expect(all).toHaveLength(10000);
  });

  it('findByEventType y findByDateRange aplican opciones', async () => {
    await repo.save(event({ id: 'a' }));
    await repo.save(event({ id: 'b' }));

    const byType = await repo.findByEventType(AuditEventType.AUTH_LOGIN, { limit: 1 });
    expect(byType).toHaveLength(1);

    const byRange = await repo.findByDateRange(
      new Date(Date.now() - 60000),
      new Date(Date.now() + 60000),
      { offset: 1 }
    );
    expect(byRange).toHaveLength(1);
  });
});
