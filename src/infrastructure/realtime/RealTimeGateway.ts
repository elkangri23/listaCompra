/**
 * Servicio de sincronización en tiempo real basado en Server-Sent Events (SSE)
 * Mantiene conexiones activas por lista y emite eventos a los clientes conectados
 */

import type { Response } from 'express';
import { Logger } from '@infrastructure/observability/logger/Logger';

export type ListSyncEventType =
  | 'LIST_STREAM_CONNECTED'
  | 'LIST_CREATED'
  | 'LIST_UPDATED'
  | 'LIST_DELETED'
  | 'LIST_RESTORED'
  | 'PRODUCT_ADDED'
  | 'PRODUCT_UPDATED'
  | 'PRODUCT_DELETED'
  | 'PRODUCT_MARKED';

export interface ListSyncEvent<T = unknown> {
  listId: string;
  type: ListSyncEventType | string;
  payload: T;
  actorId?: string;
  timestamp?: string;
}

interface ListSubscriber {
  userId: string;
  response: Response;
  keepAlive: NodeJS.Timeout;
}

export class RealTimeGateway {
  private readonly logger = new Logger('RealTimeGateway');
  private readonly subscribers = new Map<string, Set<ListSubscriber>>();
  private readonly keepAliveIntervalMs = 30000;

  subscribe(listId: string, userId: string, response: Response): void {
    response.setHeader('Content-Type', 'text/event-stream');
    response.setHeader('Cache-Control', 'no-cache');
    response.setHeader('Connection', 'keep-alive');
    response.setHeader('X-Accel-Buffering', 'no');

    if (typeof response.flushHeaders === 'function') {
      response.flushHeaders();
    }

    const subscriber: ListSubscriber = {
      userId,
      response,
      keepAlive: setInterval(() => {
        this.safeWrite(response, this.formatEvent('keep-alive', {
          timestamp: new Date().toISOString(),
        }));
      }, this.keepAliveIntervalMs),
    };

    const listSubscribers = this.subscribers.get(listId) ?? new Set<ListSubscriber>();
    listSubscribers.add(subscriber);
    this.subscribers.set(listId, listSubscribers);

    let cleaned = false;

    const cleanup = () => {
      if (cleaned) {
        return;
      }
      cleaned = true;
      clearInterval(subscriber.keepAlive);
      listSubscribers.delete(subscriber);
      if (listSubscribers.size === 0) {
        this.subscribers.delete(listId);
      }
      this.logger.debug('Conexión SSE cerrada', { listId, userId });
    };

    response.on('close', cleanup);
    response.on('finish', cleanup);
    response.on('error', cleanup);

    this.safeWrite(response, this.formatEvent('LIST_STREAM_CONNECTED', {
      listId,
      userId,
      timestamp: new Date().toISOString(),
    }));

    this.logger.debug('Suscriptor SSE registrado', { listId, userId, total: listSubscribers.size });
  }

  publish<T>(event: ListSyncEvent<T>): void {
    const timestamp = event.timestamp ?? new Date().toISOString();
    const subscribers = this.subscribers.get(event.listId);

    if (!subscribers || subscribers.size === 0) {
      this.logger.debug('Evento descartado: sin suscriptores activos', {
        listId: event.listId,
        type: event.type,
      });
      return;
    }

    const payload = {
      ...event,
      timestamp,
    };

    const message = this.formatEvent(event.type, payload);

    for (const subscriber of subscribers) {
      this.safeWrite(subscriber.response, message);
    }

    this.logger.debug('Evento SSE emitido', {
      listId: event.listId,
      type: event.type,
      subscribers: subscribers.size,
    });
  }

  private formatEvent(eventName: string, data: Record<string, unknown>): string {
    return `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
  }

  private safeWrite(response: Response, chunk: string): void {
    try {
      response.write(chunk);
    } catch (error) {
      this.logger.warn('Error enviando evento SSE', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Limpia todas las suscripciones activas y cierra los intervalos
   * Diseñado para usarse en entornos de testing para evitar handles abiertos
   */
  public shutdown(): void {
    for (const [, subscribers] of this.subscribers.entries()) {
      for (const subscriber of subscribers) {
        clearInterval(subscriber.keepAlive);
        try {
          subscriber.response.end();
        } catch (error) {
          this.logger.warn('Error cerrando respuesta SSE en shutdown', {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    this.subscribers.clear();
  }
}
