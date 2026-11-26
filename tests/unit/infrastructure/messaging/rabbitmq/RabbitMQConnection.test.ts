/**
 * Tests unitarios para RabbitMQConnection
 * Mockea amqplib: conexión, canal, exchanges/colas, publish, healthCheck y reconexión.
 */

jest.mock('amqplib', () => ({
  __esModule: true,
  default: {
    connect: jest.fn()
  }
}));

import amqp from 'amqplib';
import { RabbitMQConnection, DEFAULT_RABBITMQ_CONFIG } from '../../../../../src/infrastructure/messaging/rabbitmq/RabbitMQConnection';

const mockConnect = amqp.connect as jest.Mock;

const makeConnectionMock = () => {
  const conn: any = {
    createChannel: jest.fn(),
    close: jest.fn(),
    on: jest.fn()
  };
  const channel: any = {
    prefetch: jest.fn(),
    close: jest.fn(),
    assertExchange: jest.fn().mockResolvedValue({}),
    assertQueue: jest.fn().mockImplementation(async (q: string) => ({ queue: q })),
    bindQueue: jest.fn().mockResolvedValue({}),
    publish: jest.fn().mockReturnValue(true),
    checkQueue: jest.fn().mockResolvedValue({})
  };
  conn.createChannel.mockResolvedValue(channel);
  return { conn, channel };
};

