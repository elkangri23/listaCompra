/**
 * Worker para procesar eventos del outbox de forma asíncrona
 * Se encarga de tomar eventos pendientes y publicarlos al message broker
 */

import type { Result } from '@shared/result';
import { success, failure } from '@shared/result';
import type { IOutboxService, OutboxEvent } from '@application/ports/messaging/IOutboxService';
import type { IEventPublisher } from '@application/ports/messaging/IEventPublisher';
import type { DomainEvent } from '@domain/events/DomainEvent';

/**
 * Configuración del worker de outbox
 */
export interface OutboxWorkerConfig {
  /** Intervalo entre procesamientos en millisegundos */
  processingInterval: number;
  /** Tamaño del lote de eventos a procesar por iteración */
  batchSize: number;
  /** Número máximo de intentos por evento */
  maxAttempts: number;
  /** Tiempo de espera antes del siguiente intento (en millisegundos) */
  retryDelay: number;
  /** Si debe continuar procesando después de errores */
  continueOnError: boolean;
}

/**
 * Configuración por defecto del worker
 */
export const DEFAULT_WORKER_CONFIG: OutboxWorkerConfig = {
  processingInterval: 5000, // 5 segundos
  batchSize: 50,
  maxAttempts: 3,
  retryDelay: 30000, // 30 segundos
  continueOnError: true,
};

/**
 * Estadísticas de procesamiento del worker
 */
export interface WorkerStats {
  totalProcessed: number;
  successfullyProcessed: number;
  failedEvents: number;
  currentBatchSize: number;
  lastProcessingTime: Date;
  isRunning: boolean;
  uptime: number;
}

/**
 * Worker para procesar eventos del outbox
 */
export class OutboxWorker {
  private isRunning = false;
  private intervalId: NodeJS.Timeout | undefined;
  private stats: WorkerStats;
  private startTime: Date;

  constructor(
    private readonly outboxService: IOutboxService,
    private readonly eventPublisher: IEventPublisher,
    private readonly config: OutboxWorkerConfig = DEFAULT_WORKER_CONFIG
  ) {
    this.startTime = new Date();
    this.stats = {
      totalProcessed: 0,
      successfullyProcessed: 0,
      failedEvents: 0,
      currentBatchSize: 0,
      lastProcessingTime: new Date(),
      isRunning: false,
      uptime: 0,
    };
  }

  /**
   * Inicia el worker de procesamiento
   */
  async start(): Promise<Result<void, Error>> {
    try {
      if (this.isRunning) {
        return failure(new Error('Worker ya está ejecutándose'));
      }

      this.isRunning = true;
      this.stats.isRunning = true;
      this.startTime = new Date();

      // Iniciar el loop de procesamiento
      this.intervalId = setInterval(
        () => this.processOutboxEvents(),
        this.config.processingInterval
      );

      // Procesar inmediatamente al iniciar
      setTimeout(() => this.processOutboxEvents(), 100);

      return success(undefined);
    } catch (error) {
      return failure(error as Error);
    }
  }

  /**
   * Detiene el worker de procesamiento
   */
  async stop(): Promise<Result<void, Error>> {
    try {
      if (!this.isRunning) {
        return failure(new Error('Worker no está ejecutándose'));
      }

      this.isRunning = false;
      this.stats.isRunning = false;

      if (this.intervalId) {
        clearInterval(this.intervalId);
        this.intervalId = undefined;
      }

      return success(undefined);
    } catch (error) {
      return failure(error as Error);
    }
  }

