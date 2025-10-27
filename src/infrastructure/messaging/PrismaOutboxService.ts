/**
 * Implementación simplificada del servicio Outbox usando Prisma
 * Implementa el patrón Outbox para garantizar consistencia eventual
 */

import type { IOutboxService, OutboxEvent } from '@application/ports/messaging/IOutboxService';
import type { DomainEvent } from '@domain/events/DomainEvent';
import type { Result } from '@shared/result';
import { success, failure } from '@shared/result';
import { PrismaClient } from '@prisma/client';

export class PrismaOutboxService implements IOutboxService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Guarda un evento de dominio en el outbox
   */
  async saveEvent(event: DomainEvent): Promise<Result<OutboxEvent, Error>> {
    try {
      // Por ahora, solo logueamos el evento hasta tener la tabla outbox correcta
      console.log(`📝 Evento guardado en outbox (simulado): ${event.eventType} (${event.eventId})`);
      
      // Simular un OutboxEvent
      const outboxEvent: OutboxEvent = {
        id: `outbox_${Date.now()}`,
        eventId: event.eventId,
        eventType: event.eventType,
        eventVersion: event.eventVersion,
        aggregateId: event.aggregateId,
        aggregateType: event.aggregateType,
        eventData: event.eventData,
        eventContext: event.eventContext,
        occurredOn: event.occurredOn,
        processed: false,
        processedAt: undefined,
        error: undefined,
        retryCount: 0,
        attempts: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      return success(outboxEvent);
    } catch (error) {
      console.error('❌ Error al guardar evento en outbox:', error);
      return failure(error as Error);
    }
  }

  /**
   * Obtiene eventos no procesados del outbox
   */
  async getUnprocessedEvents(batchSize: number = 100): Promise<Result<OutboxEvent[], Error>> {
    try {
      // Por ahora retornamos un array vacío
      console.log(`📋 Obteniendo eventos no procesados (simulado): batch size ${batchSize}`);
      return success([]);
    } catch (error) {
      console.error('❌ Error al obtener eventos no procesados:', error);
      return failure(error as Error);
    }
  }

  /**
   * Marca un evento como procesado
   */
  async markAsProcessed(eventId: string): Promise<Result<void, Error>> {
    try {
      console.log(`✅ Evento marcado como procesado (simulado): ${eventId}`);
      return success(undefined);
    } catch (error) {
      console.error(`❌ Error al marcar evento como procesado: ${eventId}`, error);
      return failure(error as Error);
    }
  }

  /**
   * Marca un evento como fallido e incrementa el contador de reintentos
   */
  async markAsFailed(eventId: string, error: string): Promise<Result<void, Error>> {
    try {
      console.log(`❌ Evento marcado como fallido (simulado): ${eventId} - ${error}`);
      return success(undefined);
    } catch (prismaError) {
      console.error(`❌ Error al marcar evento como fallido: ${eventId}`, prismaError);
      return failure(prismaError as Error);
    }
  }

  /**
   * Elimina eventos procesados más antiguos que la fecha especificada
   */
  async cleanupProcessedEvents(olderThan: Date): Promise<Result<number, Error>> {
    try {
      console.log(`🧹 Limpieza de outbox (simulado): eventos anteriores a ${olderThan.toISOString()}`);
      return success(0);
    } catch (error) {
      console.error('❌ Error al limpiar eventos procesados:', error);
      return failure(error as Error);
    }
  }

  /**
   * Obtiene estadísticas del outbox
   */
  async getStatistics(): Promise<Result<{
    totalEvents: number;
    processedEvents: number;
    pendingEvents: number;
    failedEvents: number;
  }, Error>> {
    try {
      return success({
        totalEvents: 0,
        processedEvents: 0,
        pendingEvents: 0,
        failedEvents: 0
      });
    } catch (error) {
      console.error('❌ Error al obtener estadísticas del outbox:', error);
      return failure(error as Error);
    }
  }
}