/**
 * Middleware de rate limiting específico para endpoints administrativos
 * 
 * Implementa diferentes niveles de rate limiting según la criticidad:
 * - Impersonación: 5 requests/hora (muy restrictivo)
 * - Auditoría: 20 requests/5min (restrictivo)
 * - Admin general (escrituras): 10 requests/15min (moderado)
 * - Lecturas admin (GET): 60 requests/15min (holgado)
 */

/**
 * DECISIÓN (2026-11-28, arreglo del bug de polling de Copias): las lecturas
 * y las escrituras tienen presupuestos SEPARADOS. El panel /admin sondea
 * sus endpoints (Seguridad cada 2 min, Copias cada 120 s mientras hay
 * trabajo) y con un único presupuesto de 10/15 min compartido la pestaña
 * recibía 429 antes de que terminara una copia. Las lecturas son consultas
 * de solo lectura de un ADMIN ya autenticado (el JWT es la frontera de
 * seguridad), así que 60/15 min las cubre con margen (peor pestaña: 15).
 * Las escrituras (cambiar estado, crear copia, restaurar, descargar)
 * siguen en 10/15 min porque mutan estado o disparan trabajo costoso.
 */

import rateLimit from 'express-rate-limit';
import type { Request, Response } from 'express';
import { Logger } from '../../observability/logger/Logger';

const logger = new Logger();

/**
 * Información sobre los límites de rate configurados
 */
export interface RateLimitInfo {
  general: {
    maxRequests: number;
    windowMs: number;
    description: string;
  };
  read: {
    maxRequests: number;
    windowMs: number;
    description: string;
  };
  impersonation: {
    maxRequests: number;
    windowMs: number;
    description: string;
  };
  audit: {
    maxRequests: number;
    windowMs: number;
    description: string;
  };
}

/**
 * Rate limiting para operaciones administrativas generales
 * 10 requests por 15 minutos por IP+Usuario
 */
export const adminRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 10, // Límite de 10 requests por ventana de tiempo
  standardHeaders: true, // Incluye headers estándar X-RateLimit-*
  legacyHeaders: false, // Deshabilita headers legacy X-Rate-Limit-*
  
  message: {
    error: 'Too many admin requests',
    message: 'Máximo 10 operaciones administrativas por 15 minutos',
    retryAfter: 900 // 15 minutos en segundos
  },
  
  skip: (req: Request) => {
    // Opcional: skip rate limiting para ciertos casos (testing, IPs internas, etc.)
    const testMode = process.env['NODE_ENV'] === 'test';
    const isHealthCheck = req.path.includes('/health');
    
    if (testMode || isHealthCheck) {
      return true;
    }
    
    return false;
  },
  keyGenerator: (req: Request) => {
    // Combinar IP y usuario para un rate limiting más específico
    const ip = req.ip || 'unknown-ip';
    const userId = (req as any).user?.id || 'anonymous';
    return `admin:${ip}:${userId}`;
  },
  handler: (req: Request, res: Response) => {
    const clientId = req.ip || 'unknown';
    const userId = (req as any).user?.id || 'anonymous';
    
    logger.error('Límite de rate de admin alcanzado', {
      ip: clientId,
      userId,
      userAgent: req.get('User-Agent'),
      endpoint: req.originalUrl,
      method: req.method,
      limit: 'admin-general'
    });

    res.status(429).json({
      error: 'Too many admin requests',
      message: 'Máximo 10 operaciones administrativas por 15 minutos',
      retryAfter: 900,
      type: 'admin_rate_limit'
    });
  }
});

/**
 * Rate limiting para lecturas administrativas (GET)
 * 60 requests por 15 minutos por IP+Usuario
 *
 * Presupuesto propio, separado del de escrituras (ver DECISIÓN en la
 * cabecera del fichero): el panel /admin sondea estos endpoints y el
 * presupuesto general de 10/15 min se agotaba en uso normal (la pestaña
 * Seguridad sola hace 15 lecturas/15 min; Copias, 60 con el intervalo
 * antiguo de 15 s). Son consultas de solo lectura de un ADMIN autenticado.
 */
export const adminReadRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 60, // Límite de 60 lecturas por ventana de tiempo
  standardHeaders: true, // Incluye headers estándar X-RateLimit-*
  legacyHeaders: false, // Deshabilita headers legacy X-Rate-Limit-*

  message: {
    error: 'Too many admin requests',
    message: 'Máximo 60 consultas administrativas por 15 minutos',
    retryAfter: 900 // 15 minutos en segundos
  },

  skip: (req: Request) => {
    const testMode = process.env['NODE_ENV'] === 'test';
    const isHealthCheck = req.path.includes('/health');

    if (testMode || isHealthCheck) {
      return true;
    }

    return false;
  },
  keyGenerator: (req: Request) => {
    // Clave distinta a la de escrituras: presupuestos independientes
    const ip = req.ip || 'unknown-ip';
    const userId = (req as any).user?.id || 'anonymous';
    return `admin-read:${ip}:${userId}`;
  },
  handler: (req: Request, res: Response) => {
    const clientId = req.ip || 'unknown';
    const userId = (req as any).user?.id || 'anonymous';

    logger.error('Límite de rate de lecturas admin alcanzado', {
      ip: clientId,
      userId,
      userAgent: req.get('User-Agent'),
      endpoint: req.originalUrl,
      method: req.method,
      limit: 'admin-read'
    });

    res.status(429).json({
      error: 'Too many admin requests',
      message: 'Máximo 60 consultas administrativas por 15 minutos',
      retryAfter: 900,
      type: 'admin_read_rate_limit'
    });
  }
});

