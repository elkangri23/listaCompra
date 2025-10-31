/**
 * Puerto (interface) para el servicio de Outbox
 * Implementa el patrón Outbox para garantizar consistencia eventual
 * y publicación confiable de eventos de dominio
 */

import type { Result } from '@shared/result';
import type { DomainEvent } from '@domain/events/DomainEvent';

/**
 * Representación de un evento en el outbox
 */
export interface OutboxEvent {
  id: string;
  eventId: string;
  eventType: string;
  eventVersion: number;
  aggregateId: string;
  aggregateType: string;
  eventData: Record<string, any>;
  eventContext?: {
    userId?: string;
    correlationId?: string;
    causationId?: string;
    userAgent?: string;
    ipAddress?: string;
  };
  occurredOn: Date;
  processed: boolean;
  processedAt?: Date;
  attempts: number;
  lastAttemptAt?: Date;
  lastError?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Filtros para consultar eventos del outbox
 */
export interface OutboxEventFilters {
  processed?: boolean;
  eventType?: string;
  aggregateType?: string;
  aggregateId?: string;
  fromDate?: Date;
  toDate?: Date;
  maxAttempts?: number;
}

/**
 * Opciones de paginación
 */
export interface PaginationOptions {
  page: number;
  limit: number;
  orderBy?: 'occurredOn' | 'createdAt' | 'attempts';
  orderDirection?: 'asc' | 'desc';
}

/**
 * Resultado paginado
 */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

/**
 * Estadísticas del outbox
 */
export interface OutboxStats {
  totalEvents: number;
  processedEvents: number;
  pendingEvents: number;
  failedEvents: number;
  oldestPendingEvent?: Date;
  averageProcessingTime?: number;
  eventTypeDistribution: Record<string, number>;
}

/**
 * Interfaz del servicio de Outbox
 */
export interface IOutboxService {
  /**
   * Guarda un evento de dominio en el outbox
   * Este método debe ser llamado en la misma transacción que el cambio de estado
   */
  saveEvent(event: DomainEvent): Promise<Result<OutboxEvent, Error>>;

  /**
   * Guarda múltiples eventos en una sola transacción
   */
  saveEvents(events: DomainEvent[]): Promise<Result<OutboxEvent[], Error>>;

  /**
   * Obtiene eventos pendientes de procesar
   */
  getPendingEvents(
    filters?: OutboxEventFilters,
    pagination?: PaginationOptions
  ): Promise<Result<PaginatedResult<OutboxEvent>, Error>>;

  /**
   * Marca un evento como procesado
   */
  markAsProcessed(
    eventId: string,
    processedAt?: Date
  ): Promise<Result<void, Error>>;

  /**
   * Marca múltiples eventos como procesados
   */
  markManyAsProcessed(
    eventIds: string[],
    processedAt?: Date
  ): Promise<Result<void, Error>>;

  /**
   * Incrementa el contador de intentos y registra el error
   */
  incrementAttempts(
    eventId: string,
    error?: string
  ): Promise<Result<void, Error>>;

  /**
   * Obtiene un evento específico por su ID
   */
  getEventById(eventId: string): Promise<Result<OutboxEvent | null, Error>>;

  /**
   * Obtiene eventos con filtros
   */
  getEvents(
    filters?: OutboxEventFilters,
    pagination?: PaginationOptions
  ): Promise<Result<PaginatedResult<OutboxEvent>, Error>>;

  /**
   * Elimina eventos procesados antiguos
   */
  cleanupProcessedEvents(
    olderThan: Date
  ): Promise<Result<number, Error>>;

  /**
   * Obtiene estadísticas del outbox
   */
  getStats(): Promise<Result<OutboxStats, Error>>;

  /**
   * Resetea el estado de eventos fallidos para reintentarlos
   */
  resetFailedEvents(
    maxAttempts?: number
  ): Promise<Result<number, Error>>;

  /**
   * Verifica la salud del outbox
   */
  healthCheck(): Promise<Result<{
    status: 'healthy' | 'warning' | 'error';
    message: string;
    pendingCount: number;
    oldestPending?: Date;
  }, Error>>;
}

/**
 * Errores específicos del Outbox
 */
export class OutboxError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public override readonly cause?: Error
  ) {
    super(message);
    this.name = 'OutboxError';
  }
}

export class OutboxEventNotFoundError extends OutboxError {
  constructor(eventId: string) {
    super(`Outbox event not found: ${eventId}`, 'OUTBOX_EVENT_NOT_FOUND');
  }
}

export class OutboxTransactionError extends OutboxError {
  constructor(message: string, cause?: Error) {
    super(message, 'OUTBOX_TRANSACTION_ERROR', cause);
  }
}