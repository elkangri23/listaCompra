import { Request, Response, NextFunction } from 'express';
import { Logger } from '../../observability/logger/Logger';
import { SecurityAuditService } from '../../observability/audit/SecurityAuditService';

/**
 * Configuración de rate limiting por endpoint
 */
interface RateLimitConfig {
  windowMs: number;        // Ventana de tiempo en ms
  maxRequests: number;     // Máximo número de requests
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: Request) => string;
  onLimitReached?: (req: Request, res: Response) => void;
  message?: string;
  statusCode?: number;
}

/**
 * Configuración de rate limiting adaptativo
 */
interface AdaptiveRateLimitConfig extends RateLimitConfig {
  // Configuración base
  baseMaxRequests: number;
  baseWindowMs: number;
  
  // Configuración adaptativa
  enableAdaptive: boolean;
  adaptiveMultiplier?: number;     // Multiplicador basado en comportamiento
  trustThreshold?: number;         // Umbral de confianza para relajar límites
  suspicionThreshold?: number;     // Umbral de sospecha para endurecer límites
  
  // Configuración por tipo de usuario
  userTypeLimits?: {
    admin?: { maxRequests: number; windowMs: number };
    premium?: { maxRequests: number; windowMs: number };
    verified?: { maxRequests: number; windowMs: number };
    new?: { maxRequests: number; windowMs: number };
  };
}

/**
 * Métricas de usuario para rate limiting adaptativo
 */
interface UserMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  lastRequestTime: number;
  averageRequestInterval: number;
  suspiciousActivity: number;
  trustScore: number;
  registrationDate?: number;
  lastSeen: number;
}

/**
 * Información de rate limit activo
 */
interface RateLimitInfo {
  key: string;
  requests: number;
  maxRequests: number;
  windowMs: number;
  resetTime: number;
  isBlocked: boolean;
  adaptiveMultiplier?: number;
  userType?: string;
  trustScore?: number;
}

/**
 * Servicio avanzado de rate limiting
 * Incluye rate limiting adaptativo basado en comportamiento del usuario
 */
export class AdvancedRateLimitService {
  private readonly requestCounts: Map<string, { count: number; resetTime: number; windowMs: number }>;
  private readonly userMetrics: Map<string, UserMetrics>;
  private readonly blockedIPs: Map<string, { until: number; reason: string }>;
  
  constructor(
    private readonly logger: Logger,
    private readonly auditService: SecurityAuditService
  ) {
    this.requestCounts = new Map();
    this.userMetrics = new Map();
    this.blockedIPs = new Map();

    // Limpiar métricas expiradas cada 5 minutos
    setInterval(() => this.cleanupExpiredData(), 5 * 60 * 1000);
  }

  /**
   * Crea middleware de rate limiting estándar
   */
  createRateLimit(config: RateLimitConfig) {
    return (req: Request, res: Response, next: NextFunction): void => {
      const key = config.keyGenerator ? config.keyGenerator(req) : this.getDefaultKey(req);
      
      if (this.isBlocked(key, req)) {
        this.handleRateLimitExceeded(req, res, config, key);
        return;
      }

      const result = this.checkRateLimit(key, config);
      
      if (!result.allowed) {
        this.handleRateLimitExceeded(req, res, config, key);
        return;
      }

      // Añadir headers de rate limit
      res.set({
        'X-RateLimit-Limit': config.maxRequests.toString(),
        'X-RateLimit-Remaining': (config.maxRequests - result.count).toString(),
        'X-RateLimit-Reset': Math.ceil(result.resetTime / 1000).toString()
      });

      next();
    };
  }

