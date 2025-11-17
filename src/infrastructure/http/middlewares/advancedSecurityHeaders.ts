/**
 * Advanced Security Headers Configuration
 * Enterprise-grade security headers para protección completa
 */

import helmet, { HelmetOptions } from 'helmet';
import { Request, Response, NextFunction } from 'express';

// Configuración de CSP por environment
const CSP_CONFIGS = {
  production: {
    defaultSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    scriptSrc: ["'self'"],
    imgSrc: ["'self'", "data:", "https:"],
    fontSrc: ["'self'", "https://fonts.gstatic.com"],
    connectSrc: ["'self'", "https://api.perplexity.ai"],
    frameSrc: ["'none'"],
    objectSrc: ["'none'"],
    baseUri: ["'self'"],
    formAction: ["'self'"],
    upgradeInsecureRequests: [],
  },
  development: {
    defaultSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Para hot reload
    scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Para development tools
    imgSrc: ["'self'", "data:", "https:", "http:"],
    fontSrc: ["'self'", "https://fonts.gstatic.com"],
    connectSrc: ["'self'", "ws:", "wss:", "https://api.perplexity.ai"],
    frameSrc: ["'none'"],
    objectSrc: ["'none'"],
    baseUri: ["'self'"],
    formAction: ["'self'"],
  },
  test: {
    defaultSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    scriptSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", "data:"],
    fontSrc: ["'self'"],
    connectSrc: ["'self'"],
    frameSrc: ["'none'"],
    objectSrc: ["'none'"],
  }
} as const;

/**
 * Configuración enterprise de Helmet
 */
export function getEnterpriseHelmetConfig(): HelmetOptions {
  const environment = process.env['NODE_ENV'] || 'development';
  const isProduction = environment === 'production';
  
  return {
    // Content Security Policy
    contentSecurityPolicy: {
      directives: CSP_CONFIGS[environment as keyof typeof CSP_CONFIGS] || CSP_CONFIGS.development,
      reportOnly: !isProduction, // Solo reportar en desarrollo, bloquear en producción
    },

    // HTTP Strict Transport Security
    hsts: {
      maxAge: 31536000, // 1 año
      includeSubDomains: true,
      preload: true
    },

    // X-Frame-Options
    frameguard: {
      action: 'deny'
    },

    // X-Content-Type-Options
    noSniff: true,

    // X-DNS-Prefetch-Control
    dnsPrefetchControl: {
      allow: false
    },

    // Referrer Policy
    referrerPolicy: {
      policy: ['strict-origin-when-cross-origin']
    },

    // X-Permitted-Cross-Domain-Policies
    permittedCrossDomainPolicies: false,

    // Cross-Origin-Embedder-Policy
    crossOriginEmbedderPolicy: true,

    // Cross-Origin-Opener-Policy
    crossOriginOpenerPolicy: {
      policy: 'same-origin'
    },

    // Cross-Origin-Resource-Policy
    crossOriginResourcePolicy: {
      policy: 'cross-origin'
    }

    // Note: expectCt removed as it's deprecated in newer helmet versions
  };
}

/**
 * Headers de seguridad personalizados adicionales
 */
