/**
 * Consumer genérico de RabbitMQ para procesar mensajes de diferentes colas
 * Permite registrar handlers específicos para cada tipo de mensaje
 */

import * as amqp from 'amqplib';

export interface MessageHandler<T = any> {
  handle(data: T, message: amqp.ConsumeMessage): Promise<void>;
}

export interface QueueConfig {
  name: string;
  durable?: boolean;
  exclusive?: boolean;
  autoDelete?: boolean;
  arguments?: Record<string, any>;
}

export interface ExchangeConfig {
  name: string;
  type: 'direct' | 'topic' | 'headers' | 'fanout';
  durable?: boolean;
  autoDelete?: boolean;
  arguments?: Record<string, any>;
}

export interface BindingConfig {
  queue: string;
  exchange: string;
  routingKey?: string;
  arguments?: Record<string, any>;
}

export interface ConsumerOptions {
  prefetch?: number; // Número de mensajes no confirmados simultáneos
  retryAttempts?: number;
  retryDelay?: number; // en milisegundos
  deadLetterExchange?: string;
  deadLetterQueue?: string;
}

export class RabbitMQConsumer {
  private connection: amqp.Connection | null = null;
  private channel: amqp.Channel | null = null;
  private handlers = new Map<string, MessageHandler>();
  private isConnected = false;

  constructor(
    private connectionUrl: string,
    private options: ConsumerOptions = {}
  ) {
    this.options = {
      prefetch: 10,
      retryAttempts: 3,
      retryDelay: 1000,
      ...options
    };
  }

  async connect(): Promise<void> {
    try {
      console.log('Conectando a RabbitMQ...');
      this.connection = await amqp.connect(this.connectionUrl);
      this.channel = await this.connection.createChannel();

      // Configurar prefetch para control de flujo
      await this.channel.prefetch(this.options.prefetch!);

      // Manejar cierre de conexión
      this.connection.on('close', () => {
        console.log('Conexión RabbitMQ cerrada');
        this.isConnected = false;
      });

      this.connection.on('error', (error) => {
        console.error('Error en conexión RabbitMQ:', error);
        this.isConnected = false;
      });

      this.isConnected = true;
      console.log('Conectado a RabbitMQ exitosamente');
    } catch (error) {
      console.error('Error conectando a RabbitMQ:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
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
      console.log('Desconectado de RabbitMQ');
    } catch (error) {
      console.error('Error desconectando de RabbitMQ:', error);
    }
  }

  async setupQueue(config: QueueConfig): Promise<void> {
    if (!this.channel) {
      throw new Error('No hay conexión a RabbitMQ');
    }

    await this.channel.assertQueue(config.name, {
      durable: config.durable ?? true,
      exclusive: config.exclusive ?? false,
      autoDelete: config.autoDelete ?? false,
      arguments: config.arguments
    });

    console.log(`Cola "${config.name}" configurada`);
  }

  async setupExchange(config: ExchangeConfig): Promise<void> {
    if (!this.channel) {
      throw new Error('No hay conexión a RabbitMQ');
    }

    await this.channel.assertExchange(config.name, config.type, {
      durable: config.durable ?? true,
      autoDelete: config.autoDelete ?? false,
      arguments: config.arguments
    });

    console.log(`Exchange "${config.name}" configurado`);
  }

  async bindQueue(binding: BindingConfig): Promise<void> {
    if (!this.channel) {
      throw new Error('No hay conexión a RabbitMQ');
    }

    await this.channel.bindQueue(
      binding.queue, 
      binding.exchange, 
      binding.routingKey || '',
      binding.arguments
    );

    console.log(`Cola "${binding.queue}" vinculada a exchange "${binding.exchange}"`);
  }

  registerHandler<T>(queueName: string, handler: MessageHandler<T>): void {
    this.handlers.set(queueName, handler);
    console.log(`Handler registrado para cola "${queueName}"`);
  }

  async startConsuming(queueName: string): Promise<void> {
    if (!this.channel) {
      throw new Error('No hay conexión a RabbitMQ');
    }

    const handler = this.handlers.get(queueName);
    if (!handler) {
      throw new Error(`No hay handler registrado para la cola "${queueName}"`);
    }

    await this.channel.consume(queueName, async (message) => {
      if (!message) return;

      const startTime = Date.now();
      let attempts = 0;

      while (attempts < this.options.retryAttempts!) {
        try {
          // Parsear el mensaje
          const content = message.content.toString();
          const data = JSON.parse(content);

          // Procesar mensaje con el handler correspondiente
          await handler.handle(data, message);

          // Confirmar procesamiento exitoso
          this.channel!.ack(message);
          
          const processingTime = Date.now() - startTime;
          console.log(`Mensaje procesado exitosamente en ${processingTime}ms (cola: ${queueName})`);
          
          return; // Salir del bucle de reintentos
        } catch (error) {
          attempts++;
          console.error(`Error procesando mensaje (intento ${attempts}/${this.options.retryAttempts}):`, error);

          if (attempts < this.options.retryAttempts!) {
            // Esperar antes del siguiente intento
            await this.sleep(this.options.retryDelay! * Math.pow(2, attempts - 1));
          } else {
            // Agotados los reintentos, enviar a dead letter queue o rechazar
            console.error(`Mensaje rechazado después de ${attempts} intentos (cola: ${queueName})`);
            
            if (this.options.deadLetterQueue) {
              await this.sendToDeadLetter(message, error);
            }
            
            this.channel!.nack(message, false, false); // Rechazar sin reencolar
          }
        }
      }
    });

    console.log(`Iniciado consumo de cola "${queueName}"`);
  }

  async stopConsuming(queueName: string): Promise<void> {
    if (!this.channel) return;

    try {
      await this.channel.cancel(`consumer-${queueName}`);
      console.log(`Detenido consumo de cola "${queueName}"`);
    } catch (error) {
      console.error(`Error deteniendo consumo de cola "${queueName}":`, error);
    }
  }

  private async sendToDeadLetter(message: amqp.ConsumeMessage, error: unknown): Promise<void> {
    if (!this.channel || !this.options.deadLetterQueue) return;

    try {
      const errorMessage = {
        originalMessage: JSON.parse(message.content.toString()),
        error: error instanceof Error ? error.message : 'Error desconocido',
        timestamp: new Date().toISOString(),
        originalQueue: message.fields.routingKey,
        attempts: this.options.retryAttempts
      };

      await this.channel.sendToQueue(
        this.options.deadLetterQueue,
        Buffer.from(JSON.stringify(errorMessage)),
        {
          persistent: true,
          timestamp: Date.now()
        }
      );

      console.log(`Mensaje enviado a dead letter queue: ${this.options.deadLetterQueue}`);
    } catch (deadLetterError) {
      console.error('Error enviando mensaje a dead letter queue:', deadLetterError);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  isHealthy(): boolean {
    return this.isConnected && this.channel !== null;
  }

  async getQueueInfo(queueName: string): Promise<{
    messageCount: number;
    consumerCount: number;
  }> {
    if (!this.channel) {
      throw new Error('No hay conexión a RabbitMQ');
    }

    const queueInfo = await this.channel.checkQueue(queueName);
    return {
      messageCount: queueInfo.messageCount,
      consumerCount: queueInfo.consumerCount
    };
  }

  async purgeQueue(queueName: string): Promise<number> {
    if (!this.channel) {
      throw new Error('No hay conexión a RabbitMQ');
    }

    const result = await this.channel.purgeQueue(queueName);
    console.log(`Cola "${queueName}" purgada: ${result.messageCount} mensajes eliminados`);
    return result.messageCount;
  }
}