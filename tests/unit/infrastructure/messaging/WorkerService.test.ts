/**
 * Tests unitarios para WorkerService
 * Mockea RabbitMQConsumer (createAndStart): ciclo de vida de workers.
 */

const makeConsumer = (queueName: string) => ({
  getQueueName: () => queueName,
  isConnectedToRabbitMQ: () => true,
  getReconnectAttempts: () => 0,
  disconnect: jest.fn().mockResolvedValue(undefined)
});

jest.mock('../../../../src/infrastructure/messaging/rabbitmq/RabbitMQConsumer', () => ({
  RabbitMQConsumer: { createAndStart: jest.fn() },
  __esModule: true
}));

jest.mock('../../../../src/infrastructure/observability/logger/Logger', () => {
  class Logger {
    info() {}
    warn() {}
    error() {}
    debug() {}
  }
  return { Logger, __esModule: true };
});

import { RabbitMQConsumer } from '../../../../src/infrastructure/messaging/rabbitmq/RabbitMQConsumer';
import { WorkerService, type WorkerServiceConfig } from '../../../../src/infrastructure/messaging/WorkerService';
import { NotificationConsumer } from '../../../../src/infrastructure/messaging/consumers/NotificationConsumer';
import { AuditEventHandler } from '../../../../src/infrastructure/messaging/consumers/AuditEventHandler';

const createAndStart = RabbitMQConsumer.createAndStart as jest.Mock;

const makeConfig = (overrides: Partial<WorkerServiceConfig> = {}): WorkerServiceConfig => ({
  rabbitmqUrl: 'amqp://localhost:5672',
  enabled: true,
  emailService: { send: jest.fn() } as any,
  usuarioRepository: {} as any,
  listaRepository: {} as any,
  permisoRepository: {} as any,
  auditRepository: {} as any,
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } as any,
  ...overrides
});

const makeService = (overrides: Partial<WorkerServiceConfig> = {}) =>
  new WorkerService(makeConfig(overrides));

describe('WorkerService', () => {
  beforeEach(() => {
    // resetMocks:true borra la implementación del mock: reaplicar en cada test
    createAndStart.mockReset();
    createAndStart.mockImplementation(async (_url: string, _handler: unknown, options: { queueName: string }) =>
      makeConsumer(options.queueName)
    );
  });

  it('start deshabilitado no crea consumers', async () => {
    const svc = makeService({ enabled: false });
    await svc.start();
    expect(createAndStart).not.toHaveBeenCalled();
    expect(svc.isWorkerServiceRunning()).toBe(false);
    expect(svc.getConsumersCount()).toBe(0);
  });

  it('start idempotente mientras corre', async () => {
    const svc = makeService();
    await svc.start();
    await svc.start();
    expect(createAndStart).toHaveBeenCalledTimes(2);
  });

  it('start crea NotificationConsumer y AuditEventHandler', async () => {
    const svc = makeService();
    await svc.start();

    expect(createAndStart).toHaveBeenCalledTimes(2);
    // primer consumer: notification
    const [url1, handler1, options1] = createAndStart.mock.calls[0];
    expect(url1).toBe('amqp://localhost:5672');
    expect(handler1).toBeInstanceOf(NotificationConsumer);
    expect(options1.queueName).toBe('notifications_queue');
    expect(options1.deadLetterQueue).toBe('notifications_dlq');

    // segundo consumer: audit
    const [, handler2, options2] = createAndStart.mock.calls[1];
    expect(handler2).toBeInstanceOf(AuditEventHandler);
    expect(options2.queueName).toBe('audit_queue');
    expect(options2.routingKey).toBe('#');

    const status = svc.getStatus();
    expect(status.isRunning).toBe(true);
    expect(status.consumersCount).toBe(2);
    expect(status.consumers.map((c: any) => c.queueName)).toEqual(['notifications_queue', 'audit_queue']);
  });

  it('stop desconecta todos los consumers', async () => {
    const svc = makeService();
    await svc.start();

    // recuperar los consumers creados
    // mock.results guarda Promises: hay que resolverlas
    const consumers = await Promise.all(
      createAndStart.mock.results.map((r: any) => r.value as Promise<any>)
    );
    consumers[0]!.disconnect = jest.fn().mockResolvedValue(undefined);
    consumers[1]!.disconnect = jest.fn().mockResolvedValue(undefined);

    await svc.stop();
    expect(svc.isWorkerServiceRunning()).toBe(false);
    expect(svc.getConsumersCount()).toBe(0);
  });

  it('stop sin running es no-op', async () => {
    const svc = makeService();
    await expect(svc.stop()).resolves.toBeUndefined();
  });

  it('start con fallo detiene y relanza el error', async () => {
    createAndStart
      .mockResolvedValueOnce({ getQueueName: () => 'notifications_queue', isConnectedToRabbitMQ: () => true, getReconnectAttempts: () => 0, disconnect: jest.fn() })
      .mockRejectedValueOnce(new Error('audit fail'));

    const svc = makeService();
    await expect(svc.start()).rejects.toThrow('audit fail');
    expect(svc.isWorkerServiceRunning()).toBe(false);
  });

  it('restart detiene y arranca de nuevo', async () => {
    const svc = makeService();
    await svc.start();
    await svc.restart();
    expect(createAndStart).toHaveBeenCalledTimes(4); // 2 + 2
    expect(svc.isWorkerServiceRunning()).toBe(true);
  });

  it('restartConsumer de notificaciones reinicia ese consumer', async () => {
    const svc = makeService();
    await svc.start();

    const original = await (createAndStart.mock.results[0]?.value as Promise<any>);
    original.disconnect = jest.fn().mockResolvedValue(undefined);

    await svc.restartConsumer('notifications_queue');
    expect(original.disconnect).toHaveBeenCalled();
    // createAndStart: 2 iniciales + 1 reinicio
    expect(createAndStart).toHaveBeenCalledTimes(3);
    const [, , options] = createAndStart.mock.calls[2];
    expect(options.queueName).toBe('notifications_queue');
  });

  it('restartConsumer de cola desconocida lanza error', async () => {
    const svc = makeService();
    await svc.start();
    await expect(svc.restartConsumer('desconocida')).rejects.toThrow('no encontrado');
  });
});