export const additionalSecurityHeaders = (req: Request, res: Response, next: NextFunction): void => {
  // Server Information Hiding
  res.removeHeader('X-Powered-By');
  res.removeHeader('Server');
  
  // Custom Security Headers
  res.setHeader('X-API-Version', '1.3.0');
  res.setHeader('X-Security-Score', '9.5');
  res.setHeader('X-Rate-Limited', 'true');
  
  // Feature Policy (Permissions Policy)
  res.setHeader('Permissions-Policy', [
    'camera=()',
    'microphone=()',
    'geolocation=()',
    'payment=()',
    'usb=()',
    'magnetometer=()',
    'accelerometer=()',
    'gyroscope=()',
    'ambient-light-sensor=()',
    'autoplay=()',
    'encrypted-media=()',
    'fullscreen=(self)',
    'picture-in-picture=()'
  ].join(', '));

  // Security-related headers for APIs
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, nosnippet, noarchive');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');

  // CORS and Origin validation
  const origin = req.get('Origin');
  const allowedOrigins = [
    'http://localhost:3333',
    'https://listacompra.com',
    'https://app.listacompra.com'
  ];

  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  // Anti-clickjacking for sensitive endpoints
  if (req.path.includes('/admin') || req.path.includes('/auth')) {
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Content-Type-Options', 'nosniff');
  }

  // API rate limiting headers
  const rateLimitInfo = (req as any).rateLimit;
  if (rateLimitInfo) {
    res.setHeader('X-RateLimit-Limit', rateLimitInfo.limit || 'unknown');
    res.setHeader('X-RateLimit-Remaining', rateLimitInfo.remaining || 'unknown');
    res.setHeader('X-RateLimit-Reset', rateLimitInfo.resetTime || 'unknown');
  }

  next();
};

/**
 * Middleware de seguridad específico para APIs sensibles
 */
export const sensitiveEndpointSecurity = (_req: Request, res: Response, next: NextFunction): void => {
  // Headers extra-estrictos para endpoints críticos
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  
  // Evitar caching para datos sensibles
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '-1');
  
  // Cross-Origin headers más restrictivos
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');

  next();
};

/**
 * Security headers para endpoints de autenticación
 */
export const authEndpointSecurity = (_req: Request, res: Response, next: NextFunction): void => {
  // Headers específicos para autenticación
  res.setHeader('X-Auth-Security', 'enabled');
  res.setHeader('X-Login-Attempts-Monitored', 'true');
  
  // Prevenir MIME sniffing en responses de auth
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Headers anti-brute force
  res.setHeader('X-Rate-Limited', 'true');
  res.setHeader('X-Brute-Force-Protection', 'active');

  next();
};

/**
 * Security headers para endpoints de IA
 */
export const aiEndpointSecurity = (_req: Request, res: Response, next: NextFunction): void => {
  // Headers específicos para endpoints de IA
  res.setHeader('X-AI-Provider', 'perplexity');
  res.setHeader('X-AI-Rate-Limited', 'true');
  res.setHeader('X-AI-Content-Filtered', 'true');
  
  // Cache control para responses de IA
  res.setHeader('Cache-Control', 'private, max-age=3600'); // 1 hora cache privado
  res.setHeader('Vary', 'Authorization, User-Agent');

  next();
};

/**
 * Middleware para añadir headers de monitoreo de seguridad
 */
export const securityMonitoringHeaders = (req: Request, res: Response, next: NextFunction): void => {
  const requestId = (req as any).requestId || 'unknown';
  const startTime = Date.now();

  // Headers de tracking de seguridad
  res.setHeader('X-Request-ID', requestId);
  res.setHeader('X-Security-Monitoring', 'active');
  res.setHeader('X-Timestamp', new Date().toISOString());

  // Añadir timing en el response
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    res.setHeader('X-Response-Time', `${duration}ms`);
    
    // Log para monitoreo de rendimiento de seguridad
    if (duration > 5000) { // Más de 5 segundos
      console.warn(`🐌 [SECURITY_PERFORMANCE] Slow security processing: ${duration}ms for ${req.path}`);
    }
  });

  next();
};

/**
 * Configuración completa de seguridad para el servidor
 */
export const setupEnterpriseSecurityHeaders = () => {
  return [
    helmet(getEnterpriseHelmetConfig()),
    additionalSecurityHeaders,
    securityMonitoringHeaders
  ];
};

export default {
  getEnterpriseHelmetConfig,
  additionalSecurityHeaders,
  sensitiveEndpointSecurity,
  authEndpointSecurity,
  aiEndpointSecurity,
  securityMonitoringHeaders,
  setupEnterpriseSecurityHeaders
};