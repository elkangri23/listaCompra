/**
 * Configuración de RabbitMQ
 * Centraliza todas las configuraciones relacionadas con RabbitMQ
 */

import type { RabbitMQConfig } from '../messaging/rabbitmq/RabbitMQConnection';
import type { EventPublisherConfig } from '../messaging/rabbitmq/RabbitMQEventPublisher';

/**
 * Configuración completa de RabbitMQ para la aplicación
 */
export interface AppRabbitMQConfig {
  connection: RabbitMQConfig;
  publisher: EventPublisherConfig;
  outbox: {
    processingInterval: number;
    batchSize: number;
    maxRetries: number;
    retryDelay: number;
  };
  queues: {
    notifications: string;
    audit: string;
    deadLetter: string;
  };
  exchanges: {
    events: string;
    deadLetter: string;
    notifications: string;
  };
}

/**
 * Configuración por defecto de RabbitMQ
 */
export const DEFAULT_RABBITMQ_CONFIG: AppRabbitMQConfig = {
  connection: {
    host: process.env['RABBITMQ_HOST'] || 'localhost',
    port: parseInt(process.env['RABBITMQ_PORT'] || '5672'),
    username: process.env['RABBITMQ_USERNAME'] || 'guest',
    password: process.env['RABBITMQ_PASSWORD'] || 'guest',
    vhost: process.env['RABBITMQ_VHOST'] || '/',
    connectionTimeout: parseInt(process.env['RABBITMQ_CONNECTION_TIMEOUT'] || '10000'),
    heartbeat: parseInt(process.env['RABBITMQ_HEARTBEAT'] || '60'),
    maxRetries: parseInt(process.env['RABBITMQ_MAX_RETRIES'] || '5'),
    retryDelay: parseInt(process.env['RABBITMQ_RETRY_DELAY'] || '2000'),
  },
  publisher: {
    exchangeName: process.env['RABBITMQ_EVENTS_EXCHANGE'] || 'listacompra.events',
    exchangeType: 'topic',
    routingKeyPrefix: process.env['RABBITMQ_ROUTING_PREFIX'] || 'listacompra',
    retryAttempts: parseInt(process.env['RABBITMQ_PUBLISH_RETRIES'] || '3'),
    retryDelay: parseInt(process.env['RABBITMQ_PUBLISH_RETRY_DELAY'] || '1000'),
    deadLetterExchange: process.env['RABBITMQ_DLX'] || 'listacompra.dlx',
    deadLetterQueue: process.env['RABBITMQ_DLQ'] || 'listacompra.dlq',
  },
  outbox: {
    processingInterval: parseInt(process.env['OUTBOX_PROCESSING_INTERVAL'] || '5000'), // 5 segundos
    batchSize: parseInt(process.env['OUTBOX_BATCH_SIZE'] || '10'),
    maxRetries: parseInt(process.env['OUTBOX_MAX_RETRIES'] || '3'),
    retryDelay: parseInt(process.env['OUTBOX_RETRY_DELAY'] || '30000'), // 30 segundos
  },
  queues: {
    notifications: process.env['RABBITMQ_NOTIFICATIONS_QUEUE'] || 'listacompra.notifications',
    audit: process.env['RABBITMQ_AUDIT_QUEUE'] || 'listacompra.audit',
    deadLetter: process.env['RABBITMQ_DLQ'] || 'listacompra.dlq',
  },
  exchanges: {
    events: process.env['RABBITMQ_EVENTS_EXCHANGE'] || 'listacompra.events',
    deadLetter: process.env['RABBITMQ_DLX'] || 'listacompra.dlx',
    notifications: process.env['RABBITMQ_NOTIFICATIONS_EXCHANGE'] || 'listacompra.notifications',
  },
};

/**
 * Configuraciones específicas por entorno
 */
