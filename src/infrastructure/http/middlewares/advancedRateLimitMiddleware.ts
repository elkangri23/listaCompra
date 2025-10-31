/**
 * Advanced Rate Limiting Middleware con Redis y configuración granular por endpoint
 * Security Enhancement: Production-ready rate limiting para prevenir abuse
 */

import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import Redis from 'ioredis';
import type { Request, Response } from 'express';

// Interface para requests autenticados
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    rol: string;
  };
}

// Configuración de Redis para rate limiting
const redisConfig = {
  host: process.env['REDIS_HOST'] || 'localhost',
  port: parseInt(process.env['REDIS_PORT'] || '6379'),
  db: 1, // Database dedicada para rate limiting
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  ...(process.env['REDIS_PASSWORD'] && { password: process.env['REDIS_PASSWORD'] }),
};

const redisClient = new Redis(redisConfig);

// Store Redis para rate limiting

function createRedisStore(prefix: string) {
  return new RedisStore({
    sendCommand: async (...args: any[]) => {
      return await redisClient.call(args[0], ...args.slice(1)) as any;
    },
    prefix,
  });
}

/**
 * Configuraciones de rate limiting por tipo de endpoint
 */
export const RATE_LIMIT_CONFIGS = {
  // Autenticación - muy estricto
  AUTH: {
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 5, // 5 intentos por IP
    message: 'Demasiados intentos de autenticación',
  },
  
  // API general - moderado
  API_GENERAL: {
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100, // 100 requests por usuario/IP
    message: 'Límite de API general excedido',
  },
  
  // Operaciones CRUD - usuario normal
  CRUD_USER: {
    windowMs: 5 * 60 * 1000, // 5 minutos
    max: 30, // 30 operaciones por usuario
    message: 'Límite de operaciones CRUD excedido',
  },
  
  // Operaciones administrativas - muy limitado
  ADMIN_OPS: {
    windowMs: 60 * 60 * 1000, // 1 hora
    max: 20, // 20 operaciones admin por usuario
    message: 'Límite de operaciones administrativas excedido',
  },
  
  // IA endpoints - costosos, muy controlado
  AI_STANDARD: {
    windowMs: 60 * 60 * 1000, // 1 hora
    max: 15, // 15 requests IA por usuario por hora
    message: 'Límite de IA estándar excedido',
  },
  
  AI_PREMIUM: {
    windowMs: 24 * 60 * 60 * 1000, // 24 horas
    max: 50, // 50 requests IA premium por día
    message: 'Límite diario de IA premium excedido',
  },
  
  // Endpoints de compartición - sensibles
  SHARING: {
    windowMs: 60 * 60 * 1000, // 1 hora
    max: 10, // 10 invitaciones por hora
    message: 'Límite de compartición excedido',
  },
  
  // Blueprints - creación limitada
  BLUEPRINTS: {
    windowMs: 60 * 60 * 1000, // 1 hora
    max: 5, // 5 blueprints por hora
    message: 'Límite de creación de blueprints excedido',
  },
} as const;

/**
 * Factory function para crear rate limiters específicos
 */
function createAdvancedRateLimit(
  config: typeof RATE_LIMIT_CONFIGS[keyof typeof RATE_LIMIT_CONFIGS],
  options: {
    keyPrefix: string;
    useUserId?: boolean;
    skipAdmin?: boolean;
    customKeyGenerator?: (req: AuthenticatedRequest) => string;
  }
): RateLimitRequestHandler {
  
  return rateLimit({
    store: createRedisStore(options.keyPrefix),
    windowMs: config.windowMs,
    max: config.max,
    standardHeaders: true,
    legacyHeaders: false,
    
    // Key generator personalizado
    keyGenerator: (req: AuthenticatedRequest): string => {
      if (options.customKeyGenerator) {
        return options.customKeyGenerator(req);
      }
      
      const baseKey = `ratelimit:${options.keyPrefix}`;
      
      // Si está configurado para usar user ID y está autenticado
      if (options.useUserId && req.user?.id) {
        return `${baseKey}:user:${req.user.id}`;
      }
      
      // Fallback a IP
      const ip = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent')?.substring(0, 50) || 'unknown';
      return `${baseKey}:ip:${ip}:${userAgent}`;
    },
    
    // Handler personalizado
    handler: (req: AuthenticatedRequest, res: Response) => {
      const userInfo = req.user?.id ? `User: ${req.user.id}` : `IP: ${req.ip}`;
      const endpoint = req.path;
      
      console.warn(`🚨 [RATE_LIMIT] ${options.keyPrefix} exceeded - ${userInfo}, Endpoint: ${endpoint}`);
      
      res.status(429).json({
        success: false,
        error: 'RATE_LIMIT_EXCEEDED',
        message: config.message,
        endpoint,
        timestamp: new Date().toISOString(),
        retryAfter: Math.ceil(config.windowMs / 1000),
        userId: req.user?.id || null,
      });
    },
    
    // Skip logic
    skip: (req: AuthenticatedRequest) => {
      // Skip en tests
      if (process.env['NODE_ENV'] === 'test') {
        return true;
      }
      
      // Skip para admins si está configurado
      if (options.skipAdmin && req.user?.rol === 'admin') {
        return true;
      }
      
      return false;
    },
  });
}

/**
 * Rate limiters específicos por tipo de endpoint
 */

