/**
 * Middleware de Rate Limiting granular por endpoint con soporte para usuarios
 * Protege contra ataques de fuerza bruta y DDoS
 */

import rateLimit from 'express-rate-limit';
import type { Request, Response } from 'express';

// Interface para requests autenticados
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    rol: string;
  };
}

/**
 * Rate limiter estricto para endpoints de autenticación
 * Previene ataques de fuerza bruta en login/registro
 */
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // máximo 5 intentos por IP por ventana
  message: {
    success: false,
    error: 'RATE_LIMIT_EXCEEDED',
    message: 'Demasiados intentos de autenticación. Intenta de nuevo en 15 minutos.',
    retryAfter: '15 minutos'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  
  // Función para generar key personalizada (IP + User-Agent para mayor seguridad)
  keyGenerator: (req: Request): string => {
    const userAgent = req.get('User-Agent') || 'unknown';
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    return `${ip}-${userAgent.substring(0, 50)}`;
  },

  // Handler personalizado para rate limit exceeded
  handler: (req: Request, res: Response) => {
    console.warn(`⚠️ Rate limit exceeded for auth endpoint - IP: ${req.ip}, UA: ${req.get('User-Agent')}`);
    res.status(429).json({
      success: false,
      error: 'RATE_LIMIT_EXCEEDED',
      message: 'Demasiados intentos de autenticación. Intenta de nuevo en 15 minutos.',
      timestamp: new Date().toISOString(),
      retryAfter: 900 // 15 minutos en segundos
    });
  },

  // Skip rate limiting en tests
  skip: (_req: Request) => {
    return process.env['NODE_ENV'] === 'test';
  }
});

/**
 * Rate limiter moderado para endpoints de API general
 * Protege contra uso excesivo de la API
 */
export const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // máximo 100 requests por IP por ventana
  message: {
    success: false,
    error: 'RATE_LIMIT_EXCEEDED',
    message: 'Demasiadas peticiones. Intenta de nuevo en unos minutos.',
    retryAfter: '15 minutos'
  },
  standardHeaders: true,
  legacyHeaders: false,

  keyGenerator: (req: Request): string => {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    return ip;
  },

  handler: (req: Request, res: Response) => {
    console.warn(`⚠️ Rate limit exceeded for API - IP: ${req.ip}, Endpoint: ${req.path}`);
    res.status(429).json({
      success: false,
      error: 'RATE_LIMIT_EXCEEDED',
      message: 'Demasiadas peticiones. Intenta de nuevo en unos minutos.',
      timestamp: new Date().toISOString(),
      retryAfter: 900
    });
  },

  skip: (_req: Request) => {
    return process.env['NODE_ENV'] === 'test';
  }
});

/**
 * Rate limiter muy estricto para operaciones sensibles
 * Compartir listas, cambiar permisos, etc.
 */
export const sensitiveRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 10, // máximo 10 operaciones sensibles por IP por hora
  message: {
    success: false,
    error: 'RATE_LIMIT_EXCEEDED',
    message: 'Demasiadas operaciones sensibles. Intenta de nuevo en 1 hora.',
    retryAfter: '1 hora'
  },
  standardHeaders: true,
  legacyHeaders: false,

  keyGenerator: (req: Request): string => {
    const userAgent = req.get('User-Agent') || 'unknown';
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    return `sensitive-${ip}-${userAgent.substring(0, 30)}`;
  },

  handler: (req: Request, res: Response) => {
    console.warn(`🚨 Sensitive rate limit exceeded - IP: ${req.ip}, Endpoint: ${req.path}, UA: ${req.get('User-Agent')}`);
    res.status(429).json({
      success: false,
      error: 'RATE_LIMIT_EXCEEDED',
      message: 'Demasiadas operaciones sensibles. Intenta de nuevo en 1 hora.',
      timestamp: new Date().toISOString(),
      retryAfter: 3600 // 1 hora en segundos
    });
  },

  skip: (_req: Request) => {
    return process.env['NODE_ENV'] === 'test';
  }
});

/**
 * Rate limiter específico para endpoints de IA
 * Control granular por usuario individual para evitar abuso de costos
 */
export const aiRateLimitPerUser = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 20, // 20 requests por usuario por hora
  message: {
    success: false,
    error: 'AI_RATE_LIMIT_EXCEEDED',
    message: 'Límite de uso de IA excedido. Intenta de nuevo en una hora.',
    retryAfter: '1 hora'
  },
  standardHeaders: true,
  legacyHeaders: false,
  
  // Key generator por usuario (si está autenticado) o IP (si no)
  keyGenerator: (req: AuthenticatedRequest): string => {
    const userReq = req as AuthenticatedRequest;
    if (userReq.user?.id) {
      return `ai-user:${userReq.user.id}`;
    }
    // Fallback a IP si no hay usuario autenticado
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    return `ai-ip:${ip}`;
  },

  handler: (req: AuthenticatedRequest, res: Response) => {
    const userReq = req as AuthenticatedRequest;
    const identifier = userReq.user?.id ? `User: ${userReq.user.id}` : `IP: ${req.ip}`;
    
    console.warn(`🤖 AI Rate limit exceeded - ${identifier}, Endpoint: ${req.path}`);
    
    res.status(429).json({
      success: false,
      error: 'AI_RATE_LIMIT_EXCEEDED',
      message: 'Límite de uso de IA excedido por usuario. Intenta de nuevo en una hora.',
      timestamp: new Date().toISOString(),
      retryAfter: 3600, // 1 hora
      userId: userReq.user?.id || null
    });
  },

  skip: (_req: Request) => {
    return process.env['NODE_ENV'] === 'test';
  }
});

/**
 * Rate limiter más estricto para endpoints de IA costosos
 * Para operaciones que consumen muchos tokens
 */
export const aiRateLimitStrict = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 horas
  max: 50, // 50 requests por usuario por día
  message: {
    success: false,
    error: 'AI_DAILY_LIMIT_EXCEEDED',
    message: 'Límite diario de IA excedido. Intenta de nuevo mañana.',
    retryAfter: '24 horas'
  },
  standardHeaders: true,
  legacyHeaders: false,
  
  keyGenerator: (req: AuthenticatedRequest): string => {
    const userReq = req as AuthenticatedRequest;
    if (userReq.user?.id) {
      return `ai-daily:${userReq.user.id}`;
    }
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    return `ai-daily-ip:${ip}`;
  },

  handler: (req: AuthenticatedRequest, res: Response) => {
    const userReq = req as AuthenticatedRequest;
    const identifier = userReq.user?.id ? `User: ${userReq.user.id}` : `IP: ${req.ip}`;
    
    console.warn(`🚨 AI Daily limit exceeded - ${identifier}, Endpoint: ${req.path}`);
    
    res.status(429).json({
      success: false,
      error: 'AI_DAILY_LIMIT_EXCEEDED',
      message: 'Límite diario de IA excedido. Intenta de nuevo mañana.',
      timestamp: new Date().toISOString(),
      retryAfter: 86400, // 24 horas
      userId: userReq.user?.id || null
    });
  },

  skip: (_req: Request) => {
    return process.env['NODE_ENV'] === 'test';
  }
});