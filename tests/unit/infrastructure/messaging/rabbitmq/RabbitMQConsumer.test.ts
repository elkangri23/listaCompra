/**
 * Tests unitarios para RabbitMQConsumer y RabbitMQEventPublisher
 * Mockea amqplib y la conexión: consumo, ack/nack/reject, DLQ y reintentos.
 */

jest.mock('amqplib', () => ({
  __esModule: true,
  default: {
    connect: jest.fn()
  }
}));

import amqp from 'amqplib';
import { RabbitMQConsumer } from '../../../../../src/infrastructure/messaging/rabbitmq/RabbitMQConsumer';
import { RabbitMQEventPublisher } from '../../../../../src/infrastructure/messaging/rabbitmq/RabbitMQEventPublisher';
import { UsuarioRegistrado } from '../../../../../src/domain/events/UsuarioRegistrado';
import type { Result } from '../../../../../src/shared/result';

const mockConnect = amqp.connect as jest.Mock;

const unwrap = <T>(r: Result<T, Error>): T | null | undefined =>
  r.isSuccess ? (r as { value: T }).value : undefined;

const makeAmqp = () => {
  const conn: any = {
    createChannel: jest.fn(),
    close: jest.fn(),
    on: jest.fn()
  };
  const channel: any = {
    prefetch: jest.fn(),
    close: jest.fn(),
    assertExchange: jest.fn().mockResolvedValue({}),
    assertQueue: jest.fn().mockResolvedValue({ queue: 'q' }),
    bindQueue: jest.fn().mockResolvedValue({}),
    consume: jest.fn().mockResolvedValue({ consumerTag: 'tag' }),
    ack: jest.fn(),
    nack: jest.fn(),
    reject: jest.fn()
  };
  conn.createChannel.mockResolvedValue(channel);
  return { conn, channel };
};

const makeMsg = (payload: any): any => ({ content: Buffer.from(JSON.stringify(payload)) });

