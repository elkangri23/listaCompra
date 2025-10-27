/**
 * Implementación de IEventPublisher usando RabbitMQ
 * Publica eventos de dominio a través de RabbitMQ con patrones de confiabilidad
 */

import type { IEventPublisher } from '@application/ports/messaging/IEventPublisher';
import type { DomainEvent } from '@domain/events/DomainEvent';
import type { Result } from '@shared/result';
import { success, failure } from '@shared/result';
import { RabbitMQConnection } from './RabbitMQConnection';

/**
 * Configuración del publisher
 */
export interface EventPublisherConfig {
  exchangeName: string;
  exchangeType: 'direct' | 'topic' | 'fanout' | 'headers';
  routingKeyPrefix: string;
  retryAttempts: number;
  retryDelay: number;
  deadLetterExchange: string;
  deadLetterQueue: string;
}

/**
 * Configuración por defecto
 */
export const DEFAULT_PUBLISHER_CONFIG: EventPublisherConfig = {
  exchangeName: 'listacompra.events',
  exchangeType: 'topic',
  routingKeyPrefix: 'listacompra',
  retryAttempts: 3,
  retryDelay: 1000,
  deadLetterExchange: 'listacompra.dlx',
  deadLetterQueue: 'listacompra.dlq',
};

/**
 * Estadísticas del publisher
 */
export interface PublisherStats {
  totalPublished: number;
  totalFailed: number;
  totalRetries: number;
  lastPublishedAt?: Date;
  lastFailedAt?: Date;
  isHealthy: boolean;
}

/**
 * Publisher de eventos usando RabbitMQ
 */
export class RabbitMQEventPublisher implements IEventPublisher {
  private stats: PublisherStats;
  private isInitialized = false;

  constructor(
    private readonly connection: RabbitMQConnection,
    private readonly config: EventPublisherConfig = DEFAULT_PUBLISHER_CONFIG
  ) {
    this.stats = {
      totalPublished: 0,
      totalFailed: 0,
      totalRetries: 0,
      isHealthy: true,
    };
  }

  /**
   * Inicializa el publisher configurando exchanges y colas
   */
  async initialize(): Promise<Result<void, Error>> {
    try {
      if (this.isInitialized) {
        return success(undefined);
      }

      // Asegurar que estamos conectados
      if (!this.connection.isConnected()) {
        const connectResult = await this.connection.connect();
        if (connectResult.isFailure) {
          return failure(connectResult.error);
        }
      }

      // Configurar exchange principal
      const exchangeResult = await this.connection.assertExchange(
        this.config.exchangeName,
        this.config.exchangeType,
        { durable: true }
      );

      if (exchangeResult.isFailure) {
        return failure(exchangeResult.error);
      }

      // Configurar Dead Letter Exchange
      const dlxResult = await this.connection.assertExchange(
        this.config.deadLetterExchange,
        'direct',
        { durable: true }
      );

      if (dlxResult.isFailure) {
        return failure(dlxResult.error);
      }

      // Configurar Dead Letter Queue
      const dlqResult = await this.connection.assertQueue(
        this.config.deadLetterQueue,
        { durable: true }
      );

      if (dlqResult.isFailure) {
        return failure(dlqResult.error);
      }

      // Vincular DLQ con DLX
      const bindResult = await this.connection.bindQueue(
        this.config.deadLetterQueue,
        this.config.deadLetterExchange,
        'failed'
      );

      if (bindResult.isFailure) {
        return failure(bindResult.error);
      }

      this.isInitialized = true;
      console.log('RabbitMQ EventPublisher inicializado correctamente');
      
      return success(undefined);

    } catch (error) {
      return failure(error as Error);
    }
  }

  /**
   * Publica un evento de dominio
   */
  async publish(event: DomainEvent): Promise<Result<void, Error>> {
    try {
      // Asegurar inicialización
      if (!this.isInitialized) {
        const initResult = await this.initialize();
        if (initResult.isFailure) {
          return initResult;
        }
      }

      // Verificar conexión
      if (!this.connection.isConnected()) {
        this.stats.isHealthy = false;
        return failure(new Error('RabbitMQ no está conectado'));
      }

      // Serializar evento
      const messageBody = this.serializeEvent(event);
      const routingKey = this.buildRoutingKey(event);

      // Intentar publicar con reintentos
      const publishResult = await this.publishWithRetry(
        this.config.exchangeName,
        routingKey,
        messageBody,
        event
      );

      if (publishResult.isSuccess) {
        this.updateStats(true);
      } else {
        this.updateStats(false);
        // Enviar a Dead Letter Queue en caso de fallo final
        await this.sendToDeadLetter(event, publishResult.error);
      }

      return publishResult;

    } catch (error) {
      this.updateStats(false);
      return failure(error as Error);
    }
  }

  /**
   * Publica múltiples eventos de forma batch
   */
  async publishBatch(events: DomainEvent[]): Promise<Result<void, Error>> {
    try {
      const results = await Promise.allSettled(
        events.map(event => this.publish(event))
      );

      const failures = results
        .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
        .map(result => result.reason);

      if (failures.length > 0) {
        const errorMessage = `${failures.length} de ${events.length} eventos fallaron`;
        return failure(new Error(errorMessage));
      }

      const failedResults = results
        .filter((result): result is PromiseFulfilledResult<Result<void, Error>> => 
          result.status === 'fulfilled' && result.value.isFailure
        );

      if (failedResults.length > 0) {
        const errorMessage = `${failedResults.length} de ${events.length} eventos fallaron`;
        return failure(new Error(errorMessage));
      }

      return success(undefined);

    } catch (error) {
      return failure(error as Error);
    }
  }

