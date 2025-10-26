import { describe, test, expect, beforeEach } from '@jest/globals';
import { MockEventPublisher } from '../../../../src/infrastructure/messaging/MockEventPublisher';

describe('MockEventPublisher', () => {
  let mockEventPublisher: MockEventPublisher;

  beforeEach(() => {
    mockEventPublisher = new MockEventPublisher();
  });

  test('should publish events successfully', async () => {
    const exchange = 'lista_compra_exchange';
    const routingKey = 'usuario.registrado';
    const message = { 
      userId: '123', 
      email: 'test@example.com',
      timestamp: new Date().toISOString()
    };

    await mockEventPublisher.publish(exchange, routingKey, message);

    const events = mockEventPublisher.getPublishedEvents();
    expect(events).toHaveLength(1);
    
    const firstEvent = events[0];
    if (!firstEvent) {
      throw new Error('No se encontró el primer evento');
    }
    
    expect(firstEvent.exchange).toBe(exchange);
    expect(firstEvent.routingKey).toBe(routingKey);
    expect(firstEvent.message).toEqual(message);
  });

  test('should track multiple events', async () => {
    await mockEventPublisher.publish('exchange1', 'key1', { data: 'test1' });
    await mockEventPublisher.publish('exchange2', 'key2', { data: 'test2' });

    const events = mockEventPublisher.getPublishedEvents();
    expect(events).toHaveLength(2);
  });

  test('should provide correct stats', async () => {
    const initialStats = mockEventPublisher.getStats();
    expect(initialStats.totalEvents).toBe(0);
    expect(initialStats.lastEvent).toBeNull();

    await mockEventPublisher.publish('test', 'test', { data: 'test' });

    const finalStats = mockEventPublisher.getStats();
    expect(finalStats.totalEvents).toBe(1);
    expect(finalStats.lastEvent).toBeDefined();
  });

  test('should clear events', async () => {
    await mockEventPublisher.publish('test', 'test', { data: 'test' });
    expect(mockEventPublisher.getPublishedEvents()).toHaveLength(1);

    mockEventPublisher.clearEvents();
    expect(mockEventPublisher.getPublishedEvents()).toHaveLength(0);
  });
});