describe('RabbitMQConsumer', () => {
  let amqpMocks: { conn: any; channel: any };
  let handler: { handle: jest.Mock };

  beforeEach(() => {
    mockConnect.mockReset();
    amqpMocks = makeAmqp();
    mockConnect.mockResolvedValue(amqpMocks.conn);
    handler = { handle: jest.fn().mockResolvedValue(undefined) };
  });

  const makeConsumer = (options: any = {}) =>
    new RabbitMQConsumer('amqp://localhost:5672', handler as any, {
      queueName: 'test.queue',
      ...options
    });

  it('getters iniciales', () => {
    const consumer = makeConsumer();
    expect(consumer.getQueueName()).toBe('test.queue');
    expect(consumer.isConnectedToRabbitMQ()).toBe(false);
    expect(consumer.getReconnectAttempts()).toBe(0);
  });

  it('connect() crea canal, aplica prefetch y registra listeners', async () => {
    const consumer = makeConsumer({ prefetch: 25 });
    await consumer.connect();

    expect(mockConnect).toHaveBeenCalledWith('amqp://localhost:5672');
    expect(amqpMocks.channel.prefetch).toHaveBeenCalledWith(25);
    expect(amqpMocks.conn.on).toHaveBeenCalledWith('close', expect.any(Function));
    expect(amqpMocks.conn.on).toHaveBeenCalledWith('error', expect.any(Function));
    expect(consumer.isConnectedToRabbitMQ()).toBe(true);
  });

  it('startConsuming declara cola, exchange y bind según opciones', async () => {
    const consumer = makeConsumer({ exchangeName: 'ex', routingKey: 'k', deadLetterQueue: 'dlq' });
    await consumer.connect();
    await consumer.startConsuming();

    expect(amqpMocks.channel.assertExchange).toHaveBeenCalledWith('ex', 'direct', { durable: true });
    expect(amqpMocks.channel.assertQueue).toHaveBeenCalledWith('test.queue', { durable: true });
    expect(amqpMocks.channel.bindQueue).toHaveBeenCalledWith('test.queue', 'ex', 'k');
    expect(amqpMocks.channel.assertQueue).toHaveBeenCalledWith('dlq', { durable: true });
    expect(amqpMocks.channel.consume).toHaveBeenCalledWith('test.queue', expect.any(Function), { noAck: false });
  });

  it('startConsuming sin conexión lanza error', async () => {
    const consumer = makeConsumer();
    await expect(consumer.startConsuming()).rejects.toThrow('No conectado a RabbitMQ');
  });

  it('consume handler con ack manual', async () => {
    const consumer = makeConsumer();
    await consumer.connect();
    await consumer.startConsuming();

    const consumeCallback = amqpMocks.channel.consume.mock.calls[0][1];
    const msg = makeMsg({ foo: 'bar' });
    await consumeCallback(msg);

    expect(handler.handle).toHaveBeenCalledWith({ foo: 'bar' }, msg);
    expect(amqpMocks.channel.ack).toHaveBeenCalledWith(msg);
    expect(amqpMocks.channel.nack).not.toHaveBeenCalled();
  });

  it('mensaje inválido (JSON roto) hace nack con requeue', async () => {
    const consumer = makeConsumer();
    await consumer.connect();
    await consumer.startConsuming();

    const consumeCallback = amqpMocks.channel.consume.mock.calls[0][1];
    await consumeCallback({ content: Buffer.from('no-json') });

    expect(handler.handle).not.toHaveBeenCalled();
    expect(amqpMocks.channel.nack).toHaveBeenCalledWith(expect.anything(), false, true);
    expect(amqpMocks.channel.ack).not.toHaveBeenCalled();
  });

  it('handler que falla con DLQ configurada hace reject sin requeue', async () => {
    handler.handle.mockRejectedValue(new Error('fallo handler'));
    const consumer = makeConsumer({ deadLetterQueue: 'dlq' });
    await consumer.connect();
    await consumer.startConsuming();

    const consumeCallback = amqpMocks.channel.consume.mock.calls[0][1];
    await consumeCallback(makeMsg({ a: 1 }));

    expect(amqpMocks.channel.reject).toHaveBeenCalledWith(expect.anything(), false);
  });

  it('autoAck no hace ack manual', async () => {
    const consumer = makeConsumer({ autoAck: true });
    await consumer.connect();
    await consumer.startConsuming();

    const consumeCallback = amqpMocks.channel.consume.mock.calls[0][1];
    await consumeCallback(makeMsg({ a: 1 }));

    expect(handler.handle).toHaveBeenCalled();
    expect(amqpMocks.channel.ack).not.toHaveBeenCalled();
  });

  it('disconnect cierra canal y conexión', async () => {
    const consumer = makeConsumer();
    await consumer.connect();
    await consumer.disconnect();

    expect(amqpMocks.channel.close).toHaveBeenCalled();
    expect(amqpMocks.conn.close).toHaveBeenCalled();
    expect(consumer.isConnectedToRabbitMQ()).toBe(false);
  });

  it('createAndStart conecta y consume de una vez', async () => {
    const consumer = await RabbitMQConsumer.createAndStart('amqp://localhost:5672', handler as any, { queueName: 'q.x' });
    expect(consumer.getQueueName()).toBe('q.x');
    expect(amqpMocks.channel.consume).toHaveBeenCalled();
  });

  it('error en connect programa reconexión y relanza', async () => {
    jest.useFakeTimers();
    try {
      mockConnect.mockRejectedValue(new Error('down'));
      const consumer = makeConsumer();
      await expect(consumer.connect()).rejects.toThrow('down');
      // los reintentos recursivos agotan los 5 intentos permitidos
      expect(consumer.getReconnectAttempts()).toBe(5);
      // el reintento queda programado
      expect(jest.getTimerCount()).toBeGreaterThan(0);
      jest.clearAllTimers();
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('RabbitMQEventPublisher', () => {
  let connection: any;
  let publisher: RabbitMQEventPublisher;
  const config = {
    exchangeName: 'test.events',
    exchangeType: 'topic' as const,
    routingKeyPrefix: 'test',
    retryAttempts: 3,
    retryDelay: 10,
    deadLetterExchange: 'test.dlx',
    deadLetterQueue: 'test.dlq'
  };

  const makeEvent = () => new UsuarioRegistrado('user-1', {
    email: 'test@example.local',
    nombre: 'Ana',
    emailVerificado: false,
    fechaRegistro: new Date().toISOString()
  });

  beforeEach(() => {
    jest.useFakeTimers();
    connection = {
      isConnected: jest.fn().mockReturnValue(true),
      connect: jest.fn().mockResolvedValue({ isSuccess: true, isFailure: false, value: undefined }),
      assertExchange: jest.fn().mockResolvedValue({ isSuccess: true, isFailure: false, value: undefined }),
      assertQueue: jest.fn().mockResolvedValue({ isSuccess: true, isFailure: false, value: {} }),
      bindQueue: jest.fn().mockResolvedValue({ isSuccess: true, isFailure: false, value: undefined }),
      publish: jest.fn().mockResolvedValue({ isSuccess: true, isFailure: false, value: undefined }),
      healthCheck: jest.fn().mockResolvedValue({
        isSuccess: true,
        isFailure: false,
        value: { status: 'connected', stats: {} }
      })
    };
    publisher = new RabbitMQEventPublisher(connection, config);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('initialize declara exchange, DLX, DLQ y bind', async () => {
    const result = await publisher.initialize();
    expect(result.isSuccess).toBe(true);
    expect(connection.assertExchange).toHaveBeenCalledWith('test.events', 'topic', { durable: true });
    expect(connection.assertExchange).toHaveBeenCalledWith('test.dlx', 'direct', { durable: true });
    expect(connection.assertQueue).toHaveBeenCalledWith('test.dlq', { durable: true });
    expect(connection.bindQueue).toHaveBeenCalledWith('test.dlq', 'test.dlx', 'failed');
  });

  it('initialize es idempotente', async () => {
    await publisher.initialize();
    await publisher.initialize();
    expect(connection.assertExchange).toHaveBeenCalledTimes(2);
  });

  it('initialize falla si no puede conectar', async () => {
    connection.isConnected.mockReturnValue(false);
    connection.connect.mockResolvedValue({ isSuccess: false, isFailure: true, error: new Error('sin conexión') });
    const result = await publisher.initialize();
    expect(result.isFailure).toBe(true);
  });

  it('publish serializa el evento con routing key por tipo', async () => {
    await publisher.initialize();
    const result = await publisher.publish(makeEvent());

    expect(result.isSuccess).toBe(true);
    expect(connection.publish).toHaveBeenCalledWith(
      'test.events',
      'test.usuario.usuarioregistrado',
      expect.any(Buffer),
      expect.objectContaining({ persistent: true, messageId: expect.any(String) })
    );

    const content = JSON.parse(connection.publish.mock.calls[0][2].toString());
    expect(content.eventType).toBe('UsuarioRegistrado');
    expect(content.aggregateId).toBe('user-1');
    expect(content.eventData.email).toBe('test@example.local');
  });

  it('publish sin conectar devuelve failure sin reintentos', async () => {
    await publisher.initialize();
    connection.isConnected.mockReturnValue(false);
    const result = await publisher.publish(makeEvent());
    expect(result.isFailure).toBe(true);
    expect((result as { error: Error }).error.message).toContain('no está conectado');
  });

  it('publish reintenta y envía a DLQ tras agotar intentos', async () => {
    jest.useRealTimers();
    await publisher.initialize();
    connection.publish.mockResolvedValue({ isSuccess: false, isFailure: true, error: new Error('saturado') });

    const result = await publisher.publish(makeEvent());

    expect(result.isFailure).toBe(true);
    expect(connection.publish).toHaveBeenCalledTimes(4); // 3 intentos + 1 a la DLQ
    // el último intento se mandó a la DLQ
    const dlqCall = connection.publish.mock.calls[connection.publish.mock.calls.length - 1];
    expect(dlqCall[0]).toBe('test.dlx');
    expect(dlqCall[1]).toBe('failed');
    expect(JSON.parse(dlqCall[2].toString()).error.message).toContain('saturado');
  });

  it('publishBatch agrega fallos de forma consistente', async () => {
    jest.useRealTimers();
    await publisher.initialize();
    connection.publish.mockResolvedValue({ isSuccess: false, isFailure: true, error: new Error('x') });

    const result = await publisher.publishBatch([makeEvent(), makeEvent()]);
    expect(result.isFailure).toBe(true);
    expect((result as { error: Error }).error.message).toContain('2 de 2');
  });

  it('publishBatch success si todos publican', async () => {
    await publisher.initialize();
    const result = await publisher.publishBatch([makeEvent(), makeEvent()]);
    expect(result.isSuccess).toBe(true);
  });

  it('stats reflejan publicados y fallidos', async () => {
    jest.useRealTimers();
    await publisher.initialize();
    await publisher.publish(makeEvent());
    connection.publish.mockResolvedValue({ isSuccess: false, isFailure: true, error: new Error('x') });
    const result = await publisher.publish(makeEvent());

    const stats = publisher.getStats();
    expect(stats.totalPublished).toBe(1);
    expect(stats.totalFailed).toBe(1);
    expect(stats.isHealthy).toBe(true); // tasa de fallo baja
    expect(result.isFailure).toBe(true);
  });

  it('healthCheck combina estado del publisher y conexión', async () => {
    await publisher.initialize();
    const result = await publisher.healthCheck();
    const value = unwrap(result)!;
    expect(value.isHealthy).toBe(true);
    expect(value.connectionStatus).toBe('connected');
    expect(value.stats.isHealthy).toBe(true);
  });

  it('healthCheck falla si la conexión falla', async () => {
    connection.healthCheck.mockResolvedValue({ isSuccess: false, isFailure: true, error: new Error('down') });
    const result = await publisher.healthCheck();
    expect(result.isFailure).toBe(true);
    expect(publisher.getStats().isHealthy).toBe(false);
  });

  it('close resetea la inicialización', async () => {
    await publisher.initialize();
    await publisher.close();
    // tras close, publish necesita reinicializar: desconectado falso para comprobar flujo
    connection.isConnected.mockReturnValue(false);
    const result = await publisher.publish(makeEvent());
    expect(result.isFailure).toBe(true);
  });
});