  /**
   * Obtiene las estadísticas del publisher
   */
  getStats(): PublisherStats {
    return { ...this.stats };
  }

  /**
   * Realiza un health check
   */
  async healthCheck(): Promise<Result<{
    isHealthy: boolean;
    connectionStatus: string;
    stats: PublisherStats;
  }, Error>> {
    try {
      const connectionHealth = await this.connection.healthCheck();
      
      if (connectionHealth.isFailure) {
        this.stats.isHealthy = false;
        return failure(connectionHealth.error);
      }

      const isHealthy = this.stats.isHealthy && 
        this.connection.isConnected() && 
        connectionHealth.value.status === 'connected';

      return success({
        isHealthy,
        connectionStatus: connectionHealth.value.status,
        stats: this.getStats(),
      });

    } catch (error) {
      this.stats.isHealthy = false;
      return failure(error as Error);
    }
  }

  /**
   * Cierra el publisher
   */
  async close(): Promise<Result<void, Error>> {
    try {
      this.isInitialized = false;
      // La conexión se gestiona externamente
      return success(undefined);
    } catch (error) {
      return failure(error as Error);
    }
  }

  /**
   * Serializa un evento para enviarlo por RabbitMQ
   */
  private serializeEvent(event: DomainEvent): Buffer {
    const messageData = {
      eventId: event.eventId,
      eventType: event.eventType,
      aggregateId: event.aggregateId,
      aggregateType: event.aggregateType,
      eventData: event.eventData,
      occurredOn: event.occurredOn.toISOString(),
      eventVersion: event.eventVersion,
      eventContext: event.eventContext || {},
    };

    return Buffer.from(JSON.stringify(messageData), 'utf-8');
  }

  /**
   * Construye la routing key basada en el evento
   */
  private buildRoutingKey(event: DomainEvent): string {
    const { routingKeyPrefix } = this.config;
    const eventType = event.eventType.toLowerCase();
    const aggregateType = event.aggregateType.toLowerCase();
    
    return `${routingKeyPrefix}.${aggregateType}.${eventType}`;
  }

  /**
   * Publica un mensaje con lógica de reintentos
   */
  private async publishWithRetry(
    exchange: string,
    routingKey: string,
    content: Buffer,
    event: DomainEvent,
    attempt = 1
  ): Promise<Result<void, Error>> {
    try {
      const options = {
        persistent: true,
        messageId: event.eventId,
        timestamp: event.occurredOn.getTime(),
        type: event.eventType,
        headers: {
          aggregateId: event.aggregateId,
          aggregateType: event.aggregateType,
          eventVersion: event.eventVersion,
          attempt,
        },
      };

      const publishResult = await this.connection.publish(
        exchange,
        routingKey,
        content,
        options
      );

      if (publishResult.isSuccess) {
        console.log(`Evento publicado: ${event.eventType} (${event.eventId})`);
        return success(undefined);
      }

      // Si falla y tenemos intentos restantes, reintentar
      if (attempt < this.config.retryAttempts) {
        this.stats.totalRetries++;
        
        console.warn(`Reintentando publicación del evento ${event.eventId} (intento ${attempt + 1}/${this.config.retryAttempts})`);
        
        // Esperar antes del siguiente intento
        await this.delay(this.config.retryDelay * attempt);
        
        return this.publishWithRetry(exchange, routingKey, content, event, attempt + 1);
      }

      return publishResult;

    } catch (error) {
      if (attempt < this.config.retryAttempts) {
        this.stats.totalRetries++;
        
        console.warn(`Error publicando evento ${event.eventId}, reintentando (intento ${attempt + 1}/${this.config.retryAttempts}):`, error);
        
        await this.delay(this.config.retryDelay * attempt);
        
        return this.publishWithRetry(exchange, routingKey, content, event, attempt + 1);
      }

      return failure(error as Error);
    }
  }

  /**
   * Envía un evento a la Dead Letter Queue
   */
  private async sendToDeadLetter(event: DomainEvent, originalError: Error): Promise<void> {
    try {
      const dlqMessage = {
        originalEvent: event,
        error: {
          message: originalError.message,
          stack: originalError.stack,
          timestamp: new Date().toISOString(),
        },
        failedAt: new Date().toISOString(),
        attempts: this.config.retryAttempts,
      };

      const content = Buffer.from(JSON.stringify(dlqMessage), 'utf-8');
      
      await this.connection.publish(
        this.config.deadLetterExchange,
        'failed',
        content,
        {
          persistent: true,
          headers: {
            originalEventId: event.eventId,
            originalEventType: event.eventType,
            failureReason: 'publish_failed',
          },
        }
      );

      console.error(`Evento ${event.eventId} enviado a Dead Letter Queue debido a: ${originalError.message}`);

    } catch (dlqError) {
      console.error(`Error enviando evento ${event.eventId} a Dead Letter Queue:`, dlqError);
    }
  }

  /**
   * Actualiza las estadísticas del publisher
   */
  private updateStats(success: boolean): void {
    if (success) {
      this.stats.totalPublished++;
      this.stats.lastPublishedAt = new Date();
      this.stats.isHealthy = true;
    } else {
      this.stats.totalFailed++;
      this.stats.lastFailedAt = new Date();
      
      // Considerar no saludable si la tasa de fallo es muy alta
      const totalAttempts = this.stats.totalPublished + this.stats.totalFailed;
      if (totalAttempts > 10) {
        const failureRate = this.stats.totalFailed / totalAttempts;
        this.stats.isHealthy = failureRate < 0.1; // Menos del 10% de fallos
      }
    }
  }

  /**
   * Utility para esperar un tiempo determinado
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}