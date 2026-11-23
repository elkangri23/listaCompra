/**
 * Tests unitarios para OutboxWorker (patrón Outbox, Fase 6)
 * El worker toma eventos pendientes del IOutboxService, los publica con
 * IEventPublisher y los marca como procesados o registra reintentos.
 */

import { OutboxWorker, DEFAULT_WORKER_CONFIG } from '../../../../../src/infrastructure/messaging/outbox/OutboxWorker';
import type { OutboxEvent } from '../../../../../src/application/ports/messaging/IOutboxService';
import { success, failure } from '../../../../../src/shared/result';

jest.mock('../../../../../src/infrastructure/observability/logger/Logger', () => {
  class FakeLogger {
    ai = jest.fn(); http = jest.fn(); error = jest.fn(); warn = jest.fn();
    info = jest.fn(); security = jest.fn(); debug = jest.fn();
    constructor(_context?: string) {}
  }
  return { Logger: FakeLogger, defaultLogger: new FakeLogger('Main') };
});

const makeOutboxEvent = (overrides: Partial<OutboxEvent> = {}): OutboxEvent => ({
  id: 'row-1',
  eventId: 'evt-1',
  eventType: 'ListaUpdatedEvent',
  eventVersion: 1,
  aggregateId: 'lista-1',
  aggregateType: 'Lista',
  eventData: { nombre: 'Lista' },
  occurredOn: new Date(),
  processed: false,
  attempts: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides
});

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe('OutboxWorker', () => {
  let outboxService: any;
  let eventPublisher: any;

  const makeWorker = (configOverrides = {}) =>
    new OutboxWorker(outboxService, eventPublisher, {
      ...DEFAULT_WORKER_CONFIG,
      processingInterval: 50,
      retryDelay: 10,
      ...configOverrides
    });

  beforeEach(() => {
    outboxService = {
      getPendingEvents: jest.fn().mockResolvedValue(success({
        items: [], total: 0, page: 1, limit: 50, totalPages: 0, hasNext: false, hasPrevious: false
      })),
      markAsProcessed: jest.fn().mockResolvedValue(success(undefined)),
      incrementAttempts: jest.fn().mockResolvedValue(success(undefined)),
      resetFailedEvents: jest.fn().mockResolvedValue(success(0))
    };
    eventPublisher = {
      publish: jest.fn().mockResolvedValue({ isSuccess: true })
    };
  });

  afterEach(async () => {
    // Garantizar que ningún interval quede vivo entre tests
    worker?.stop?.();
  });

  let worker: OutboxWorker | null = null;

  it('start/stop gestionan el estado isWorkerRunning', async () => {
    worker = makeWorker();

    expect(worker.isWorkerRunning()).toBe(false);
    await worker.start();
    expect(worker.isWorkerRunning()).toBe(true);

    await worker.stop();
    expect(worker.isWorkerRunning()).toBe(false);
  });

  it('start dos veces falla con error', async () => {
    worker = makeWorker();
    await worker.start();
    const second = await worker.start();

    expect(second.isFailure).toBe(true);
    await worker.stop();
  });

  it('stop sin estar corriendo falla con error', async () => {
    worker = makeWorker();
    const result = await worker.stop();

    expect(result.isFailure).toBe(true);
  });

  it('procesa un evento pendiente: publica y marca como procesado', async () => {
    outboxService.getPendingEvents.mockResolvedValue(success({
        items: [makeOutboxEvent()], total: 1, page: 1, limit: 50, totalPages: 1, hasNext: false, hasPrevious: false
    }));

    worker = makeWorker();
    await worker.start();

    await sleep(250); // deja que el procesamiento inicial (setTimeout 100ms) ejecute
    await worker.stop();

    // El interval repite el lote mientras el evento siga pendiente en el mock:
    // basta con verificar que se publicó y se marcó procesado al menos una vez
    expect(eventPublisher.publish).toHaveBeenCalled();
    expect(eventPublisher.publish).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: 'evt-1', eventType: 'ListaUpdatedEvent' })
    );
    expect(outboxService.markAsProcessed).toHaveBeenCalledWith('evt-1');
    expect(outboxService.incrementAttempts).not.toHaveBeenCalled();
    expect(worker.getStats().successfullyProcessed).toBeGreaterThan(0);
  });

  it('si el publisher devuelve failure incrementa intentos y NO marca procesado', async () => {
    outboxService.getPendingEvents.mockResolvedValue(success({
        items: [makeOutboxEvent()], total: 1, page: 1, limit: 50, totalPages: 1, hasNext: false, hasPrevious: false
    }));
    eventPublisher.publish.mockResolvedValue(failure(new Error('RabbitMQ caído')));

    worker = makeWorker();
    await worker.start();
    await sleep(250);
    await worker.stop();

    expect(outboxService.incrementAttempts).toHaveBeenCalledWith('evt-1', 'RabbitMQ caído');
    expect(outboxService.markAsProcessed).not.toHaveBeenCalled();
    expect(worker.getStats().failedEvents).toBeGreaterThan(0);
  });

  it('si publish lanza excepción se registra el fallo sin romper el worker', async () => {
    outboxService.getPendingEvents.mockResolvedValue(success({
        items: [makeOutboxEvent()], total: 1, page: 1, limit: 50, totalPages: 1, hasNext: false, hasPrevious: false
    }));
    eventPublisher.publish.mockRejectedValue(new Error('timeout'));

    worker = makeWorker();
    await worker.start();
    await sleep(250);
    await worker.stop();

    expect(outboxService.incrementAttempts).toHaveBeenCalledWith('evt-1', 'timeout');
    expect(worker.isWorkerRunning()).toBe(false); // stop manual sigue funcionando
  });

  it('sin eventos pendientes no publica nada', async () => {
    worker = makeWorker();
    await worker.start();
    await sleep(250);
    await worker.stop();

    expect(eventPublisher.publish).not.toHaveBeenCalled();
    expect(worker.getStats().successfullyProcessed).toBe(0);
  });

  it('getStats refleja uptime y estado', async () => {
    worker = makeWorker();

    const stats = worker.getStats();
    expect(stats.isRunning).toBe(false);
    expect(stats.totalProcessed).toBe(0);
    expect(stats.uptime).toBeGreaterThanOrEqual(0);
  });

  it('retryFailedEvents delega en resetFailedEvents', async () => {
    outboxService.resetFailedEvents.mockResolvedValue(success(3));
    worker = makeWorker();

    const result = await worker.retryFailedEvents();

    expect(result.isSuccess).toBe(true);
    expect(result.isSuccess ? result.value : 0).toBe(3);
    expect(outboxService.resetFailedEvents).toHaveBeenCalledWith(DEFAULT_WORKER_CONFIG.maxAttempts);
  });

  it('retryFailedEvents falla si resetFailedEvents falla', async () => {
    outboxService.resetFailedEvents.mockResolvedValue(failure(new Error('DB down')));
    worker = makeWorker();

    const result = await worker.retryFailedEvents();

    expect(result.isFailure).toBe(true);
  });
});
