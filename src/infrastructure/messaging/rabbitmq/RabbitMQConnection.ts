/**
 * Configuración y conexión a RabbitMQ
 * Gestiona la conexión, el canal y el pool de conexiones
 */

import amqp from 'amqplib';
import type { Result } from '@shared/result';
import { success, failure } from '@shared/result';

/**
 * Configuración de conexión a RabbitMQ
 */
export interface RabbitMQConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  vhost: string;
  connectionTimeout: number;
  heartbeat: number;
  maxRetries: number;
  retryDelay: number;
}

/**
 * Configuración por defecto de RabbitMQ
 */
export const DEFAULT_RABBITMQ_CONFIG: RabbitMQConfig = {
  host: 'localhost',
  port: 5672,
  username: 'guest',
  password: 'guest',
  vhost: '/',
  connectionTimeout: 10000, // 10 segundos
  heartbeat: 60, // 60 segundos
  maxRetries: 5,
  retryDelay: 2000, // 2 segundos
};

/**
 * Estado de la conexión
 */
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'failed';

/**
 * Estadísticas de la conexión
 */
export interface ConnectionStats {
  status: ConnectionStatus;
  connectedAt?: Date;
  disconnectedAt?: Date;
  reconnectAttempts: number;
  totalMessages: number;
  failedMessages: number;
  lastError?: string;
}

/**
 * Gestor de conexión a RabbitMQ
 * Usa tipos any para evitar conflictos con definiciones de amqplib
 */
export class RabbitMQConnection {
  private connection: any;
  private channel: any;
  private status: ConnectionStatus = 'disconnected';
  private stats: ConnectionStats;
  private retryAttempts = 0;
  private retryTimeout: NodeJS.Timeout | undefined;

  constructor(private readonly config: RabbitMQConfig = DEFAULT_RABBITMQ_CONFIG) {
    this.stats = {
      status: 'disconnected',
      reconnectAttempts: 0,
      totalMessages: 0,
      failedMessages: 0,
    };
  }

  /**
   * Establece la conexión con RabbitMQ
   */
  async connect(): Promise<Result<void, Error>> {
    try {
      if (this.status === 'connected' || this.status === 'connecting') {
        return success(undefined);
      }

      this.status = 'connecting';
      this.stats.status = 'connecting';

      const connectionString = this.buildConnectionString();
      console.log(`Conectando a RabbitMQ: ${this.config.host}:${this.config.port}`);

      this.connection = await amqp.connect(connectionString, {
        timeout: this.config.connectionTimeout,
        heartbeat: this.config.heartbeat,
      });

      // Configurar listeners de eventos de conexión
      this.setupConnectionListeners();

      // Crear canal
      this.channel = await this.connection.createChannel();

      // Configurar prefetch para control de flujo
      if (this.channel) {
        await this.channel.prefetch(100);
      }

      this.status = 'connected';
      this.stats.status = 'connected';
      this.stats.connectedAt = new Date();
      this.retryAttempts = 0;

      console.log('Conectado exitosamente a RabbitMQ');
      return success(undefined);

    } catch (error) {
      const err = error as Error;
      this.status = 'failed';
      this.stats.status = 'failed';
      this.stats.lastError = err.message;
      
      console.error('Error conectando a RabbitMQ:', err.message);
      
      // Intentar reconexión automática
      if (this.retryAttempts < this.config.maxRetries) {
        await this.scheduleReconnect();
      }

      return failure(err);
    }
  }

  /**
   * Cierra la conexión con RabbitMQ
   */
  async disconnect(): Promise<Result<void, Error>> {
    try {
      if (this.retryTimeout) {
        clearTimeout(this.retryTimeout);
        this.retryTimeout = undefined;
      }

      this.status = 'disconnected';
      this.stats.status = 'disconnected';
      this.stats.disconnectedAt = new Date();

      if (this.channel) {
        await this.channel.close();
        this.channel = undefined;
      }

      if (this.connection) {
        await this.connection.close();
        this.connection = undefined;
      }

      console.log('Desconectado de RabbitMQ');
      return success(undefined);

    } catch (error) {
      return failure(error as Error);
    }
  }

  /**
   * Obtiene el canal de RabbitMQ
   */
  getChannel(): any {
    return this.channel;
  }

  /**
   * Verifica si está conectado
   */
  isConnected(): boolean {
    return this.status === 'connected' && !!this.channel;
  }

  /**
   * Obtiene el estado de la conexión
   */
  getStatus(): ConnectionStatus {
    return this.status;
  }

  /**
   * Obtiene las estadísticas de la conexión
   */
  getStats(): ConnectionStats {
    return { ...this.stats };
  }

  /**
   * Asegura que existe un exchange
   */
  async assertExchange(
    exchange: string, 
    type: 'direct' | 'topic' | 'fanout' | 'headers' = 'topic',
    options: any = {}
  ): Promise<Result<void, Error>> {
    try {
      if (!this.channel) {
        return failure(new Error('No hay canal disponible'));
      }

      await this.channel.assertExchange(exchange, type, {
        durable: true,
        autoDelete: false,
        ...options,
      });

      return success(undefined);
    } catch (error) {
      return failure(error as Error);
    }
  }

