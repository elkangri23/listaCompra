/**
 * Implementación del servicio Outbox usando Prisma
 * Implementa el patrón Outbox para garantizar consistencia eventual
 *
 * Flujo: los use cases guardan eventos aquí (misma "transacción lógica"),
 * el OutboxWorker consulta los pendientes, los publica a RabbitMQ
 * mediante IEventPublisher y los marca como procesados.
 */

import type {
  IOutboxService,
  OutboxEvent,
  OutboxEventFilters,
  PaginationOptions,
  PaginatedResult,
  OutboxStats
} from '@application/ports/messaging/IOutboxService';
import type { DomainEvent } from '@domain/events/DomainEvent';
import type { Result } from '@shared/result';
import { success, failure } from '@shared/result';
import type { PrismaClient } from '@prisma/client';

export class PrismaOutboxService implements IOutboxService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Convierte un registro de BD al modelo OutboxEvent del puerto
   */
  private toOutboxEvent(record: {
    id: string;
    eventId: string;
    eventType: string;
    eventVersion: number;
    aggregateId: string;
    aggregateType: string;
    eventData: unknown;
    eventContext: unknown;
    occurredOn: Date;
    processed: boolean;
    processedAt: Date | null;
    attempts: number;
    lastAttemptAt: Date | null;
    lastError: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): OutboxEvent {
    const result: OutboxEvent = {
      id: record.id,
      eventId: record.eventId,
      eventType: record.eventType,
      eventVersion: record.eventVersion,
      aggregateId: record.aggregateId,
      aggregateType: record.aggregateType,
      eventData: (record.eventData ?? {}) as Record<string, any>,
      occurredOn: record.occurredOn,
      processed: record.processed,
      ...(record.processedAt ? { processedAt: record.processedAt } : {}),
      attempts: record.attempts,
      ...(record.lastAttemptAt ? { lastAttemptAt: record.lastAttemptAt } : {}),
      ...(record.lastError ? { lastError: record.lastError } : {}),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt
    };

    if (record.eventContext) {
      const ctx = record.eventContext as OutboxEvent['eventContext'];
      if (ctx) {
        result.eventContext = ctx;
      }
    }

    return result;
  }

  /**
   * Construye el where de Prisma a partir de los filtros del puerto
   */
  private buildWhere(filters?: OutboxEventFilters): Record<string, unknown> {
    const where: Record<string, unknown> = {};

    if (!filters) {
      return where;
    }

    if (filters.processed !== undefined) {
      where['processed'] = filters.processed;
    }
    if (filters.eventType) {
      where['eventType'] = filters.eventType;
    }
    if (filters.aggregateType) {
      where['aggregateType'] = filters.aggregateType;
    }
    if (filters.aggregateId) {
      where['aggregateId'] = filters.aggregateId;
    }
    if (filters.fromDate || filters.toDate) {
      where['occurredOn'] = {
        ...(filters.fromDate ? { gte: filters.fromDate } : {}),
        ...(filters.toDate ? { lte: filters.toDate } : {})
      };
    }
    if (filters.maxAttempts !== undefined) {
      where['attempts'] = { lte: filters.maxAttempts };
    }

    return where;
  }

  /**
   * Guarda un evento de dominio en el outbox
   */
  async saveEvent(event: DomainEvent): Promise<Result<OutboxEvent, Error>> {
    try {
      const record = await this.prisma.outboxEvent.create({
        data: {
          eventId: event.eventId,
          eventType: event.eventType,
          eventVersion: event.eventVersion,
          aggregateId: event.aggregateId,
          aggregateType: event.aggregateType,
          eventData: event.eventData as any,
          eventContext: (event.eventContext ?? undefined) as any,
          occurredOn: event.occurredOn
        }
      });

      return success(this.toOutboxEvent(record));
    } catch (error) {
      console.error('❌ Error guardando evento en outbox:', error);
      return failure(error instanceof Error ? error : new Error('Error desconocido'));
    }
  }

  /**
   * Guarda múltiples eventos en una sola transacción
   */
  async saveEvents(events: DomainEvent[]): Promise<Result<OutboxEvent[], Error>> {
    try {
      const records = await this.prisma.$transaction(
        events.map(event =>
          this.prisma.outboxEvent.create({
            data: {
              eventId: event.eventId,
              eventType: event.eventType,
              eventVersion: event.eventVersion,
              aggregateId: event.aggregateId,
              aggregateType: event.aggregateType,
              eventData: event.eventData as any,
              eventContext: (event.eventContext ?? undefined) as any,
              occurredOn: event.occurredOn
            }
          })
        )
      );

      return success(records.map(record => this.toOutboxEvent(record)));
    } catch (error) {
      console.error('❌ Error guardando eventos en outbox (lote):', error);
      return failure(error instanceof Error ? error : new Error('Error desconocido'));
    }
  }

  /**
   * Obtiene eventos pendientes de procesar
   */
  async getPendingEvents(
    filters?: OutboxEventFilters,
    pagination?: PaginationOptions
  ): Promise<Result<PaginatedResult<OutboxEvent>, Error>> {
    try {
      const where = {
        ...this.buildWhere(filters),
        processed: false
      };

      const page = pagination?.page || 1;
      const limit = pagination?.limit || 10;
      const orderByField = pagination?.orderBy || 'createdAt';
      const orderDirection = pagination?.orderDirection || 'asc';

      const [records, total] = await Promise.all([
        this.prisma.outboxEvent.findMany({
          where,
          orderBy: { [orderByField]: orderDirection },
          skip: (page - 1) * limit,
          take: limit
        }),
        this.prisma.outboxEvent.count({ where })
      ]);

      return success({
        items: records.map(record => this.toOutboxEvent(record)),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrevious: page > 1
      });
    } catch (error) {
      console.error('❌ Error obteniendo eventos pendientes del outbox:', error);
      return failure(error instanceof Error ? error : new Error('Error desconocido'));
    }
  }

  /**
   * Marca un evento como procesado
   */
  async markAsProcessed(
    eventId: string,
    processedAt?: Date
  ): Promise<Result<void, Error>> {
    try {
      await this.prisma.outboxEvent.update({
        where: { eventId },
        data: {
          processed: true,
          processedAt: processedAt ?? new Date(),
          lastError: null
        }
      });

      return success(undefined);
    } catch (error) {
      console.error(`❌ Error marcando evento ${eventId} como procesado:`, error);
      return failure(error instanceof Error ? error : new Error('Error desconocido'));
    }
  }

  /**
   * Marca múltiples eventos como procesados
   */
  async markManyAsProcessed(
    eventIds: string[],
    processedAt?: Date
  ): Promise<Result<void, Error>> {
    try {
      if (eventIds.length === 0) {
        return success(undefined);
      }

      await this.prisma.outboxEvent.updateMany({
        where: { eventId: { in: eventIds } },
        data: {
          processed: true,
          processedAt: processedAt ?? new Date(),
          lastError: null
        }
      });

      return success(undefined);
    } catch (error) {
      console.error('❌ Error marcando eventos como procesados (lote):', error);
      return failure(error instanceof Error ? error : new Error('Error desconocido'));
    }
  }

  /**
   * Incrementa el contador de intentos y registra el error
   */
  async incrementAttempts(
    eventId: string,
    error?: string
  ): Promise<Result<void, Error>> {
    try {
      await this.prisma.outboxEvent.update({
        where: { eventId },
        data: {
          attempts: { increment: 1 },
          lastAttemptAt: new Date(),
          ...(error ? { lastError: error } : {})
        }
      });

      return success(undefined);
    } catch (updateError) {
      console.error(`❌ Error incrementando intentos para evento ${eventId}:`, updateError);
      return failure(updateError instanceof Error ? updateError : new Error('Error desconocido'));
    }
  }

  /**
   * Obtiene un evento específico por su ID
   */
  async getEventById(eventId: string): Promise<Result<OutboxEvent | null, Error>> {
    try {
      const record = await this.prisma.outboxEvent.findUnique({
        where: { eventId }
      });

      return success(record ? this.toOutboxEvent(record) : null);
    } catch (error) {
      console.error(`❌ Error obteniendo evento ${eventId} del outbox:`, error);
      return failure(error instanceof Error ? error : new Error('Error desconocido'));
    }
  }

  /**
   * Obtiene eventos con filtros
   */
  async getEvents(
    filters?: OutboxEventFilters,
    pagination?: PaginationOptions
  ): Promise<Result<PaginatedResult<OutboxEvent>, Error>> {
    try {
      const where = this.buildWhere(filters);

      const page = pagination?.page || 1;
      const limit = pagination?.limit || 10;
      const orderByField = pagination?.orderBy || 'createdAt';
      const orderDirection = pagination?.orderDirection || 'desc';

      const [records, total] = await Promise.all([
        this.prisma.outboxEvent.findMany({
          where,
          orderBy: { [orderByField]: orderDirection },
          skip: (page - 1) * limit,
          take: limit
        }),
        this.prisma.outboxEvent.count({ where })
      ]);

      return success({
        items: records.map(record => this.toOutboxEvent(record)),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrevious: page > 1
      });
    } catch (error) {
      console.error('❌ Error obteniendo eventos del outbox:', error);
      return failure(error instanceof Error ? error : new Error('Error desconocido'));
    }
  }

  /**
   * Elimina eventos procesados antiguos
   */
  async cleanupProcessedEvents(
    olderThan: Date,
    _batchSize?: number
  ): Promise<Result<number, Error>> {
    try {
      const result = await this.prisma.outboxEvent.deleteMany({
        where: {
          processed: true,
          processedAt: { lt: olderThan }
        }
      });

      console.log(`🧹 Cleanup de eventos procesados: ${result.count} eliminados (anteriores a ${olderThan.toISOString()})`);
      return success(result.count);
    } catch (error) {
      console.error('❌ Error en cleanup de eventos procesados:', error);
      return failure(error instanceof Error ? error : new Error('Error desconocido'));
    }
  }

  /**
   * Obtiene estadísticas del outbox
   */
  async getStats(): Promise<Result<OutboxStats, Error>> {
    try {
      const [totalEvents, processedEvents, failedEvents, distribution] = await Promise.all([
        this.prisma.outboxEvent.count(),
        this.prisma.outboxEvent.count({ where: { processed: true } }),
        this.prisma.outboxEvent.count({ where: { processed: false, attempts: { gte: 1 } } }),
        this.prisma.outboxEvent.groupBy({
          by: ['eventType'],
          _count: { eventType: true }
        })
      ]);

      const pendingEvents = totalEvents - processedEvents;

      const oldestPending = pendingEvents > 0
        ? await this.prisma.outboxEvent.findFirst({
          where: { processed: false },
          orderBy: { createdAt: 'asc' },
          select: { createdAt: true }
        })
        : null;

      const eventTypeDistribution: Record<string, number> = {};
      for (const entry of distribution) {
        eventTypeDistribution[entry.eventType] = entry._count.eventType;
      }

      return success({
        totalEvents,
        processedEvents,
        pendingEvents,
        failedEvents,
        ...(oldestPending ? { oldestPendingEvent: oldestPending.createdAt } : {}),
        eventTypeDistribution
      });
    } catch (error) {
      console.error('❌ Error obteniendo estadísticas del outbox:', error);
      return failure(error instanceof Error ? error : new Error('Error desconocido'));
    }
  }

  /**
   * Resetea el estado de eventos fallidos para reintentarlos
   */
  async resetFailedEvents(maxAttempts?: number): Promise<Result<number, Error>> {
    try {
      const result = await this.prisma.outboxEvent.updateMany({
        where: {
          processed: false,
          attempts: { gte: maxAttempts ?? 3 }
        },
        data: {
          attempts: 0,
          lastError: null
        }
      });

      console.log(`🔄 Reseteados ${result.count} eventos fallidos para reintento`);
      return success(result.count);
    } catch (error) {
      console.error('❌ Error reseteando eventos fallidos:', error);
      return failure(error instanceof Error ? error : new Error('Error desconocido'));
    }
  }

  /**
   * Verifica la salud del outbox
   */
  async healthCheck(): Promise<Result<{
    status: 'healthy' | 'warning' | 'error';
    message: string;
    pendingCount: number;
    oldestPending?: Date;
  }, Error>> {
    try {
      const pendingCount = await this.prisma.outboxEvent.count({
        where: { processed: false }
      });

      const oldestPending = pendingCount > 0
        ? await this.prisma.outboxEvent.findFirst({
          where: { processed: false },
          orderBy: { createdAt: 'asc' },
          select: { createdAt: true }
        })
        : null;

      // Salud: sin pendientes = healthy; pendientes recientes = healthy;
      // pendientes con más de 5 minutos de antigüedad = warning
      const fiveMinutesMs = 5 * 60 * 1000;
      const oldestAge = oldestPending ? Date.now() - oldestPending.createdAt.getTime() : 0;

      const status: 'healthy' | 'warning' | 'error' =
        pendingCount === 0 ? 'healthy'
          : oldestAge < fiveMinutesMs ? 'healthy'
            : 'warning';

      return success({
        status,
        message:
          pendingCount === 0
            ? 'Outbox vacío, sin eventos pendientes'
            : status === 'healthy'
              ? `Outbox operativo: ${pendingCount} eventos pendientes de publicación`
              : `Outbox con retraso: ${pendingCount} eventos pendientes hace más de 5 minutos`,
        pendingCount,
        ...(oldestPending ? { oldestPending: oldestPending.createdAt } : {})
      });
    } catch (error) {
      console.error('❌ Error en health check del outbox:', error);
      return failure(error instanceof Error ? error : new Error('Error desconocido'));
    }
  }
}
