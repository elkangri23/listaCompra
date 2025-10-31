import { EventEmitter } from 'events';
import type { Response } from 'express';
import { RealTimeGateway } from '../../../../src/infrastructure/realtime/RealTimeGateway';

describe('RealTimeGateway', () => {
  class MockSseResponse extends EventEmitter {
    public headers: Record<string, string> = {};
    public chunks: string[] = [];
    public flushed = false;

    setHeader(name: string, value: string): void {
      this.headers[name] = value;
    }

    write(chunk: string): boolean {
      this.chunks.push(chunk);
      return true;
    }

    flushHeaders(): void {
      this.flushed = true;
    }

    end(): void {
      this.emit('close');
    }
  }

  let gateway: RealTimeGateway;

  beforeEach(() => {
    gateway = new RealTimeGateway();
  });

  afterEach(() => {
    gateway.shutdown();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('registra suscriptores SSE y envía evento de conexión', () => {
    jest.useFakeTimers();
    const response = new MockSseResponse();

    gateway.subscribe('lista-1', 'usuario-1', response as unknown as Response);

    expect(response.headers['Content-Type']).toBe('text/event-stream');
    expect(response.flushed).toBe(true);
    expect(response.chunks[0]).toContain('LIST_STREAM_CONNECTED');

    response.end();
    jest.runOnlyPendingTimers();
  });

  it('difunde eventos a suscriptores activos', () => {
    jest.useFakeTimers();
    const response = new MockSseResponse();

    gateway.subscribe('lista-2', 'usuario-2', response as unknown as Response);

    gateway.publish({
      listId: 'lista-2',
      type: 'PRODUCT_ADDED',
      payload: { id: 'producto-1' },
      actorId: 'usuario-2',
    });

    const eventChunk = response.chunks.find(chunk => chunk.includes('PRODUCT_ADDED'));
    expect(eventChunk).toBeDefined();
    expect(eventChunk).toContain('producto-1');

    response.end();
    jest.runOnlyPendingTimers();
  });
});