// Autenticación - ultra estricto
export const authAdvancedRateLimit = createAdvancedRateLimit(
  RATE_LIMIT_CONFIGS.AUTH,
  {
    keyPrefix: 'auth',
    useUserId: false, // Por IP para autenticación
  }
);

// API general - moderado
export const apiGeneralAdvancedRateLimit = createAdvancedRateLimit(
  RATE_LIMIT_CONFIGS.API_GENERAL,
  {
    keyPrefix: 'api_general',
    useUserId: true,
    skipAdmin: true, // Admins pueden hacer más requests
  }
);

// CRUD operations - por usuario
export const crudAdvancedRateLimit = createAdvancedRateLimit(
  RATE_LIMIT_CONFIGS.CRUD_USER,
  {
    keyPrefix: 'crud',
    useUserId: true,
    skipAdmin: true,
  }
);

// Operaciones administrativas
export const adminAdvancedRateLimit = createAdvancedRateLimit(
  RATE_LIMIT_CONFIGS.ADMIN_OPS,
  {
    keyPrefix: 'admin',
    useUserId: true,
    skipAdmin: false, // Incluso admins tienen límites
  }
);

// IA estándar (categorización, sugerencias básicas)
export const aiStandardAdvancedRateLimit = createAdvancedRateLimit(
  RATE_LIMIT_CONFIGS.AI_STANDARD,
  {
    keyPrefix: 'ai_standard',
    useUserId: true,
    skipAdmin: false, // IA cuesta dinero, nadie salta límites
  }
);

// IA premium (bulk operations, análisis complejos)
export const aiPremiumAdvancedRateLimit = createAdvancedRateLimit(
  RATE_LIMIT_CONFIGS.AI_PREMIUM,
  {
    keyPrefix: 'ai_premium',
    useUserId: true,
    skipAdmin: false,
  }
);

// Operaciones de compartición
export const sharingAdvancedRateLimit = createAdvancedRateLimit(
  RATE_LIMIT_CONFIGS.SHARING,
  {
    keyPrefix: 'sharing',
    useUserId: true,
    skipAdmin: true,
  }
);

// Creación de blueprints
export const blueprintAdvancedRateLimit = createAdvancedRateLimit(
  RATE_LIMIT_CONFIGS.BLUEPRINTS,
  {
    keyPrefix: 'blueprints',
    useUserId: true,
    skipAdmin: true,
  }
);

/**
 * Rate limiter dinámico basado en rol de usuario
 */
export const dynamicRoleBasedRateLimit = rateLimit({
  store: createRedisStore('dynamic'),
  windowMs: 15 * 60 * 1000, // 15 minutos
  
  // Max dinámico basado en rol
  max: (req: AuthenticatedRequest) => {
    const userReq = req as AuthenticatedRequest;
    
    switch (userReq.user?.rol) {
      case 'admin':
        return 200; // Admins: 200 requests
      case 'premium':
        return 150; // Premium users: 150 requests
      case 'user':
      default:
        return 100; // Usuarios normales: 100 requests
    }
  },
  
  standardHeaders: true,
  legacyHeaders: false,
  
  keyGenerator: (req: AuthenticatedRequest): string => {
    const userReq = req as AuthenticatedRequest;
    if (userReq.user?.id) {
      return `ratelimit:dynamic:user:${userReq.user.id}`;
    }
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    return `ratelimit:dynamic:ip:${ip}`;
  },
  
  handler: (req: AuthenticatedRequest, res: Response) => {
    const userReq = req as AuthenticatedRequest;
    const userInfo = userReq.user?.id ? 
      `User: ${userReq.user.id} (${userReq.user.rol})` : 
      `IP: ${req.ip}`;
    
    console.warn(`🚨 [DYNAMIC_RATE_LIMIT] Exceeded - ${userInfo}, Endpoint: ${req.path}`);
    
    res.status(429).json({
      success: false,
      error: 'DYNAMIC_RATE_LIMIT_EXCEEDED',
      message: 'Límite de requests excedido para tu tipo de usuario',
      userRole: userReq.user?.rol || 'anonymous',
      endpoint: req.path,
      timestamp: new Date().toISOString(),
      retryAfter: 900, // 15 minutos
    });
  },
  
  skip: (_req: Request) => {
    return process.env['NODE_ENV'] === 'test';
  },
});

/**
 * Health check para Redis connection
 */
export const checkRedisConnection = async (): Promise<boolean> => {
  try {
    await redisClient.ping();
    return true;
  } catch (error) {
    console.error('❌ Redis connection failed for rate limiting:', error);
    return false;
  }
};

/**
 * Graceful shutdown para Redis
 */
export const closeRedisConnection = async (): Promise<void> => {
  try {
    await redisClient.quit();
    console.log('✅ Redis rate limiting connection closed gracefully');
  } catch (error) {
    console.error('❌ Error closing Redis rate limiting connection:', error);
  }
};

export default {
  authAdvancedRateLimit,
  apiGeneralAdvancedRateLimit,
  crudAdvancedRateLimit,
  adminAdvancedRateLimit,
  aiStandardAdvancedRateLimit,
  aiPremiumAdvancedRateLimit,
  sharingAdvancedRateLimit,
  blueprintAdvancedRateLimit,
  dynamicRoleBasedRateLimit,
  checkRedisConnection,
  closeRedisConnection,
};