  /**
   * Crea middleware de rate limiting adaptativo
   */
  createAdaptiveRateLimit(config: AdaptiveRateLimitConfig) {
    return (req: Request, res: Response, next: NextFunction): void => {
      const userId = this.getUserId(req);
      const userKey = userId || this.getIPKey(req);
      
      if (this.isBlocked(userKey, req)) {
        this.handleRateLimitExceeded(req, res, config, userKey);
        return;
      }

      // Obtener métricas del usuario
      const metrics = this.getUserMetrics(userKey);
      
      // Calcular límites adaptativos
      const adaptiveLimits = this.calculateAdaptiveLimits(config, metrics, req);
      
      const result = this.checkRateLimit(userKey, {
        ...config,
        maxRequests: adaptiveLimits.maxRequests,
        windowMs: adaptiveLimits.windowMs
      });

      if (!result.allowed) {
        this.handleAdaptiveRateLimitExceeded(req, res, config, userKey, metrics);
        return;
      }

      // Actualizar métricas del usuario
      this.updateUserMetrics(userKey, req, true);

      // Añadir headers de rate limit adaptativo
      res.set({
        'X-RateLimit-Limit': adaptiveLimits.maxRequests.toString(),
        'X-RateLimit-Remaining': (adaptiveLimits.maxRequests - result.count).toString(),
        'X-RateLimit-Reset': Math.ceil(result.resetTime / 1000).toString(),
        'X-RateLimit-Adaptive': 'true',
        'X-RateLimit-Trust-Score': metrics.trustScore.toFixed(2)
      });

      next();
    };
  }

  /**
   * Verifica si una clave está bloqueada
   */
  private isBlocked(key: string, req: Request): boolean {
    const blocked = this.blockedIPs.get(key);
    if (blocked && blocked.until > Date.now()) {
      this.logger.warn('Blocked request attempt', {
        key,
        reason: blocked.reason,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        remainingTime: blocked.until - Date.now()
      });
      return true;
    }

    if (blocked && blocked.until <= Date.now()) {
      this.blockedIPs.delete(key);
    }

    return false;
  }

  /**
   * Verifica rate limit para una clave
   */
  private checkRateLimit(
    key: string, 
    config: RateLimitConfig
  ): { allowed: boolean; count: number; resetTime: number } {
    const now = Date.now();
    const current = this.requestCounts.get(key);

    if (!current || current.resetTime <= now) {
      // Nueva ventana o ventana expirada
      this.requestCounts.set(key, {
        count: 1,
        resetTime: now + config.windowMs,
        windowMs: config.windowMs
      });
      return { allowed: true, count: 1, resetTime: now + config.windowMs };
    }

    current.count++;
    this.requestCounts.set(key, current);

    return {
      allowed: current.count <= config.maxRequests,
      count: current.count,
      resetTime: current.resetTime
    };
  }

  /**
   * Calcula límites adaptativos basados en métricas del usuario
   */
  private calculateAdaptiveLimits(
    config: AdaptiveRateLimitConfig,
    metrics: UserMetrics,
    req: Request
  ): { maxRequests: number; windowMs: number } {
    if (!config.enableAdaptive) {
      return {
        maxRequests: config.baseMaxRequests,
        windowMs: config.baseWindowMs
      };
    }

    // Determinar tipo de usuario
    const userType = this.getUserType(req);
    const userLimits = config.userTypeLimits?.[userType];
    
    if (userLimits) {
      return userLimits;
    }

    // Calcular multiplicador adaptativo
    let multiplier = 1;
    
    // Basar en score de confianza
    if (metrics.trustScore >= (config.trustThreshold || 0.8)) {
      multiplier = config.adaptiveMultiplier || 1.5; // Relajar límites para usuarios confiables
    } else if (metrics.trustScore <= (config.suspicionThreshold || 0.3)) {
      multiplier = 0.5; // Endurecer límites para usuarios sospechosos
    }

    // Ajustar basado en actividad sospechosa
    if (metrics.suspiciousActivity > 5) {
      multiplier *= 0.3;
    }

    // Ajustar basado en patrón de requests
    const avgInterval = metrics.averageRequestInterval;
    if (avgInterval < 1000) { // Menos de 1 segundo entre requests
      multiplier *= 0.7;
    }

    return {
      maxRequests: Math.max(1, Math.floor(config.baseMaxRequests * multiplier)),
      windowMs: config.baseWindowMs
    };
  }

  /**
   * Obtiene métricas del usuario
   */
  private getUserMetrics(key: string): UserMetrics {
    const existing = this.userMetrics.get(key);
    if (existing) {
      return existing;
    }

    const newMetrics: UserMetrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      lastRequestTime: Date.now(),
      averageRequestInterval: 5000, // 5 segundos por defecto
      suspiciousActivity: 0,
      trustScore: 0.5, // Score neutral por defecto
      lastSeen: Date.now()
    };