export const RABBITMQ_CONFIGS = {
  development: {
    ...DEFAULT_RABBITMQ_CONFIG,
    connection: {
      ...DEFAULT_RABBITMQ_CONFIG.connection,
      host: 'localhost',
      port: 5672,
      maxRetries: 3,
    },
    outbox: {
      ...DEFAULT_RABBITMQ_CONFIG.outbox,
      processingInterval: 2000, // Más frecuente en desarrollo
    },
  },
  test: {
    ...DEFAULT_RABBITMQ_CONFIG,
    connection: {
      ...DEFAULT_RABBITMQ_CONFIG.connection,
      host: 'localhost',
      port: 5673, // Puerto diferente para tests
      maxRetries: 1,
    },
    publisher: {
      ...DEFAULT_RABBITMQ_CONFIG.publisher,
      exchangeName: 'test.listacompra.events',
      deadLetterExchange: 'test.listacompra.dlx',
      deadLetterQueue: 'test.listacompra.dlq',
    },
    queues: {
      notifications: 'test.listacompra.notifications',
      audit: 'test.listacompra.audit',
      deadLetter: 'test.listacompra.dlq',
    },
    exchanges: {
      events: 'test.listacompra.events',
      deadLetter: 'test.listacompra.dlx',
      notifications: 'test.listacompra.notifications',
    },
  },
  production: {
    ...DEFAULT_RABBITMQ_CONFIG,
    connection: {
      ...DEFAULT_RABBITMQ_CONFIG.connection,
      connectionTimeout: 15000,
      heartbeat: 30,
      maxRetries: 10,
      retryDelay: 5000,
    },
    outbox: {
      ...DEFAULT_RABBITMQ_CONFIG.outbox,
      processingInterval: 10000, // Menos frecuente en producción
      batchSize: 20,
    },
  },
} as const;

/**
 * Obtiene la configuración de RabbitMQ para el entorno actual
 */
export function getRabbitMQConfig(): AppRabbitMQConfig {
  const env = process.env['NODE_ENV'] as keyof typeof RABBITMQ_CONFIGS;
  
  switch (env) {
    case 'test':
      return RABBITMQ_CONFIGS.test;
    case 'production':
      return RABBITMQ_CONFIGS.production;
    case 'development':
    default:
      return RABBITMQ_CONFIGS.development;
  }
}

/**
 * Construye la URL de conexión a RabbitMQ
 */
export function buildRabbitMQConnectionUrl(config?: RabbitMQConfig): string {
  const conn = config || getRabbitMQConfig().connection;
  const encodedVhost = encodeURIComponent(conn.vhost);
  return `amqp://${conn.username}:${conn.password}@${conn.host}:${conn.port}/${encodedVhost}`;
}

/**
 * Valida la configuración de RabbitMQ
 */
export function validateRabbitMQConfig(config: AppRabbitMQConfig): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Validar conexión
  if (!config.connection.host) {
    errors.push('Host de RabbitMQ es requerido');
  }
  
  if (config.connection.port < 1 || config.connection.port > 65535) {
    errors.push('Puerto de RabbitMQ debe estar entre 1 y 65535');
  }

  if (!config.connection.username) {
    errors.push('Usuario de RabbitMQ es requerido');
  }

  if (!config.connection.password) {
    errors.push('Contraseña de RabbitMQ es requerida');
  }

  // Validar publisher
  if (!config.publisher.exchangeName) {
    errors.push('Nombre del exchange de eventos es requerido');
  }

  if (!config.publisher.routingKeyPrefix) {
    errors.push('Prefijo de routing key es requerido');
  }

  // Validar outbox
  if (config.outbox.processingInterval < 1000) {
    errors.push('Intervalo de procesamiento del outbox debe ser al menos 1000ms');
  }

  if (config.outbox.batchSize < 1) {
    errors.push('Tamaño de lote del outbox debe ser al menos 1');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Configuración para el health check de RabbitMQ
 */
export interface RabbitMQHealthConfig {
  timeout: number;
  retries: number;
  retryDelay: number;
}

export const RABBITMQ_HEALTH_CONFIG: RabbitMQHealthConfig = {
  timeout: parseInt(process.env['RABBITMQ_HEALTH_TIMEOUT'] || '5000'),
  retries: parseInt(process.env['RABBITMQ_HEALTH_RETRIES'] || '3'),
  retryDelay: parseInt(process.env['RABBITMQ_HEALTH_RETRY_DELAY'] || '1000'),
};

/**
 * Configuración para monitoreo y métricas
 */
export interface RabbitMQMonitoringConfig {
  enableMetrics: boolean;
  metricsInterval: number;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  enableTracing: boolean;
}

export const RABBITMQ_MONITORING_CONFIG: RabbitMQMonitoringConfig = {
  enableMetrics: process.env['RABBITMQ_ENABLE_METRICS'] === 'true',
  metricsInterval: parseInt(process.env['RABBITMQ_METRICS_INTERVAL'] || '30000'),
  logLevel: (process.env['RABBITMQ_LOG_LEVEL'] as any) || 'info',
  enableTracing: process.env['RABBITMQ_ENABLE_TRACING'] === 'true',
};