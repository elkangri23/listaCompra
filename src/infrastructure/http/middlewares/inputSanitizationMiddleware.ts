/**
 * Advanced Input Sanitization Middleware
 * Protección XSS, SQL Injection y validación de entrada enterprise-grade
 */

import { Request, Response, NextFunction } from 'express';
import DOMPurify from 'isomorphic-dompurify';
import validator from 'validator';

// Configuración de sanitización
const SANITIZATION_CONFIG = {
  // XSS Protection
  HTML_ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br'],
  HTML_ALLOWED_ATTRIBUTES: [],
  
  // String limits
  MAX_STRING_LENGTH: 10000,
  MAX_ARRAY_LENGTH: 100,
  MAX_OBJECT_DEPTH: 10,
  
  // SQL Injection patterns
  SQL_INJECTION_PATTERNS: [
    /('|(\\x27)|(\\x2D){2})|((;|\\x3B)(\\s)*(drop|alter|create|insert|update|delete|select|union|exec))/i,
    /(\\x27)|(')|(\\x2D){2}|((\\x3B)(\\s)*(drop|alter|create|insert|update|delete|select|union|exec))/i,
    /(\%27)|(')|(\\x2D){2}|((\%3B)(\\s)*(drop|alter|create|insert|update|delete|select|union|exec))/i,
    /(or|and)\\s+(1=1|1=0|true|false)/i,
    /union\\s+(all\\s+)?select/i,
    /<script[^>]*>.*?<\/script>/gi,
    /javascript:/gi,
    /vbscript:/gi,
    /on\w+\s*=/gi
  ],
  
  // Command Injection patterns
  COMMAND_INJECTION_PATTERNS: [
    /[;&|`$(){}\\[\\]<>]/g,
    /\\.\\.[\\/\\\\]/g,
    /(nc|netcat|curl|wget|ping|nslookup|dig)/i
  ],
  
  // Path Traversal patterns
  PATH_TRAVERSAL_PATTERNS: [
    /\.\.[\\/\\\\]/g,
    /[\x00-\x1f\x7f-\x9f]/g,
    /\\.\\.%2f/gi,
    /\\.\\.%5c/gi
  ]
} as const;

// Tipos de datos soportados para sanitización (eliminamos alias no usados)
// Nota: tipo previo no utilizado eliminado para evitar warning de compilación

interface SanitizationResult {
  sanitized: any;
  warnings: string[];
  blocked: string[];
}

interface SanitizationOptions {
  allowHtml?: boolean;
  maxLength?: number;
  strict?: boolean;
  allowedFields?: string[];
}

/**
 * Input Sanitization Service
 */
export class InputSanitizationService {
  
  /**
   * Sanitizar string individual
   */
  public static sanitizeString(
    input: string, 
    options: SanitizationOptions = {}
  ): { value: string; warnings: string[] } {
    const warnings: string[] = [];
    let sanitized = input;
    
    // 1. Longitud máxima
    const maxLength = options.maxLength || SANITIZATION_CONFIG.MAX_STRING_LENGTH;
    if (sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength);
      warnings.push(`String truncated to ${maxLength} characters`);
    }
    
    // 2. SQL Injection detection
    for (const pattern of SANITIZATION_CONFIG.SQL_INJECTION_PATTERNS) {
      if (pattern.test(sanitized)) {
        warnings.push('Potential SQL injection detected and blocked');
        sanitized = sanitized.replace(pattern, '');
      }
    }
    
    // 3. Command Injection detection
    for (const pattern of SANITIZATION_CONFIG.COMMAND_INJECTION_PATTERNS) {
      if (pattern.test(sanitized)) {
        warnings.push('Potential command injection detected and blocked');
        sanitized = sanitized.replace(pattern, '');
      }
    }
    
    // 4. Path Traversal detection
    for (const pattern of SANITIZATION_CONFIG.PATH_TRAVERSAL_PATTERNS) {
      if (pattern.test(sanitized)) {
        warnings.push('Potential path traversal detected and blocked');
        sanitized = sanitized.replace(pattern, '');
      }
    }
    
    // 5. XSS Protection
    if (!options.allowHtml) {
      // Escape HTML characters
      sanitized = validator.escape(sanitized);
    } else {
      // Allow specific HTML tags only
      sanitized = DOMPurify.sanitize(sanitized, {
        // Copias mutables para cumplir con la firma de tipos
        ALLOWED_TAGS: [...SANITIZATION_CONFIG.HTML_ALLOWED_TAGS],
        ALLOWED_ATTR: [...SANITIZATION_CONFIG.HTML_ALLOWED_ATTRIBUTES]
      });
    }
    
    // 6. Normalización
    sanitized = validator.trim(sanitized);
    sanitized = validator.normalizeEmail(sanitized, { gmail_lowercase: false }) || sanitized;
    
    return { value: sanitized, warnings };
  }
  
  /**
   * Sanitizar objeto completo recursivamente
   */
  public static sanitizeObject(
    obj: any, 
    options: SanitizationOptions = {},
    depth: number = 0
  ): SanitizationResult {
    const warnings: string[] = [];
    const blocked: string[] = [];
    
    // Protección contra deep nesting (DoS protection)
    if (depth > SANITIZATION_CONFIG.MAX_OBJECT_DEPTH) {
      blocked.push(`Object nesting too deep (max: ${SANITIZATION_CONFIG.MAX_OBJECT_DEPTH})`);
      return { sanitized: null, warnings, blocked };
    }
    
    // Manejo de diferentes tipos
    if (obj === null || obj === undefined) {
      return { sanitized: obj, warnings, blocked };
    }
    
    if (typeof obj === 'string') {
      const result = this.sanitizeString(obj, options);
      warnings.push(...result.warnings);
      return { sanitized: result.value, warnings, blocked };
    }
    
    if (typeof obj === 'number' || typeof obj === 'boolean') {
      return { sanitized: obj, warnings, blocked };
    }
    
    if (obj instanceof Date) {
      return { sanitized: obj, warnings, blocked };
    }
    
    if (Array.isArray(obj)) {
      // Protección contra arrays muy grandes
      if (obj.length > SANITIZATION_CONFIG.MAX_ARRAY_LENGTH) {
        warnings.push(`Array truncated to ${SANITIZATION_CONFIG.MAX_ARRAY_LENGTH} items`);
        obj = obj.slice(0, SANITIZATION_CONFIG.MAX_ARRAY_LENGTH);
      }
      
      const sanitizedArray = obj.map((item: any) => {
        const result = this.sanitizeObject(item, options, depth + 1);
        warnings.push(...result.warnings);
        blocked.push(...result.blocked);
        return result.sanitized;
      });
      
      return { sanitized: sanitizedArray, warnings, blocked };
    }
    
    if (typeof obj === 'object') {
      const sanitizedObj: any = {};
      
      for (const [key, value] of Object.entries(obj)) {
        // Validar nombres de campos si hay whitelist
        if (options.allowedFields && !options.allowedFields.includes(key)) {
          blocked.push(`Field '${key}' not in allowed list`);
          continue;
        }
        
        // Sanitizar la key también
        const keyResult = this.sanitizeString(key, { maxLength: 100 });
        warnings.push(...keyResult.warnings);
        
        // Sanitizar el valor
        const valueResult = this.sanitizeObject(value, options, depth + 1);
        warnings.push(...valueResult.warnings);
        blocked.push(...valueResult.blocked);
        
        sanitizedObj[keyResult.value] = valueResult.sanitized;
      }
      
      return { sanitized: sanitizedObj, warnings, blocked };
    }
    
    // Tipo no soportado
    blocked.push(`Unsupported data type: ${typeof obj}`);
    return { sanitized: null, warnings, blocked };
  }
  
  /**
   * Validar email con patrones de seguridad adicionales
   */
  public static sanitizeEmail(email: string): { value: string | null; valid: boolean; warnings: string[] } {
    const warnings: string[] = [];
    
    if (!email || typeof email !== 'string') {
      return { value: null, valid: false, warnings: ['Invalid email format'] };
    }
    
    // Normalizar
    let sanitized = validator.trim(email.toLowerCase());
    
    // Validación básica
    if (!validator.isEmail(sanitized)) {
      return { value: null, valid: false, warnings: ['Invalid email format'] };
    }
    
    // Verificaciones de seguridad adicionales
    if (sanitized.includes('..')) {
      warnings.push('Email contains consecutive dots');
    }
    
    if (sanitized.length > 254) {
      warnings.push('Email too long');
      return { value: null, valid: false, warnings };
    }
    
    // Limpiar caracteres peligrosos
    const dangerousChars = /[<>"\\/(){}[\]`]/g;
    if (dangerousChars.test(sanitized)) {
      warnings.push('Email contains potentially dangerous characters');
      sanitized = sanitized.replace(dangerousChars, '');
    }
    
    return { value: sanitized, valid: true, warnings };
  }
  
  /**
   * Sanitizar URL
   */
  public static sanitizeUrl(url: string): { value: string | null; valid: boolean; warnings: string[] } {
    const warnings: string[] = [];
    
    if (!url || typeof url !== 'string') {
      return { value: null, valid: false, warnings: ['Invalid URL'] };
    }
    
    let sanitized = validator.trim(url);
    
    // Validación básica de URL
    if (!validator.isURL(sanitized, { 
      protocols: ['http', 'https'],
      require_protocol: true 
    })) {
      return { value: null, valid: false, warnings: ['Invalid URL format'] };
    }
    
    // Verificaciones de seguridad
    const suspiciousPatterns = [
      /javascript:/gi,
      /data:/gi,
      /vbscript:/gi,
      /file:/gi,
      /ftp:/gi
    ];
    
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(sanitized)) {
        warnings.push('Potentially dangerous URL protocol detected');
        return { value: null, valid: false, warnings };
      }
    }
    
    return { value: sanitized, valid: true, warnings };
  }
}

/**
 * Middleware para sanitización automática de requests
 */
export const inputSanitizationMiddleware = (options: SanitizationOptions = {}) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const startTime = Date.now();
      const allWarnings: string[] = [];
      const allBlocked: string[] = [];
      
      // Sanitizar body
      if (req.body && typeof req.body === 'object') {
        const bodyResult = InputSanitizationService.sanitizeObject(req.body, options);
        req.body = bodyResult.sanitized;
        allWarnings.push(...bodyResult.warnings);
        allBlocked.push(...bodyResult.blocked);
      }
      
      // Sanitizar query parameters
      if (req.query && typeof req.query === 'object') {
        const queryResult = InputSanitizationService.sanitizeObject(req.query, {
          ...options,
          maxLength: 500 // Queries más cortas
        });
        req.query = queryResult.sanitized;
        allWarnings.push(...queryResult.warnings);
        allBlocked.push(...queryResult.blocked);
      }
      
      // Sanitizar params
      if (req.params && typeof req.params === 'object') {
        const paramsResult = InputSanitizationService.sanitizeObject(req.params, {
          ...options,
          maxLength: 100 // Params muy cortos
        });
        req.params = paramsResult.sanitized;
        allWarnings.push(...paramsResult.warnings);
        allBlocked.push(...paramsResult.blocked);
      }
      
      const processingTime = Date.now() - startTime;
      
      // Logging de actividad sospechosa
      if (allBlocked.length > 0) {
        console.warn(`🚨 [INPUT_SANITIZATION] Blocked content detected:`, {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          path: req.path,
          method: req.method,
          blocked: allBlocked,
          processingTime
        });
      }
      
      if (allWarnings.length > 0) {
        console.warn(`⚠️ [INPUT_SANITIZATION] Warnings:`, {
          ip: req.ip,
          path: req.path,
          warnings: allWarnings,
          processingTime
        });
      }
      
      // Añadir metadata al request para debugging
      (req as any).sanitizationMetadata = {
        warnings: allWarnings,
        blocked: allBlocked,
        processingTime
      };
      
      next();
      
    } catch (error) {
      console.error('❌ Error in input sanitization:', error);
      
      // En caso de error, rechazar request si está en modo estricto
      if (options.strict) {
        res.status(400).json({
          success: false,
          error: 'INPUT_SANITIZATION_ERROR',
          message: 'Request could not be safely processed'
        });
        return;
      }
      
      // Si no es estricto, continuar
      next();
    }
  };
};

/**
 * Middleware específico para endpoints sensibles
 */
export const strictInputSanitization = inputSanitizationMiddleware({
  strict: true,
  allowHtml: false,
  maxLength: 1000
});

/**
 * Middleware para endpoints que permiten HTML limitado
 */
export const htmlAwareInputSanitization = inputSanitizationMiddleware({
  strict: false,
  allowHtml: true,
  maxLength: 5000
});

/**
 * Middleware ultra-estricto para autenticación
 */
export const authInputSanitization = inputSanitizationMiddleware({
  strict: true,
  allowHtml: false,
  maxLength: 255,
  allowedFields: ['email', 'password', 'nombre', 'apellidos', 'token', 'refreshToken']
});

export default {
  InputSanitizationService,
  inputSanitizationMiddleware,
  strictInputSanitization,
  htmlAwareInputSanitization,
  authInputSanitization
};
