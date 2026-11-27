/**
 * Servicio para gestionar Workers y Consumers de RabbitMQ
 * Separado del container principal para mantener arquitectura limpia
 */

import { RabbitMQConsumer, type ConsumerOptions } from './rabbitmq/RabbitMQConsumer';
import { NotificationConsumer } from './consumers/NotificationConsumer';
import { AuditEventHandler } from './consumers/AuditEventHandler';
import type { IEmailService } from '../../application/ports/external/IEmailService';
import type { IUsuarioRepository } from '../../application/ports/repositories/IUsuarioRepository';
import type { IListaRepository } from '../../application/ports/repositories/IListaRepository';
import type { IPermisoRepository } from '../../application/ports/repositories/IPermisoRepository';
import type { IAuditRepository } from '../../application/ports/repositories/IAuditRepository';
import type { Logger } from '../observability/logger/Logger';

export interface WorkerServiceConfig {
  rabbitmqUrl: string;
  enabled: boolean;
  emailService: IEmailService;
  usuarioRepository: IUsuarioRepository;
  listaRepository: IListaRepository;
  permisoRepository: IPermisoRepository;
  auditRepository: IAuditRepository;
  logger: Logger;
}

export class WorkerService {
  private consumers: RabbitMQConsumer[] = [];
  private isRunning = false;

  constructor(private config: WorkerServiceConfig) {}

  async start(): Promise<void> {
    if (!this.config.enabled) {
      console.log('🔧 Workers deshabilitados por configuración');
      return;
    }

    if (this.isRunning) {
      console.log('⚠️ Workers ya están ejecutándose');
      return;
    }

    console.log('🚀 Iniciando Workers de RabbitMQ...');

    try {
      // Crear y iniciar NotificationConsumer
      await this.startNotificationConsumer();

      // Crear y iniciar AuditConsumer
      await this.startAuditConsumer();

      this.isRunning = true;
      console.log('✅ Todos los Workers iniciados exitosamente');

    } catch (error) {
      console.error('💥 Error iniciando Workers:', error);
      await this.stop();
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      console.log('⚠️ Workers no están ejecutándose');
      return;
    }

    console.log('🛑 Deteniendo Workers de RabbitMQ...');

    // Desconectar todos los consumers
    const disconnectPromises = this.consumers.map(async (consumer) => {
      try {
        await consumer.disconnect();
        console.log(`✅ Consumer ${consumer.getQueueName()} desconectado`);
      } catch (error) {
        console.error(`💥 Error desconectando consumer ${consumer.getQueueName()}:`, error);
      }
    });

    await Promise.all(disconnectPromises);

    this.consumers = [];
    this.isRunning = false;
    console.log('✅ Todos los Workers detenidos');
  }

  private async startNotificationConsumer(): Promise<void> {
    console.log('📧 Iniciando NotificationConsumer...');

    const notificationHandler = new NotificationConsumer(
      this.config.emailService,
      this.config.usuarioRepository,
      this.config.listaRepository,
      this.config.permisoRepository
    );

    const consumerOptions: ConsumerOptions = {
      queueName: 'notifications_queue',
      exchangeName: 'lista_compra_exchange',
      exchangeType: 'direct',
      routingKey: 'notification',
      prefetch: 5,
      autoAck: false,
      maxRetries: 3,
      retryDelay: 2000,
      deadLetterQueue: 'notifications_dlq'
    };

    try {
      const consumer = await RabbitMQConsumer.createAndStart(
        this.config.rabbitmqUrl,
        notificationHandler,
        consumerOptions
      );

      this.consumers.push(consumer);
      console.log('✅ NotificationConsumer iniciado exitosamente');

    } catch (error) {
      console.error('💥 Error iniciando NotificationConsumer:', error);
      throw error;
    }
  }

  private async startAuditConsumer(): Promise<void> {
    console.log('🔍 Iniciando AuditConsumer...');

    const auditHandler = new AuditEventHandler(
      this.config.auditRepository,
      this.config.logger // Assuming logger is available in config or passed separately
    );

    const consumerOptions: ConsumerOptions = {
      queueName: 'audit_queue',
      exchangeName: 'lista_compra_events',
      exchangeType: 'topic',
      routingKey: '#', // Todos los eventos: los de producto se publican como producto.* y con 'lista.#' nunca llegaban, asi que ningun cambio de producto quedaba registrado
      prefetch: 5,
      autoAck: false,
      maxRetries: 3,
      retryDelay: 2000,
      deadLetterQueue: 'audit_dlq'
    };

    try {
      const consumer = await RabbitMQConsumer.createAndStart(
        this.config.rabbitmqUrl,
        auditHandler,
        consumerOptions
      );

      this.consumers.push(consumer);
      console.log('✅ AuditConsumer iniciado exitosamente');

    } catch (error) {
      console.error('💥 Error iniciando AuditConsumer:', error);
      throw error;
    }
  }

  // Métodos de monitoreo
  public getStatus(): {
    isRunning: boolean;
    consumersCount: number;
    consumers: Array<{
      queueName: string;
      isConnected: boolean;
      reconnectAttempts: number;
    }>;
    } {
    return {
      isRunning: this.isRunning,
      consumersCount: this.consumers.length,
      consumers: this.consumers.map(consumer => ({
        queueName: consumer.getQueueName(),
        isConnected: consumer.isConnectedToRabbitMQ(),
        reconnectAttempts: consumer.getReconnectAttempts()
      }))
    };
  }

  public isWorkerServiceRunning(): boolean {
    return this.isRunning;
  }

  public getConsumersCount(): number {
    return this.consumers.length;
  }

  // Método para restart todos los workers
  public async restart(): Promise<void> {
    console.log('🔄 Reiniciando Workers...');
    await this.stop();
    await this.start();
    console.log('✅ Workers reiniciados exitosamente');
  }

  // Método para restart solo un consumer específico
  public async restartConsumer(queueName: string): Promise<void> {
    console.log(`🔄 Reiniciando consumer ${queueName}...`);
    
    const consumerIndex = this.consumers.findIndex(c => c.getQueueName() === queueName);
    if (consumerIndex === -1) {
      throw new Error(`Consumer ${queueName} no encontrado`);
    }

    const consumer = this.consumers[consumerIndex];
    if (!consumer) {
      throw new Error(`Consumer ${queueName} es undefined`);
    }
    
    try {
      await consumer.disconnect();
      this.consumers.splice(consumerIndex, 1);
      
      // Reiniciar según el tipo de consumer
      if (queueName === 'notifications_queue') {
        await this.startNotificationConsumer();
      } else if (queueName === 'audit_queue') {
        await this.startAuditConsumer();
      }
      
      console.log(`✅ Consumer ${queueName} reiniciado exitosamente`);
    } catch (error) {
      console.error(`💥 Error reiniciando consumer ${queueName}:`, error);
      throw error;
    }
  }
}