/**
 * Rate limiting para impersonación de usuarios (muy restrictivo)
 * 5 requests por hora por IP+Usuario
 */
export const impersonationRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 5, // Máximo 5 impersonaciones por hora
  standardHeaders: true,
  legacyHeaders: false,
  
  message: {
    error: 'Too many impersonation requests',
    message: 'Máximo 5 impersonaciones por hora por IP',
    retryAfter: 3600
  },
  
  skip: (_req: Request) => {
    return process.env['NODE_ENV'] === 'test';
  },
  keyGenerator: (req: Request) => {
    const ip = req.ip || 'unknown-ip';
    const userId = (req as any).user?.id || 'anonymous';
    return `impersonation:${ip}:${userId}`;
  },
  handler: (req: Request, res: Response) => {
    const clientId = req.ip || 'unknown';
    const userId = (req as any).user?.id || 'anonymous';
    
    logger.error('Límite de rate de impersonación alcanzado', {
      ip: clientId,
      userId,
      userAgent: req.get('User-Agent'),
      endpoint: req.originalUrl,
      method: req.method,
      limit: 'impersonation'
    });

    res.status(429).json({
      error: 'Too many impersonation requests',
      message: 'Máximo 5 impersonaciones por hora por IP',
      retryAfter: 3600,
      type: 'impersonation_rate_limit'
    });
  }
});

/**
 * Rate limiting para consultas de auditoría
 * 20 requests por 5 minutos por IP+Usuario
 */
export const auditRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutos
  max: 20, // Máximo 20 consultas por ventana
  standardHeaders: true,
  legacyHeaders: false,
  
  message: {
    error: 'Too many audit requests',
    message: 'Máximo 20 consultas de auditoría por 5 minutos',
    retryAfter: 300
  },
  
  skip: (_req: Request) => {
    return process.env['NODE_ENV'] === 'test';
  },
  keyGenerator: (req: Request) => {
    const ip = req.ip || 'unknown-ip';
    const userId = (req as any).user?.id || 'anonymous';
    return `audit:${ip}:${userId}`;
  },
  handler: (req: Request, res: Response) => {
    const clientId = req.ip || 'unknown';
    const userId = (req as any).user?.id || 'anonymous';
    
    logger.error('Límite de rate de auditoría alcanzado', {
      ip: clientId,
      userId,
      userAgent: req.get('User-Agent'),
      endpoint: req.originalUrl,
      method: req.method,
      limit: 'audit'
    });

    res.status(429).json({
      error: 'Too many audit requests',
      message: 'Máximo 20 consultas de auditoría por 5 minutos',
      retryAfter: 300,
      type: 'audit_rate_limit'
    });
  }
});

/**
 * Middleware combinado que aplicaría todos los rate limits
 * (Opcional - para casos específicos)
 */
export const createAdminRateLimitMiddleware = () => {
  return (req: Request, res: Response, next: any) => {
    // Lógica personalizada para determinar qué rate limit aplicar
    // basado en el endpoint o parámetros de la request
    
    const path = req.path.toLowerCase();
    
    if (path.includes('impersonate') || path.includes('end-impersonation')) {
      return impersonationRateLimit(req, res, next);
    }
    
    if (path.includes('audit')) {
      return auditRateLimit(req, res, next);
    }
    
    // Lecturas (GET): presupuesto propio y holgado (60/15 min). Las
    // pestañas del panel sondean estos endpoints y con el presupuesto
    // general (10/15 min) recibían 429 en uso normal.
    if (req.method === 'GET') {
      return adminReadRateLimit(req, res, next);
    }

    // Rate limit general para escrituras admin (10/15 min)
    return adminRateLimit(req, res, next);
  };
};

/**
 * Función para obtener información sobre los rate limits configurados
 * Útil para documentación y monitoreo
 */
export const getRateLimitInfo = (): RateLimitInfo => {
  return {
    general: {
      maxRequests: 10,
      windowMs: 15 * 60 * 1000,
      description: 'General admin operations: 10 requests per 15 minutes'
    },
    read: {
      maxRequests: 60,
      windowMs: 15 * 60 * 1000,
      description: 'Admin read queries (GET): 60 requests per 15 minutes'
    },
    impersonation: {
      maxRequests: 5,
      windowMs: 60 * 60 * 1000,
      description: 'User impersonation: 5 requests per hour'
    },
    audit: {
      maxRequests: 20,
      windowMs: 5 * 60 * 1000,
      description: 'Audit queries: 20 requests per 5 minutes'
    }
  };
};