describe('RabbitMQConnection', () => {
  beforeEach(() => {
    mockConnect.mockReset();
  });

  it('estado inicial desconectado', () => {
    const c = new RabbitMQConnection();
    expect(c.getStatus()).toBe('disconnected');
    expect(c.isConnected()).toBe(false);
    expect(c.getChannel()).toBeUndefined();
    expect(c.getStats().status).toBe('disconnected');
    expect(c.getStats().reconnectAttempts).toBe(0);
  });

  it('connect() establece conexión, canal y prefetch', async () => {
    const { conn, channel } = makeConnectionMock();
    mockConnect.mockResolvedValue(conn);

    const c = new RabbitMQConnection();
    const result = await c.connect();

    expect(result.isSuccess).toBe(true);
    expect(mockConnect).toHaveBeenCalledWith(
      expect.stringContaining('amqp://guest:guest@localhost:5672/'),
      expect.objectContaining({ heartbeat: DEFAULT_RABBITMQ_CONFIG.heartbeat })
    );
    expect(channel.prefetch).toHaveBeenCalledWith(100);
    expect(c.isConnected()).toBe(true);
    expect(c.getStatus()).toBe('connected');
    expect(c.getStats().connectedAt).toBeInstanceOf(Date);
  });

  it('connect() es idempotente si ya está conectado', async () => {
    const { conn } = makeConnectionMock();
    mockConnect.mockResolvedValue(conn);
    const c = new RabbitMQConnection();
    await c.connect();
    const result = await c.connect();
    expect(result.isSuccess).toBe(true);
    expect(mockConnect).toHaveBeenCalledTimes(1);
  });

  it('buildConnectionString codifica el vhost', async () => {
    const { conn } = makeConnectionMock();
    mockConnect.mockResolvedValue(conn);
    const c = new RabbitMQConnection({ ...DEFAULT_RABBITMQ_CONFIG, vhost: 'mi vhost' });
    await c.connect();
    expect(mockConnect.mock.calls[0][0]).toContain('/mi%20vhost');
  });

  it('connect() fallido devuelve failure y programa reconexión', async () => {
    jest.useFakeTimers();
    try {
      mockConnect.mockRejectedValue(new Error('ECONNREFUSED'));
      const c = new RabbitMQConnection({ ...DEFAULT_RABBITMQ_CONFIG, maxRetries: 2, retryDelay: 1000 });
      const result = await c.connect();

      expect(result.isFailure).toBe(true);
      expect((result as { error: Error }).error.message).toContain('ECONNREFUSED');
      expect(c.getStatus()).toBe('failed');
      expect(c.getStats().lastError).toContain('ECONNREFUSED');
      // un timer de reconexión quedó programado
      expect(jest.getTimerCount()).toBeGreaterThan(0);
      jest.clearAllTimers();
    } finally {
      jest.useRealTimers();
    }
  });

  it('disconnect() cierra canal y conexión', async () => {
    const { conn, channel } = makeConnectionMock();
    mockConnect.mockResolvedValue(conn);
    const c = new RabbitMQConnection();
    await c.connect();

    const result = await c.disconnect();
    expect(result.isSuccess).toBe(true);
    expect(channel.close).toHaveBeenCalled();
    expect(conn.close).toHaveBeenCalled();
    expect(c.isConnected()).toBe(false);
    expect(c.getStatus()).toBe('disconnected');
    expect(c.getStats().disconnectedAt).toBeInstanceOf(Date);
  });

  it('disconnect() sin conexión previa también es success', async () => {
    const c = new RabbitMQConnection();
    expect((await c.disconnect()).isSuccess).toBe(true);
  });

  it('assertExchange/assertQueue/bindQueue/publish sin canal fallan', async () => {
    const c = new RabbitMQConnection();
    expect((await c.assertExchange('ex') as { error: Error }).error.message).toContain('canal');
    expect((await c.assertQueue('q') as { error: Error }).error.message).toContain('canal');
    expect((await c.bindQueue('q', 'ex', 'k') as { error: Error }).error.message).toContain('canal');
    expect((await c.publish('ex', 'k', Buffer.from('x')) as { error: Error }).error.message).toContain('canal');
  });

  it('operaciones con canal usan el mock', async () => {
    const { conn, channel } = makeConnectionMock();
    mockConnect.mockResolvedValue(conn);
    const c = new RabbitMQConnection();
    await c.connect();

    expect((await c.assertExchange('ex', 'direct', { durable: false })).isSuccess).toBe(true);
    expect(channel.assertExchange).toHaveBeenCalledWith('ex', 'direct', expect.objectContaining({ durable: false }));

    const qResult = await c.assertQueue('q1');
    expect((qResult as { value: any }).value.queue).toBe('q1');

    expect((await c.bindQueue('q1', 'ex', 'key')).isSuccess).toBe(true);
    expect(channel.bindQueue).toHaveBeenCalledWith('q1', 'ex', 'key');
  });

  it('publish devuelve failure si el canal está saturado y cuenta estadísticas', async () => {
    const { conn, channel } = makeConnectionMock();
    channel.publish.mockReturnValue(false);
    mockConnect.mockResolvedValue(conn);
    const c = new RabbitMQConnection();
    await c.connect();

    const result = await c.publish('ex', 'k', Buffer.from('x'));
    expect(result.isFailure).toBe(true);
    const stats = c.getStats();
    expect(stats.totalMessages).toBe(1);
    expect(stats.failedMessages).toBe(1);
  });

  it('publish ok incrementa totalMessages sin fallos', async () => {
    const { conn } = makeConnectionMock();
    mockConnect.mockResolvedValue(conn);
    const c = new RabbitMQConnection();
    await c.connect();
    await c.publish('ex', 'k', Buffer.from('x'), { persistent: false });
    const stats = c.getStats();
    expect(stats.totalMessages).toBe(1);
    expect(stats.failedMessages).toBe(0);
  });

  it('healthCheck mide latencia y devuelve estado', async () => {
    const { conn } = makeConnectionMock();
    mockConnect.mockResolvedValue(conn);
    const c = new RabbitMQConnection();
    await c.connect();

    const result = await c.healthCheck();
    const value = (result as { value: any }).value;
    expect(value.status).toBe('connected');
    expect(value.stats).toBeDefined();
    expect(value.latency).toBeGreaterThanOrEqual(0);
  });

  it('healthCheck sin canal devuelve estado disconnected', async () => {
    const c = new RabbitMQConnection();
    const result = await c.healthCheck();
    expect((result as { value: any }).value.status).toBe('disconnected');
  });

  it('eventos de error/close de la conexión activan reconexión', async () => {
    jest.useFakeTimers();
    try {
      const { conn } = makeConnectionMock();
      mockConnect.mockResolvedValue(conn);
      const c = new RabbitMQConnection({ ...DEFAULT_RABBITMQ_CONFIG, maxRetries: 1, retryDelay: 500 });
      await c.connect();

      // el listener de 'close' se registró
      const closeHandler = conn.on.mock.calls.find((call: any[]) => call[0] === 'close')[1];
      closeHandler();

      expect(c.getStatus()).toBe('reconnecting');
      jest.clearAllTimers();
    } finally {
      jest.useRealTimers();
    }
  });
});
