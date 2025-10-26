/**
 * Implementación real de IEventPublisher usando RabbitMQ
 * Publica eventos a través de RabbitMQ usando amqplib
 */

import * as amqp from 'amqplib';
import type { IEventPublisher } from '@application/ports/messaging/IEventPublisher';

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
        if (this.channel) {
          await this.channel.assertExchange(this.exchangeName, this.exchangeType, {
            durable: true,
            autoDelete: false,
          });
        }
      }

      this.isConnected = true;
      console.log('✅ RabbitMQ conectado y configurado');
      
    } catch (error) {
      console.error('❌ Error al conectar con RabbitMQ:', error);
      throw new Error(`Failed to connect to RabbitMQ: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Publica un evento a RabbitMQ
   */
  async publish(exchange: string, routingKey: string, message: any): Promise<void> {
    try {
      if (!this.isConnected || !this.channel) {
        console.warn('⚠️ RabbitMQ no está conectado. Intentando reconectar...');
        await this.initialize();
      }

      if (!this.channel) {
        throw new Error('No se pudo establecer canal de RabbitMQ');
      }

      // Usar el exchange proporcionado, o el por defecto si no se especifica
      const targetExchange = exchange || this.exchangeName;
      
      const messagePayload = JSON.stringify({
        routingKey,
        message,
        timestamp: new Date().toISOString(),
        id: this.generateEventId(),
      });

      const published = this.channel.publish(
        targetExchange,
        routingKey,
        Buffer.from(messagePayload),
        {
          persistent: true,
          contentType: 'application/json',
          timestamp: Date.now(),
        }
      );

      if (!published) {
        throw new Error('Error al publicar evento en RabbitMQ');
      }

      console.log(`📨 Evento publicado: ${targetExchange} -> ${routingKey}`);
      
    } catch (error) {
      console.error('❌ Error al publicar evento:', error);
      
      // Si hay error de conexión, marcamos como desconectado
      if (error instanceof Error && error.message.includes('Channel closed')) {
        this.isConnected = false;
      }
      
      throw error;
    }
  }

  /**
   * Cierra la conexión con RabbitMQ
   */
  async close(): Promise<void> {
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
      console.log('🔒 Conexión RabbitMQ cerrada correctamente');
      
    } catch (error) {
      console.error('❌ Error al cerrar conexión RabbitMQ:', error);
    }
  }

  /**
   * Verifica si está conectado a RabbitMQ
   */
  isHealthy(): boolean {
    return this.isConnected && this.connection !== null && this.channel !== null;
  }

  /**
   * Genera un ID único para el evento
   */
  private generateEventId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Getter para compatibilidad con la interfaz (si se necesita en tests)
   */
  getConnectionStatus(): 'connected' | 'disconnected' | 'error' {
    if (this.isConnected && this.connection && this.channel) {
      return 'connected';
    }
    return 'disconnected';
  }
}