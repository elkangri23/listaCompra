/**
 * Consumer base para RabbitMQ con manejo de errores y retry
 * Permite configurar handlers específicos para diferentes tipos de mensajes
 * Versión simplificada para evitar conflictos de tipos con amqplib
 */

import amqp from 'amqplib';

// Interface para handlers de mensajes
export interface MessageHandler<T = any> {
  handle(message: T, rawMessage: amqp.ConsumeMessage): Promise<void>;
}

// Opciones de configuración del consumer
export interface ConsumerOptions {
  queueName: string;
  exchangeName?: string;
  exchangeType?: string;
  routingKey?: string;
  prefetch?: number;
  autoAck?: boolean;
  maxRetries?: number;
  retryDelay?: number;
  deadLetterQueue?: string;
}

export class RabbitMQConsumer<T = any> {
  private connection: any = null; // Usar any para evitar conflictos de tipos
  private channel: any = null;
  private isConnected = false;
  private shouldReconnect = true;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 5000;

  constructor(
    private connectionUrl: string,
    private handler: MessageHandler<T>,
    private options: ConsumerOptions
  ) {
    // Configurar valores por defecto
    this.options = {
      exchangeType: 'direct',
      prefetch: 10,
      autoAck: false,
      maxRetries: 3,
      retryDelay: 1000,
      ...options
    };
  }

  async connect(): Promise<void> {
    try {
      console.log(`🔗 Conectando a RabbitMQ: ${this.connectionUrl}`);
      
      this.connection = await amqp.connect(this.connectionUrl);
      this.channel = await this.connection.createChannel();
      
      // Configurar prefetch
      await this.channel.prefetch(this.options.prefetch!);
      
      // Configurar event listeners
      this.connection.on('close', () => {
        console.log('❌ Conexión RabbitMQ cerrada');
        this.handleConnectionClose();
      });

      this.connection.on('error', (error: Error) => {
        console.error('💥 Error en conexión RabbitMQ:', error);
        this.handleConnectionError(error);
      });

      this.isConnected = true;
      this.reconnectAttempts = 0;
      console.log('✅ Conectado a RabbitMQ exitosamente');

    } catch (error) {
      console.error('💥 Error conectando a RabbitMQ:', error);
      await this.handleReconnect();
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    console.log('🔌 Desconectando de RabbitMQ...');
    this.shouldReconnect = false;
    
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
      console.log('✅ Desconectado de RabbitMQ');
    } catch (error) {
      console.error('⚠️ Error al desconectar:', error);
    }
  }

  async startConsuming(): Promise<void> {
    if (!this.isConnected || !this.channel) {
      throw new Error('No conectado a RabbitMQ');
    }

    try {
      // Declarar exchange si se especifica
      if (this.options.exchangeName) {
        await this.channel.assertExchange(
          this.options.exchangeName,
          this.options.exchangeType!,
          { durable: true }
        );
      }

      // Declarar cola
      await this.channel.assertQueue(this.options.queueName, { 
        durable: true 
      });

      // Bindear cola a exchange si se especifica
      if (this.options.exchangeName && this.options.routingKey) {
        await this.channel.bindQueue(
          this.options.queueName,
          this.options.exchangeName,
          this.options.routingKey
        );
      }

      // Declarar dead letter queue si se especifica
      if (this.options.deadLetterQueue) {
        await this.channel.assertQueue(this.options.deadLetterQueue, { 
          durable: true 
        });
      }

      // Iniciar consumo
      console.log(`🎯 Iniciando consumo de cola: ${this.options.queueName}`);
      
      await this.channel.consume(
        this.options.queueName,
        async (msg: any) => {
          if (msg) {
            await this.handleMessage(msg);
          }
        },
        { 
          noAck: this.options.autoAck 
        }
      );

      console.log(`✅ Consumer activo en cola: ${this.options.queueName}`);

    } catch (error) {
      console.error('💥 Error iniciando consumer:', error);
      throw error;
    }
  }

  private async handleMessage(msg: amqp.ConsumeMessage): Promise<void> {
    try {
      // Parsear mensaje
      const content = msg.content.toString();
      const message: T = JSON.parse(content);

      console.log(`📨 Mensaje recibido en ${this.options.queueName}:`, message);

      // Procesar mensaje con handler
      await this.handler.handle(message, msg);

      // Ack manual si no está en auto-ack
      if (!this.options.autoAck && this.channel) {
        this.channel.ack(msg);
        console.log(`✅ Mensaje procesado y confirmado`);
      }

    } catch (error) {
      console.error('💥 Error procesando mensaje:', error);
      
      // Manejo de errores
      if (!this.options.autoAck && this.channel) {
        // Rechazar mensaje y enviar a dead letter queue si está configurada
        if (this.options.deadLetterQueue) {
          this.channel.reject(msg, false); // No requeue
          console.log(`💀 Mensaje enviado a dead letter queue`);
        } else {
          this.channel.nack(msg, false, true); // Requeue para retry
          console.log(`🔄 Mensaje reencolarizado para retry`);
        }
      }
    }
  }

  private handleConnectionClose(): void {
    this.isConnected = false;
    this.channel = null;
    this.connection = null;
    
    if (this.shouldReconnect) {
      console.log('🔄 Intentando reconectar...');
      setTimeout(() => this.handleReconnect(), this.reconnectDelay);
    }
  }

  private handleConnectionError(error: Error): void {
    console.error('💥 Error de conexión:', error);
    this.isConnected = false;
  }

  private async handleReconnect(): Promise<void> {
    if (!this.shouldReconnect) return;
    
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(`💀 Máximo de intentos de reconexión alcanzado (${this.maxReconnectAttempts})`);
      return;
    }

    this.reconnectAttempts++;
    console.log(`🔄 Intento de reconexión ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);

    try {
      await this.connect();
      await this.startConsuming();
      console.log('✅ Reconectado exitosamente');
    } catch (error) {
      console.error(`💥 Error en reconexión ${this.reconnectAttempts}:`, error);
      setTimeout(() => this.handleReconnect(), this.reconnectDelay);
    }
  }

  // Getters para monitoreo
  public isConnectedToRabbitMQ(): boolean {
    return this.isConnected;
  }

  public getReconnectAttempts(): number {
    return this.reconnectAttempts;
  }

  public getQueueName(): string {
    return this.options.queueName;
  }

  // Método estático para crear y iniciar un consumer
  public static async createAndStart<T>(
    connectionUrl: string,
    handler: MessageHandler<T>,
    options: ConsumerOptions
  ): Promise<RabbitMQConsumer<T>> {
    const consumer = new RabbitMQConsumer(connectionUrl, handler, options);
    await consumer.connect();
    await consumer.startConsuming();
    return consumer;
  }
}