  /**
   * Procesa un lote de eventos del outbox
   */
  private async processOutboxEvents(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      // Obtener eventos pendientes
      const pendingResult = await this.outboxService.getPendingEvents(
        undefined, // sin filtros adicionales
        { page: 1, limit: this.config.batchSize }
      );

      if (pendingResult.isFailure) {
        console.error('Error al obtener eventos pendientes:', pendingResult.error);
        return;
      }

      const pendingEvents = pendingResult.value.items;
      this.stats.currentBatchSize = pendingEvents.length;
      this.stats.lastProcessingTime = new Date();

      if (pendingEvents.length === 0) {
        // No hay eventos pendientes
        return;
      }

      console.log(`Procesando ${pendingEvents.length} eventos del outbox`);

      // Procesar eventos en paralelo (con control de concurrencia)
      const processingPromises = pendingEvents.map((event: OutboxEvent) => 
        this.processEvent(event)
      );

      await Promise.allSettled(processingPromises);

      // Actualizar estadísticas
      this.updateStats();

    } catch (error) {
      console.error('Error en el procesamiento del outbox:', error);
      
      if (!this.config.continueOnError) {
        await this.stop();
      }
    }
  }

  /**
   * Procesa un evento individual
   */
  private async processEvent(outboxEvent: OutboxEvent): Promise<void> {
    try {
      // Convertir OutboxEvent de vuelta a DomainEvent
      const domainEvent = this.outboxEventToDomainEvent(outboxEvent);
      
      try {
        const result = await this.eventPublisher.publish(domainEvent);
        
        if (result && 'isFailure' in result && result.isFailure) {
          await this.handleEventFailure(outboxEvent, result.error?.message || 'Error desconocido');
          return;
        }
        
        // Marcar como procesado
        await this.outboxService.markAsProcessed(outboxEvent.eventId);
        this.stats.successfullyProcessed++;
        console.log(`Evento ${outboxEvent.eventId} procesado exitosamente`);
      } catch (publishError) {
        // Manejar error de publicación
        await this.handleEventFailure(outboxEvent, (publishError as Error).message);
      }

      this.stats.totalProcessed++;

    } catch (error) {
      await this.handleEventFailure(outboxEvent, (error as Error).message);
      this.stats.totalProcessed++;
    }
  }

  /**
   * Maneja el fallo en el procesamiento de un evento
   */
  private async handleEventFailure(outboxEvent: OutboxEvent, errorMessage: string): Promise<void> {
    try {
      // Incrementar intentos
      await this.outboxService.incrementAttempts(outboxEvent.eventId, errorMessage);
      this.stats.failedEvents++;

      const newAttempts = outboxEvent.attempts + 1;

      if (newAttempts >= this.config.maxAttempts) {
        console.error(
          `Evento ${outboxEvent.eventId} falló después de ${this.config.maxAttempts} intentos. Error: ${errorMessage}`
        );
      } else {
        console.warn(
          `Evento ${outboxEvent.eventId} falló (intento ${newAttempts}/${this.config.maxAttempts}). Error: ${errorMessage}`
        );
      }
    } catch (incrementError) {
      console.error(
        `Error al incrementar intentos para evento ${outboxEvent.eventId}:`, 
        incrementError
      );
    }
  }

  /**
   * Convierte un OutboxEvent de vuelta a DomainEvent
   */
  private outboxEventToDomainEvent(outboxEvent: OutboxEvent): DomainEvent {
    return {
      eventId: outboxEvent.eventId,
      eventType: outboxEvent.eventType,
      eventVersion: outboxEvent.eventVersion,
      aggregateId: outboxEvent.aggregateId,
      aggregateType: outboxEvent.aggregateType,
      eventData: outboxEvent.eventData,
      eventContext: outboxEvent.eventContext,
      occurredOn: outboxEvent.occurredOn,
    };
  }

  /**
   * Actualiza las estadísticas del worker
   */
  private updateStats(): void {
    this.stats.uptime = Date.now() - this.startTime.getTime();
  }

  /**
   * Obtiene las estadísticas actuales del worker
   */
  getStats(): WorkerStats {
    this.updateStats();
    return { ...this.stats };
  }

  /**
   * Verifica si el worker está ejecutándose
   */
  isWorkerRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Procesa eventos fallidos para reintento manual
   */
  async retryFailedEvents(): Promise<Result<number, Error>> {
    try {
      const resetResult = await this.outboxService.resetFailedEvents(this.config.maxAttempts);
      
      if (resetResult.isFailure) {
        return failure(resetResult.error);
      }

      const eventsReset = resetResult.value;
      
      if (eventsReset > 0) {
        console.log(`Se han reseteado ${eventsReset} eventos fallidos para reintento`);
        
        // Procesar inmediatamente si el worker está corriendo
        if (this.isRunning) {
          setTimeout(() => this.processOutboxEvents(), 100);
        }
      }

      return success(eventsReset);
    } catch (error) {
      return failure(error as Error);
    }
  }

  /**
   * Realiza un health check del worker
   */
  async healthCheck(): Promise<Result<{
    status: 'healthy' | 'warning' | 'error';
    message: string;
    stats: WorkerStats;
  }, Error>> {
    try {
      const stats = this.getStats();
      let status: 'healthy' | 'warning' | 'error' = 'healthy';
      let message = 'Worker funcionando correctamente';

      if (!this.isRunning) {
        status = 'error';
        message = 'Worker no está ejecutándose';
      } else if (stats.failedEvents > stats.successfullyProcessed * 0.1) { // Más del 10% de fallos
        status = 'warning';
        message = `Tasa alta de fallos: ${stats.failedEvents} de ${stats.totalProcessed} eventos`;
      } else if (Date.now() - stats.lastProcessingTime.getTime() > this.config.processingInterval * 3) {
        status = 'warning';
        message = 'No se ha procesado en mucho tiempo';
      }

      return success({
        status,
        message,
        stats,
      });
    } catch (error) {
      return failure(error as Error);
    }
  }
}