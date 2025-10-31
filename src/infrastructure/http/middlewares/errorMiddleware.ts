/**
 * Middleware centralizado para manejo de errores
 * Proporciona respuestas consistentes y logging de errores
 */

import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Logger } from '../../observability/logger/Logger';
import { ValidationError } from '../../../application/errors/ValidationError';
import { NotFoundError } from '../../../application/errors/NotFoundError';
import { UnauthorizedError } from '../../../application/errors/UnauthorizedError';
import { DomainError } from '../../../domain/errors/DomainError';

const logger = new Logger('ErrorMiddleware');

/**
 * Interfaz para respuestas de error estandarizadas
 */
interface ErrorResponse {
  success: false;
  error: {
    type: string;
    message: string;
    details?: any;
    timestamp: string;
    requestId?: string;
  };
}

/**
 * Interfaz para errores HTTP conocidos
 */
interface HttpError extends Error {
  status?: number;
  statusCode?: number;
  code?: string;
}

/**
 * Middleware para manejo centralizado de errores
 */
export const errorMiddleware = (
  error: Error | HttpError | ZodError | ValidationError | NotFoundError | UnauthorizedError | DomainError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Si la respuesta ya fue enviada, pasar al siguiente middleware
  if (res.headersSent) {
    return next(error);
  }

  // Generar ID único para la request (para tracking)
  const requestId = req.headers['x-request-id'] as string || generateRequestId();

  let statusCode = 500;
  let errorType = 'INTERNAL_SERVER_ERROR';
  let message = 'Error interno del servidor';
  let details: any = undefined;

  // 🔍 Clasificar tipos de errores
  if (error instanceof ValidationError) {
    statusCode = 400;
    errorType = 'VALIDATION_ERROR';
    message = error.message;
    
    logger.warn('Error de validación', {
      requestId,
      url: req.originalUrl,
      method: req.method,
      error: message,
      ip: req.ip,
    });
    
  } else if (error instanceof NotFoundError) {
    statusCode = 404;
    errorType = 'NOT_FOUND';
    message = error.message;
    
    logger.warn('Recurso no encontrado', {
      requestId,
      url: req.originalUrl,
      method: req.method,
      error: message,
      ip: req.ip,
    });
    
  } else if (error instanceof UnauthorizedError) {
    statusCode = 401;
    errorType = 'UNAUTHORIZED';
    message = error.message;
    
    logger.security('Acceso no autorizado', {
      requestId,
      url: req.originalUrl,
      method: req.method,
      error: message,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });
    
  } else if (error instanceof DomainError) {
    statusCode = 400;
    errorType = 'DOMAIN_ERROR';
    message = error.message;
    
    logger.warn('Error de dominio', {
      requestId,
      url: req.originalUrl,
      method: req.method,
      error: message,
      ip: req.ip,
    });
    
  } else if (error instanceof ZodError) {
    statusCode = 400;
    errorType = 'VALIDATION_ERROR';
    message = 'Datos de entrada inválidos';
    details = {
      issues: error.issues.map(issue => ({
        field: issue.path.join('.'),
        message: issue.message,
        code: issue.code,
      }))
    };
    
    logger.warn('Error de validación Zod', {
      requestId,
      url: req.originalUrl,
      method: req.method,
      details,
      ip: req.ip,
    });
    
  } else if ('status' in error || 'statusCode' in error) {
    // Errores HTTP con código de estado
    statusCode = error.status || error.statusCode || 500;
    errorType = error.name || 'HTTP_ERROR';
    message = error.message || 'Error HTTP';
    
    if (statusCode >= 500) {
      logger.error('Error HTTP servidor', error, {
        requestId,
        url: req.originalUrl,
        method: req.method,
        statusCode,
        ip: req.ip,
      });
    } else {
      logger.warn('Error HTTP cliente', {
        requestId,
        url: req.originalUrl,
        method: req.method,
        statusCode,
        error: message,
        ip: req.ip,
      });
    }
    
  } else {
    // Errores no clasificados (internos)
    logger.error('Error interno no clasificado', error, {
      requestId,
      url: req.originalUrl,
      method: req.method,
      stack: error.stack,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
    });
  }

  // 🔒 En producción, no exponer detalles internos
  if (process.env['NODE_ENV'] === 'production' && statusCode >= 500) {
    message = 'Error interno del servidor';
    details = undefined;
  }

  // Construir respuesta de error estandarizada
  const errorResponse: ErrorResponse = {
    success: false,
    error: {
      type: errorType,
      message,
      timestamp: new Date().toISOString(),
      requestId,
    }
  };

  // Añadir detalles solo si existen y no estamos en producción
  if (details && (process.env['NODE_ENV'] !== 'production' || statusCode < 500)) {
    errorResponse.error.details = details;
  }

  // Enviar respuesta
  res.status(statusCode).json(errorResponse);
};

/**
 * Middleware para rutas no encontradas (404)
 */
export const notFoundMiddleware = (req: Request, res: Response): void => {
  const requestId = req.headers['x-request-id'] as string || generateRequestId();
  
  logger.warn('Endpoint no encontrado', {
    requestId,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });

  const errorResponse: ErrorResponse = {
    success: false,
    error: {
      type: 'NOT_FOUND',
      message: 'Endpoint no encontrado',
      timestamp: new Date().toISOString(),
      requestId,
    }
  };

  res.status(404).json(errorResponse);
};

/**
 * Middleware para añadir ID de request para tracking
 */
export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.headers['x-request-id']) {
    const requestId = generateRequestId();
    req.headers['x-request-id'] = requestId;
    res.setHeader('x-request-id', requestId);
  }
  next();
};

/**
 * Generar ID único para requests
 */
function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Middleware para logging de requests HTTP
 */
export const httpLoggerMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = Date.now();
  const requestId = req.headers['x-request-id'] as string || generateRequestId();

  // Log de request entrante
  logger.http('Request entrante', {
    requestId,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    contentLength: req.get('Content-Length'),
  });

  // Interceptar el final de la respuesta
  const originalSend = res.send;
  res.send = function(body) {
    const duration = Date.now() - startTime;
    
    // Log de respuesta
    logger.http('Request completada', {
      requestId,
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      contentLength: res.get('Content-Length'),
      ip: req.ip,
    });

    // Llamar al método original
    return originalSend.call(this, body);
  };

  next();
};