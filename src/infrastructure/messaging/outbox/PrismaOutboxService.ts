/**
 * Implementación del servicio de Outbox usando Prisma
 * Garantiza consistencia eventual y publicación confiable de eventos
 */

import { PrismaClient } from '@prisma/client';
import type { Result } from '@shared/result';
import { success, failure } from '@shared/result';
import type { 
  IOutboxService, 
  OutboxEvent, 
  OutboxEventFilters, 
  PaginationOptions, 
  PaginatedResult, 
  OutboxStats
} from '@application/ports/messaging/IOutboxService';
import { 
  OutboxError 
} from '@application/ports/messaging/IOutboxService';
import type { DomainEvent } from '@domain/events/DomainEvent';

export class PrismaOutboxService implements IOutboxService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Guarda un evento de dominio en el outbox
   */
  async saveEvent(event: DomainEvent): Promise<Result<OutboxEvent, Error>> {
    try {
      const outboxEvent = await this.prisma.outboxEvent.create({
        data: {
          eventId: event.eventId,
          eventType: event.eventType,
          eventVersion: event.eventVersion,
          aggregateId: event.aggregateId,
          aggregateType: event.aggregateType,
          eventData: event.eventData as any,
          ...(event.eventContext && { eventContext: event.eventContext }),
          occurredOn: event.occurredOn,
          processed: false,
          attempts: 0
        },
      });

      return success(this.mapToOutboxEvent(outboxEvent));
    } catch (error) {
      const err = error as Error;
      return failure(new OutboxError(
        `Error al guardar evento en outbox: ${err.message}`,
        'SAVE_ERROR',
        err
      ));
    }
  }

  /**
   * Guarda múltiples eventos en una transacción
   */
  async saveEvents(events: DomainEvent[]): Promise<Result<OutboxEvent[], Error>> {
    try {
      const outboxEvents = await this.prisma.$transaction(
        events.map(event => 
          this.prisma.outboxEvent.create({
            data: {
              eventId: event.eventId,
              eventType: event.eventType,
              eventVersion: event.eventVersion,
              aggregateId: event.aggregateId,
              aggregateType: event.aggregateType,
              eventData: event.eventData as any,
              ...(event.eventContext && { eventContext: event.eventContext }),
              occurredOn: event.occurredOn,
              processed: false,
              attempts: 0
            },
          })
        )
      );

      return success(outboxEvents.map(event => this.mapToOutboxEvent(event)));
    } catch (error) {
      const err = error as Error;
      return failure(new OutboxError(
        `Error al guardar eventos en outbox: ${err.message}`,
        'SAVE_EVENTS_ERROR',
        err
      ));
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
      const whereClause = this.buildWhereClause({ ...filters, processed: false });
      const orderBy = this.buildOrderBy(pagination);
      const page = pagination?.page || 1;
      const limit = pagination?.limit || 100;
      const skip = (page - 1) * limit;

      const [events, total] = await this.prisma.$transaction([
        this.prisma.outboxEvent.findMany({
          where: whereClause,
          orderBy,
          skip,
          take: limit,
        }),
        this.prisma.outboxEvent.count({
          where: whereClause,
        }),
      ]);

      const totalPages = Math.ceil(total / limit);

      return success({
        items: events.map(event => this.mapToOutboxEvent(event)),
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
      });
    } catch (error) {
      const err = error as Error;
      return failure(new Error(`Error al obtener eventos pendientes: ${err.message}`));
    }
  }

  /**
   * Marca un evento como procesado
   */
  async markAsProcessed(eventId: string, processedAt?: Date): Promise<Result<void, Error>> {
    try {
      const result = await this.prisma.outboxEvent.updateMany({
        where: { eventId },
        data: {
          processed: true,
          processedAt: processedAt ?? new Date(),
          updatedAt: new Date(),
        },
      });

      if (result.count === 0) {
        return failure(new Error(`Evento no encontrado: ${eventId}`));
      }

      return success(undefined);
    } catch (error) {
      const err = error as Error;
      return failure(new Error(`Error al marcar evento como procesado: ${err.message}`));
    }
  }

  /**
   * Marca múltiples eventos como procesados
   */
  async markManyAsProcessed(eventIds: string[], processedAt?: Date): Promise<Result<void, Error>> {
    try {
      await this.prisma.outboxEvent.updateMany({
        where: { eventId: { in: eventIds } },
        data: {
          processed: true,
          processedAt: processedAt ?? new Date(),
          updatedAt: new Date(),
        },
      });

      return success(undefined);
    } catch (error) {
      const err = error as Error;
      return failure(new Error(`Error al marcar eventos como procesados: ${err.message}`));
    }
  }

  /**
   * Incrementa el contador de intentos y registra el error
   */
  async incrementAttempts(eventId: string, error?: string): Promise<Result<void, Error>> {
    try {
      const result = await this.prisma.outboxEvent.updateMany({
        where: { eventId },
        data: {
          attempts: { increment: 1 },
          lastAttemptAt: new Date(),
          lastError: error || null,
          updatedAt: new Date(),
        },
      });

      if (result.count === 0) {
        return failure(new Error(`Evento no encontrado: ${eventId}`));
      }

      return success(undefined);
    } catch (error) {
      const err = error as Error;
      return failure(new Error(`Error al incrementar intentos: ${err.message}`));
    }
  }

  /**
   * Obtiene un evento por su ID
   */
  async getEventById(eventId: string): Promise<Result<OutboxEvent | null, Error>> {
    try {
      const event = await this.prisma.outboxEvent.findUnique({
        where: { eventId },
      });

      return success(event ? this.mapToOutboxEvent(event) : null);
    } catch (error) {
      const err = error as Error;
      return failure(new Error(`Error al obtener evento: ${err.message}`));
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
      const whereClause = this.buildWhereClause(filters);
      const orderBy = this.buildOrderBy(pagination);
      const page = pagination?.page || 1;
      const limit = pagination?.limit || 100;
      const skip = (page - 1) * limit;

      const [events, total] = await this.prisma.$transaction([
        this.prisma.outboxEvent.findMany({
          where: whereClause,
          orderBy,
          skip,
          take: limit,
        }),
        this.prisma.outboxEvent.count({ where: whereClause }),
      ]);

      const totalPages = Math.ceil(total / limit);

      return success({
        items: events.map(event => this.mapToOutboxEvent(event)),
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
      });
    } catch (error) {
      const err = error as Error;
      return failure(new Error(`Error al obtener eventos: ${err.message}`));
    }
  }

  /**
   * Obtiene estadísticas del outbox
   */
  async getStats(): Promise<Result<OutboxStats, Error>> {
    try {
      const [
        totalEvents, 
        processedEvents, 
        failedEvents, 
        oldestPending, 
        eventTypeDistribution
      ] = await this.prisma.$transaction([
        this.prisma.outboxEvent.count(),
        this.prisma.outboxEvent.count({ where: { processed: true } }),
        this.prisma.outboxEvent.count({ where: { processed: false, attempts: { gt: 0 } } }),
        this.prisma.outboxEvent.findFirst({
          where: { processed: false },
          orderBy: { createdAt: 'asc' },
          select: { createdAt: true },
        }),
        this.prisma.outboxEvent.groupBy({
          by: ['eventType'],
          _count: { eventType: true },
          orderBy: { eventType: 'asc' }
        }),
      ]);

      const pendingEvents = totalEvents - processedEvents;
      
      const eventTypes: Record<string, number> = {};
      eventTypeDistribution.forEach(item => {
        if (item._count && typeof item._count === 'object' && 'eventType' in item._count) {
          eventTypes[item.eventType] = item._count.eventType as number;
        }
      });

      const stats: OutboxStats = {
        totalEvents,
        processedEvents,
        pendingEvents,
        failedEvents,
        ...(oldestPending && { oldestPendingEvent: (oldestPending as any).fechaCreacion }),
        eventTypeDistribution: eventTypes,
      };

      return success(stats);
    } catch (error) {
      const err = error as Error;
      return failure(new Error(`Error al obtener estadísticas: ${err.message}`));
    }
  }

  /**
   * Elimina eventos procesados antiguos
   */
  async cleanupProcessedEvents(olderThan: Date): Promise<Result<number, Error>> {
    try {
      const result = await this.prisma.outboxEvent.deleteMany({
        where: {
          processed: true,
          processedAt: { lt: olderThan },
        },
      });

      return success(result.count);
    } catch (error) {
      const err = error as Error;
      return failure(new Error(`Error al limpiar eventos procesados: ${err.message}`));
    }
  }

  /**
   * Resetea eventos fallidos para reintento
   */
  async resetFailedEvents(maxAttempts: number = 3): Promise<Result<number, Error>> {
    try {
      const result = await this.prisma.outboxEvent.updateMany({
        where: {
          processed: false,
          attempts: { gte: maxAttempts },
        },
        data: {
          attempts: 0,
          lastAttemptAt: null,
          lastError: null,
          updatedAt: new Date(),
        },
      });

      return success(result.count);
    } catch (error) {
      const err = error as Error;
      return failure(new Error(`Error al resetear eventos fallidos: ${err.message}`));
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
      const [pendingCount, oldestPending] = await this.prisma.$transaction([
        this.prisma.outboxEvent.count({ where: { processed: false } }),
        this.prisma.outboxEvent.findFirst({
          where: { processed: false },
          orderBy: { createdAt: 'asc' },
          select: { createdAt: true },
        }),
      ]);

      let status: 'healthy' | 'warning' | 'error' = 'healthy';
      let message = 'Outbox funcionando correctamente';

      if (pendingCount > 1000) {
        status = 'error';
        message = `Demasiados eventos pendientes: ${pendingCount}`;
      } else if (pendingCount > 100) {
        status = 'warning';
        message = `Muchos eventos pendientes: ${pendingCount}`;
      } else if (oldestPending && 
        (Date.now() - (oldestPending as any).fechaCreacion.getTime()) > 60000 * 60) { // 1 hour
        status = 'warning';
        message = 'Hay eventos pendientes antiguos';
      }

      return success({
        status,
        message,
        pendingCount,
        ...(oldestPending && { oldestPending: (oldestPending as any).fechaCreacion }),
      });
    } catch (error) {
      const err = error as Error;
      return failure(new Error(`Error en health check: ${err.message}`));
    }
  }

  /**
   * Métodos de utilidad privados
   */
  private buildWhereClause(filters?: OutboxEventFilters): any {
    const where: any = {};

    if (filters?.processed !== undefined) {
      where.processed = filters.processed;
    }

    if (filters?.eventType) {
      where.eventType = filters.eventType;
    }

    if (filters?.aggregateType) {
      where.aggregateType = filters.aggregateType;
    }

    if (filters?.aggregateId) {
      where.aggregateId = filters.aggregateId;
    }

    if (filters?.fromDate || filters?.toDate) {
      where.occurredOn = {};
      if (filters.fromDate) {
        where.occurredOn.gte = filters.fromDate;
      }
      if (filters.toDate) {
        where.occurredOn.lte = filters.toDate;
      }
    }

    if (filters?.maxAttempts !== undefined) {
      where.attempts = { lte: filters.maxAttempts };
    }

    return where;
  }

  private buildOrderBy(pagination?: PaginationOptions): any {
    const orderBy = pagination?.orderBy || 'occurredOn';
    const direction = pagination?.orderDirection || 'asc';
    
    return { [orderBy]: direction };
  }

  /**
   * Mapea un evento de Prisma a OutboxEvent
   */
  private mapToOutboxEvent(prismaEvent: any): OutboxEvent {
    return {
      id: prismaEvent.id,
      eventId: prismaEvent.eventId,
      eventType: prismaEvent.eventType,
      eventVersion: prismaEvent.eventVersion,
      aggregateId: prismaEvent.aggregateId,
      aggregateType: prismaEvent.aggregateType,
      eventData: prismaEvent.eventData as Record<string, any>,
      eventContext: prismaEvent.eventContext as any,
      occurredOn: prismaEvent.occurredOn,
      processed: prismaEvent.processed,
      ...(prismaEvent.processedAt && { processedAt: prismaEvent.processedAt }),
      attempts: prismaEvent.attempts,
      ...(prismaEvent.lastAttemptAt && { lastAttemptAt: prismaEvent.lastAttemptAt }),
      ...(prismaEvent.lastError && { lastError: prismaEvent.lastError }),
      createdAt: prismaEvent.createdAt,
      updatedAt: prismaEvent.updatedAt,
    };
  }
}