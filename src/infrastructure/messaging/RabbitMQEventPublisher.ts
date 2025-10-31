/**
 * Implementación simplificada de IEventPublisher usando RabbitMQ
 * Publica eventos a través de RabbitMQ usando amqplib
 */

import * as amqp from 'amqplib';
import type { IEventPublisher } from '@application/ports/messaging/IEventPublisher';
import type { DomainEvent } from '@domain/events/DomainEvent';
import type { Result } from '@shared/result';
import { success, failure } from '@shared/result';

export class RabbitMQEventPublisher implements IEventPublisher {
  private connection: any = null;
  private channel: any = null;
  private readonly connectionUrl: string;
  private readonly exchangeName = 'lista_compra_events';
  private readonly exchangeType = 'topic';
  private isConnected = false;

  constructor(connectionUrl: string = 'amqp://guest:guest@localhost:5672') {
    this.connectionUrl = connectionUrl;
  }

  /**
   * Inicializa la conexión con RabbitMQ
   */
  async initialize(): Promise<void> {
    try {
      if (this.isConnected) {
        return;
      }

      console.log('🔗 Conectando a RabbitMQ...', this.connectionUrl);
      
      // Crear conexión
      this.connection = await amqp.connect(this.connectionUrl);
      
      // Manejar eventos de conexión
      if (this.connection) {
        this.connection.on('error', (err: Error) => {
          console.error('❌ Error de conexión RabbitMQ:', err.message);
          this.isConnected = false;
        });

        this.connection.on('close', () => {
          console.log('🔌 Conexión RabbitMQ cerrada');
          this.isConnected = false;
        });

        // Crear canal
        this.channel = await this.connection.createChannel();
        
        // Declarar el exchange
        await this.channel.assertExchange(this.exchangeName, this.exchangeType, {
          durable: true
        });

        this.isConnected = true;
        console.log('✅ RabbitMQ conectado exitosamente');
      }

    } catch (error) {
      console.error('❌ Error inicializando RabbitMQ:', error);
      this.isConnected = false;
      throw error;
    }
  }

  /**
   * Publica un evento de dominio
   */
  async publish(event: DomainEvent): Promise<Result<void, Error>> {
    try {
      if (!this.isConnected) {
        await this.initialize();
      }

      if (!this.channel) {
        return failure(new Error('Canal RabbitMQ no disponible'));
      }

      // Construir routing key basado en el evento
      const routingKey = `${event.aggregateType.toLowerCase()}.${event.eventType.toLowerCase()}`;
      
      // Serializar evento
      const messageBody = JSON.stringify({
        eventId: event.eventId,
        eventType: event.eventType,
        aggregateId: event.aggregateId,
        aggregateType: event.aggregateType,
        eventData: event.eventData,
        occurredOn: event.occurredOn.toISOString(),
        eventVersion: event.eventVersion,
        eventContext: event.eventContext,
      });

      // Publicar mensaje
      const published = this.channel.publish(
        this.exchangeName,
        routingKey,
        Buffer.from(messageBody),
        {
          persistent: true,
          messageId: event.eventId,
          timestamp: event.occurredOn.getTime(),
          type: event.eventType,
        }
      );

      if (!published) {
        return failure(new Error('No se pudo publicar el evento (canal saturado)'));
      }

      console.log(`📨 Evento publicado: ${event.eventType} (${event.eventId})`);
      return success(undefined);

    } catch (error) {
      console.error('❌ Error publicando evento:', error);
      return failure(error as Error);
    }
  }

  /**
   * Cierra la conexión
   */
  async close(): Promise<Result<void, Error>> {
    try {
      if (this.channel) {
        await this.channel.close();
        this.channel = null;
      }

      if (this.connection) {
        await this.connection.close();
        this.connection = null;
      }

      this.isConnected = false;
      console.log('✅ RabbitMQ desconectado');
      return success(undefined);

    } catch (error) {
      console.error('❌ Error desconectando RabbitMQ:', error);
      return failure(error as Error);
    }
  }
}