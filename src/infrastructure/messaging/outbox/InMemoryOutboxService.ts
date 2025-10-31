import type {
  IOutboxService,
  OutboxEvent,
  OutboxEventFilters,
  PaginationOptions,
  PaginatedResult,
  OutboxStats,
} from '@application/ports/messaging/IOutboxService';
import type { DomainEvent } from '@domain/events/DomainEvent';
import type { Result } from '@shared/result';
import { success } from '@shared/result';
import { v4 as uuid } from 'uuid';

export class InMemoryOutboxService implements IOutboxService {
  private readonly events: OutboxEvent[] = [];

  async saveEvent(event: DomainEvent): Promise<Result<OutboxEvent, Error>> {
    const outboxEvent = this.toOutboxEvent(event);
    this.events.push(outboxEvent);
    return success(outboxEvent);
  }

  async saveEvents(events: DomainEvent[]): Promise<Result<OutboxEvent[], Error>> {
    const stored: OutboxEvent[] = [];
    for (const event of events) {
      const outboxEvent = this.toOutboxEvent(event);
      this.events.push(outboxEvent);
      stored.push(outboxEvent);
    }
    return success(stored);
  }

  async getPendingEvents(
    _filters?: OutboxEventFilters,
    _pagination?: PaginationOptions
  ): Promise<Result<PaginatedResult<OutboxEvent>, Error>> {
    const pending = this.events.filter(event => !event.processed);
    return success({
      items: pending,
      total: pending.length,
      page: 1,
      limit: pending.length || 1,
      totalPages: 1,
      hasNext: false,
      hasPrevious: false,
    });
  }

  async markAsProcessed(
    eventId: string,
    processedAt: Date = new Date()
  ): Promise<Result<void, Error>> {
    const event = this.events.find(item => item.id === eventId);
    if (event) {
      event.processed = true;
      event.processedAt = processedAt;
    }
    return success(undefined);
  }

  async markManyAsProcessed(
    eventIds: string[],
    processedAt: Date = new Date()
  ): Promise<Result<void, Error>> {
    for (const id of eventIds) {
      await this.markAsProcessed(id, processedAt);
    }
    return success(undefined);
  }

  async incrementAttempts(eventId: string, error?: string): Promise<Result<void, Error>> {
    const event = this.events.find(item => item.id === eventId);
    if (event) {
      event.attempts += 1;
      event.lastAttemptAt = new Date();
      if (error !== undefined) {
        event.lastError = error;
      }
    }
    return success(undefined);
  }

  async getEventById(eventId: string): Promise<Result<OutboxEvent | null, Error>> {
    const event = this.events.find(item => item.id === eventId) ?? null;
    return success(event);
  }

  async getEvents(
    _filters?: OutboxEventFilters,
    _pagination?: PaginationOptions
  ): Promise<Result<PaginatedResult<OutboxEvent>, Error>> {
    return success({
      items: this.events,
      total: this.events.length,
      page: 1,
      limit: this.events.length || 1,
      totalPages: 1,
      hasNext: false,
      hasPrevious: false,
    });
  }

  async cleanupProcessedEvents(olderThan?: Date): Promise<Result<number, Error>> {
    const initial = this.events.length;
    for (let i = this.events.length - 1; i >= 0; i--) {
      const event = this.events[i];
      if (!event) continue;
      if (event.processed && (!olderThan || (event.processedAt && event.processedAt < olderThan))) {
        this.events.splice(i, 1);
      }
    }
    return success(initial - this.events.length);
  }

  async getStats(): Promise<Result<OutboxStats, Error>> {
    const totalEvents = this.events.length;
    const processedEvents = this.events.filter(event => event.processed).length;
    const pendingEvents = totalEvents - processedEvents;
    const failedEvents = this.events.filter(event => event.attempts > 0 && !event.processed).length;

    return success({
      totalEvents,
      processedEvents,
      pendingEvents,
      failedEvents,
      eventTypeDistribution: this.events.reduce<Record<string, number>>((acc, event) => {
        acc[event.eventType] = (acc[event.eventType] ?? 0) + 1;
        return acc;
      }, {}),
    });
  }

  async resetFailedEvents(_maxAttempts?: number): Promise<Result<number, Error>> {
    return success(0);
  }

  async healthCheck(): Promise<Result<{ status: 'healthy' | 'warning' | 'error'; message: string; pendingCount: number; oldestPending?: Date }, Error>> {
    const pending = this.events.filter(event => !event.processed);
    const oldestPending = pending.reduce<Date | undefined>((oldest, event) => {
      if (!oldest || event.occurredOn < oldest) {
        return event.occurredOn;
      }
      return oldest;
    }, undefined);

    const payload: {
      status: 'healthy';
      message: string;
      pendingCount: number;
      oldestPending?: Date;
    } = {
      status: 'healthy',
      message: 'In-memory outbox operativo',
      pendingCount: pending.length,
    };

    if (oldestPending) {
      payload.oldestPending = oldestPending;
    }

    return success(payload);
  }

  private toOutboxEvent(event: DomainEvent): OutboxEvent {
    const base: OutboxEvent = {
      id: uuid(),
      eventId: event.eventId,
      eventType: event.eventType,
      eventVersion: event.eventVersion,
      aggregateId: event.aggregateId,
      aggregateType: event.aggregateType,
      eventData: event.eventData,
      occurredOn: event.occurredOn,
      processed: false,
      attempts: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    if (event.eventContext) {
      base.eventContext = event.eventContext;
    }

    return base;
  }
}