    this.userMetrics.set(key, newMetrics);
    return newMetrics;
  }

  /**
   * Actualiza métricas del usuario
   */
  private updateUserMetrics(key: string, _req: Request, success: boolean): void {
    const metrics = this.getUserMetrics(key);
    const now = Date.now();
    
    metrics.totalRequests++;
    
    if (success) {
      metrics.successfulRequests++;
    } else {
      metrics.failedRequests++;
    }

    // Calcular intervalo promedio entre requests
    if (metrics.lastRequestTime > 0) {
      const interval = now - metrics.lastRequestTime;
      metrics.averageRequestInterval = 
        (metrics.averageRequestInterval * 0.7) + (interval * 0.3);
    }

    // Detectar actividad sospechosa
    if (metrics.averageRequestInterval < 500) { // Menos de 500ms entre requests
      metrics.suspiciousActivity++;
    }

    // Calcular score de confianza
    const successRate = metrics.successfulRequests / metrics.totalRequests;
    const timeBonus = Math.min(1, (now - (metrics.registrationDate || now)) / (30 * 24 * 60 * 60 * 1000)); // Bonus por tiempo
    const consistencyBonus = metrics.averageRequestInterval > 1000 ? 0.1 : 0;
    
    metrics.trustScore = Math.min(1, Math.max(0, 
      (successRate * 0.6) + 
      (timeBonus * 0.2) + 
      (consistencyBonus * 0.1) +
      ((10 - metrics.suspiciousActivity) * 0.1 / 10)
    ));

    metrics.lastRequestTime = now;
    metrics.lastSeen = now;
    
    this.userMetrics.set(key, metrics);
  }

  /**
   * Maneja exceso de rate limit estándar
   */
  private handleRateLimitExceeded(
    req: Request,
    res: Response,
    config: RateLimitConfig,
    key: string
  ): void {
    this.logger.warn('Rate limit exceeded', {
      key,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path,
      method: req.method
    });

      this.auditService.logSecurityViolation(
      'rate_limit_exceeded',
      {
        key,
        path: req.path,
        method: req.method,
        limit: config.maxRequests,
        window: config.windowMs
      },
      this.getUserId(req) || undefined,
      req.ip
    );

    if (config.onLimitReached) {
      config.onLimitReached(req, res);
    }

    res.status(config.statusCode || 429).json({
      success: false,
      error: config.message || 'Too many requests',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: Math.ceil(config.windowMs / 1000)
    });
  }

  /**
   * Maneja exceso de rate limit adaptativo
   */
  private handleAdaptiveRateLimitExceeded(
    req: Request,
    res: Response,
    config: AdaptiveRateLimitConfig,
    key: string,
    metrics: UserMetrics
  ): void {
    // Actualizar métricas como fallo
    this.updateUserMetrics(key, req, false);
    
    // Aumentar actividad sospechosa
    metrics.suspiciousActivity += 2;
    
    this.logger.warn('Adaptive rate limit exceeded', {
      key,
      ip: req.ip,
      trustScore: metrics.trustScore,
      suspiciousActivity: metrics.suspiciousActivity,
      averageInterval: metrics.averageRequestInterval,
      path: req.path
    });

    this.auditService.logSecurityViolation(
      'adaptive_rate_limit_exceeded',
      {
        key,
        path: req.path,
        trust_score: metrics.trustScore,
        suspicious_activity: metrics.suspiciousActivity,
        average_interval: metrics.averageRequestInterval
      },
      this.getUserId(req) || undefined,
      req.ip
    );

    // Bloquear temporalmente si hay demasiada actividad sospechosa
    if (metrics.suspiciousActivity >= 10) {
      this.blockTemporarily(key, 'High suspicious activity', 15 * 60 * 1000); // 15 minutos
    }

    res.status(429).json({
      success: false,
      error: 'Rate limit exceeded - adaptive limiting active',
      code: 'ADAPTIVE_RATE_LIMIT_EXCEEDED',
      trustScore: Math.round(metrics.trustScore * 100) / 100,
      retryAfter: Math.ceil(config.baseWindowMs / 1000)
    });
  }

  /**
   * Bloquea una clave temporalmente
   */
  private blockTemporarily(key: string, reason: string, duration: number): void {
    this.blockedIPs.set(key, {
      until: Date.now() + duration,
      reason
    });

    this.logger.error('Key blocked temporarily', {
      key,
      reason,
      duration,
      until: new Date(Date.now() + duration).toISOString()
    });
  }

  /**
   * Obtiene clave por defecto para rate limiting
   */
  private getDefaultKey(req: Request): string {
    const userId = this.getUserId(req);
    return userId || this.getIPKey(req);
  }

  /**
   * Obtiene ID del usuario desde el request
   */
  private getUserId(req: Request): string | null {
    return (req as any).user?.id || null;
  }

  /**
   * Obtiene clave basada en IP
   */
  private getIPKey(req: Request): string {
    return `ip:${req.ip}`;
  }

  /**
   * Determina tipo de usuario
   */
  private getUserType(req: Request): 'admin' | 'premium' | 'verified' | 'new' {
    const user = (req as any).user;
    if (!user) return 'new';
    
    if (user.role === 'admin') return 'admin';
    if (user.isPremium) return 'premium';
    if (user.emailVerified) return 'verified';
    
    return 'new';
  }

  /**
   * Limpia datos expirados
   */
  private cleanupExpiredData(): void {
    const now = Date.now();
    
    // Limpiar contadores expirados
    for (const [key, data] of this.requestCounts.entries()) {
      if (data.resetTime <= now) {
        this.requestCounts.delete(key);
      }
    }

    // Limpiar bloqueos expirados
    for (const [key, data] of this.blockedIPs.entries()) {
      if (data.until <= now) {
        this.blockedIPs.delete(key);
      }
    }

    // Limpiar métricas de usuarios inactivos (más de 7 días)
    const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
    for (const [key, metrics] of this.userMetrics.entries()) {
      if (metrics.lastSeen < sevenDaysAgo) {
        this.userMetrics.delete(key);
      }
    }

    this.logger.debug('Rate limit data cleanup completed', {
      requestCounts: this.requestCounts.size,
      blockedIPs: this.blockedIPs.size,
      userMetrics: this.userMetrics.size
    });
  }

  /**
   * Obtiene información de rate limit para una clave
   */
  getRateLimitInfo(key: string): RateLimitInfo | null {
    const count = this.requestCounts.get(key);
    const metrics = this.userMetrics.get(key);
    const blocked = this.blockedIPs.get(key);

    if (!count && !metrics && !blocked) {
      return null;
    }

    const adaptiveMultiplier = metrics ? this.calculateAdaptiveMultiplier(metrics) : undefined;
    const trustScore = metrics?.trustScore;

    return {
      key,
      requests: count?.count || 0,
      maxRequests: count ? 100 : 0, // Default value
      windowMs: count?.windowMs || 0,
      resetTime: count?.resetTime || 0,
      isBlocked: !!blocked && blocked.until > Date.now(),
      ...(trustScore !== undefined && { trustScore }),
      ...(adaptiveMultiplier !== undefined && { adaptiveMultiplier })
    };
  }

  /**
   * Calcula multiplicador adaptativo para información
   */
  private calculateAdaptiveMultiplier(metrics: UserMetrics): number {
    if (metrics.trustScore >= 0.8) return 1.5;
    if (metrics.trustScore <= 0.3) return 0.5;
    return 1;
  }

  /**
   * Obtiene estadísticas generales de rate limiting
   */
  getStats(): {
    activeRateLimits: number;
    blockedKeys: number;
    trackedUsers: number;
    topBlockedReasons: { reason: string; count: number }[];
  } {
    const blockedReasons = new Map<string, number>();
    
    for (const blocked of this.blockedIPs.values()) {
      blockedReasons.set(blocked.reason, (blockedReasons.get(blocked.reason) || 0) + 1);
    }

    return {
      activeRateLimits: this.requestCounts.size,
      blockedKeys: this.blockedIPs.size,
      trackedUsers: this.userMetrics.size,
      topBlockedReasons: Array.from(blockedReasons.entries())
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
    };
  }
}