  /**
   * Asegura que existe una cola
   */
  async assertQueue(
    queue: string,
    options: any = {}
  ): Promise<Result<any, Error>> {
    try {
      if (!this.channel) {
        return failure(new Error('No hay canal disponible'));
      }

      const result = await this.channel.assertQueue(queue, {
        durable: true,
        autoDelete: false,
        ...options,
      });

      return success(result);
    } catch (error) {
      return failure(error as Error);
    }
  }

  /**
   * Vincula una cola a un exchange
   */
  async bindQueue(
    queue: string,
    exchange: string,
    routingKey: string
  ): Promise<Result<void, Error>> {
    try {
      if (!this.channel) {
        return failure(new Error('No hay canal disponible'));
      }

      await this.channel.bindQueue(queue, exchange, routingKey);
      return success(undefined);
    } catch (error) {
      return failure(error as Error);
    }
  }

  /**
   * Publica un mensaje
   */
  async publish(
    exchange: string,
    routingKey: string,
    content: Buffer,
    options: any = {}
  ): Promise<Result<void, Error>> {
    try {
      if (!this.channel) {
        return failure(new Error('No hay canal disponible'));
      }

      const published = this.channel.publish(exchange, routingKey, content, {
        persistent: true,
        ...options,
      });

      this.updateMessageStats(published);

      if (!published) {
        return failure(new Error('No se pudo publicar el mensaje (canal saturado)'));
      }

      return success(undefined);
    } catch (error) {
      this.updateMessageStats(false);
      return failure(error as Error);
    }
  }

  /**
   * Health check de la conexión
   */
  async healthCheck(): Promise<Result<{
    status: ConnectionStatus;
    latency?: number;
    stats: ConnectionStats;
  }, Error>> {
    try {
      const startTime = Date.now();
      let latency: number | undefined;

      if (this.channel) {
        // Hacer un checkup del canal
        try {
          await this.channel.checkQueue('amq.rabbitmq.reply-to');
          latency = Date.now() - startTime;
        } catch {
          // Si falla el check, no es crítico
        }
      }

      const result: {
        status: ConnectionStatus;
        latency?: number;
        stats: ConnectionStats;
      } = {
        status: this.status,
        stats: this.getStats(),
      };

      if (latency !== undefined) {
        result.latency = latency;
      }

      return success(result);
    } catch (error) {
      return failure(error as Error);
    }
  }

  /**
   * Configura los listeners de eventos de conexión
   */
  private setupConnectionListeners(): void {
    if (!this.connection) return;

    this.connection.on('error', (error: Error) => {
      console.error('Error en conexión RabbitMQ:', error);
      this.stats.lastError = error.message;
      this.handleConnectionLoss();
    });

    this.connection.on('close', () => {
      console.warn('Conexión RabbitMQ cerrada');
      this.handleConnectionLoss();
    });

    this.connection.on('blocked', (reason: string) => {
      console.warn('Conexión RabbitMQ bloqueada:', reason);
    });

    this.connection.on('unblocked', () => {
      console.log('Conexión RabbitMQ desbloqueada');
    });
  }

  /**
   * Maneja la pérdida de conexión
   */
  private async handleConnectionLoss(): Promise<void> {
    if (this.status === 'disconnected') {
      return;
    }

    this.status = 'reconnecting';
    this.stats.status = 'reconnecting';
    this.channel = undefined;
    this.connection = undefined;

    // Intentar reconexión automática
    if (this.retryAttempts < this.config.maxRetries) {
      await this.scheduleReconnect();
    } else {
      this.status = 'failed';
      this.stats.status = 'failed';
      console.error('Se agotaron los intentos de reconexión a RabbitMQ');
    }
  }

  /**
   * Programa un intento de reconexión
   */
  private async scheduleReconnect(): Promise<void> {
    this.retryAttempts++;
    this.stats.reconnectAttempts = this.retryAttempts;

    const delay = this.config.retryDelay * Math.pow(2, this.retryAttempts - 1); // Backoff exponencial
    
    console.log(`Reintentando conexión a RabbitMQ en ${delay}ms (intento ${this.retryAttempts}/${this.config.maxRetries})`);

    this.retryTimeout = setTimeout(async () => {
      const result = await this.connect();
      if (result.isFailure) {
        console.error('Fallo en intento de reconexión:', result.error.message);
      }
    }, delay);
  }

  /**
   * Construye la cadena de conexión a RabbitMQ
   */
  private buildConnectionString(): string {
    const { username, password, host, port, vhost } = this.config;
    const encodedVhost = encodeURIComponent(vhost);
    return `amqp://${username}:${password}@${host}:${port}/${encodedVhost}`;
  }

  /**
   * Actualiza estadísticas de mensajes
   */
  updateMessageStats(success: boolean): void {
    this.stats.totalMessages++;
    if (!success) {
      this.stats.failedMessages++;
    }
  }
}