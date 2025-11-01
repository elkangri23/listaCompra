/**
 * Servicio de logging profesional usando Winston
 * Reemplaza console.log por un sistema robusto y configurable
 */

import winston from 'winston';
import path from 'path';
import { context, trace } from '@opentelemetry/api';

// Definir niveles de log personalizados
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Colores para cada nivel en consola
const logColors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
};

// Añadir colores a winston
winston.addColors(logColors);

// Formato personalizado para logs
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.errors({ stack: true }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info['timestamp']} ${info.level}: ${info.message}` + (info['stack'] ? `\n${info['stack']}` : '')
  )
);

// Formato para archivos (sin colores)
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Determinar nivel de log basado en entorno
const level = (): string => {
  const env = process.env['NODE_ENV'] || 'development';
  const isDevelopment = env === 'development';
  return isDevelopment ? 'debug' : 'info';
};

// Transports para diferentes entornos
const transports: winston.transport[] = [];

// En desarrollo: log a consola
if (process.env['NODE_ENV'] === 'development') {
  transports.push(
    new winston.transports.Console({
      level: 'debug',
      format: logFormat,
    })
  );
}

// En producción: log a archivos
if (process.env['NODE_ENV'] === 'production') {
  transports.push(
    // Archivo para todos los logs
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'app.log'),
      level: 'info',
      format: fileFormat,
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    }),
    
    // Archivo separado para errores
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'error.log'),
      level: 'error',
      format: fileFormat,
      maxsize: 10485760, // 10MB
      maxFiles: 3,
    })
  );
}

// En test: logs mínimos
if (process.env['NODE_ENV'] === 'test') {
  transports.push(
    new winston.transports.Console({
      level: 'error',
      format: winston.format.simple(),
      silent: process.env['TEST_SILENT'] === 'true',
    })
  );
}

// Crear el logger principal
const logger = winston.createLogger({
  level: level(),
  levels: logLevels,
  format: fileFormat,
  transports,
  
  // No salir en errores no capturados
  exitOnError: false,
  
  // Manejar excepciones no capturadas
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'exceptions.log'),
      format: fileFormat,
    }),
  ],
  
  // Manejar rechazos de promesas no capturados
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'rejections.log'),
      format: fileFormat,
    }),
  ],
});

/**
 * Clase Logger con métodos tipados y contexto
 */
export class Logger {
  private context: string;

  constructor(context: string = 'App') {
    this.context = context;
  }

  private enrichMeta(meta?: any): any {
    const span = trace.getSpan(context.active());

    if (!span) {
      return meta;
    }

    const spanContext = span.spanContext();
    const traceMeta: Record<string, string> = {};

    if (spanContext?.traceId) {
      traceMeta['traceId'] = spanContext.traceId;
    }

    if (spanContext?.spanId) {
      traceMeta['spanId'] = spanContext.spanId;
    }

    if (Object.keys(traceMeta).length === 0) {
      return meta;
    }

    if (meta === undefined) {
      return traceMeta;
    }

    if (typeof meta !== 'object' || Array.isArray(meta)) {
      return { ...traceMeta, value: meta };
    }

    return { ...meta, ...traceMeta };
  }

  /**
   * Log de información general
   */
  info(message: string, meta?: any): void {
    logger.info(`[${this.context}] ${message}`, this.enrichMeta(meta));
  }

  /**
   * Log de advertencias
   */
  warn(message: string, meta?: any): void {
    logger.warn(`[${this.context}] ${message}`, this.enrichMeta(meta));
  }

  /**
   * Log de errores
   */
  error(message: string, error?: Error | any, meta?: any): void {
    if (error instanceof Error) {
      logger.error(`[${this.context}] ${message}`, this.enrichMeta({
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name,
        },
        ...(meta && typeof meta === 'object' ? meta : {}),
      }));
    } else {
      logger.error(`[${this.context}] ${message}`, this.enrichMeta({
        error,
        ...(meta && typeof meta === 'object' ? meta : {}),
      }));
    }
  }

  /**
   * Log de depuración
   */
  debug(message: string, meta?: any): void {
    logger.debug(`[${this.context}] ${message}`, this.enrichMeta(meta));
  }

  /**
   * Log de requests HTTP
   */
  http(message: string, meta?: any): void {
    logger.http(`[${this.context}] ${message}`, this.enrichMeta(meta));
  }

  /**
   * Log de inicio de aplicación
   */
  startup(message: string, meta?: any): void {
    logger.info(`🚀 [${this.context}] ${message}`, this.enrichMeta(meta));
  }

  /**
   * Log de cierre de aplicación
   */
  shutdown(message: string, meta?: any): void {
    logger.info(`🔽 [${this.context}] ${message}`, this.enrichMeta(meta));
  }

  /**
   * Log de seguridad (intentos sospechosos, rate limiting, etc.)
   */
  security(message: string, meta?: any): void {
    logger.warn(`🔒 [${this.context}] SECURITY: ${message}`, this.enrichMeta(meta));
  }

  /**
   * Log de base de datos
   */
  database(message: string, meta?: any): void {
    logger.info(`💾 [${this.context}] DATABASE: ${message}`, this.enrichMeta(meta));
  }

  /**
   * Log de mensajería (RabbitMQ)
   */
  messaging(message: string, meta?: any): void {
    logger.info(`📨 [${this.context}] MESSAGING: ${message}`, this.enrichMeta(meta));
  }

  /**
   * Log de email
   */
  email(message: string, meta?: any): void {
    logger.info(`📧 [${this.context}] EMAIL: ${message}`, this.enrichMeta(meta));
  }

  /**
   * Log de IA
   */
  ai(message: string, meta?: any): void {
    logger.info(`🤖 [${this.context}] AI: ${message}`, this.enrichMeta(meta));
  }
}

// Exportar instancia por defecto
export const defaultLogger = new Logger('Main');

// Exportar logger para casos especiales
export { logger as winstonLogger };

// Crear directorio de logs si no existe (solo en producción)
if (process.env['NODE_ENV'] === 'production') {
  const fs = require('fs');
  const logsDir = path.join(process.cwd(), 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
}