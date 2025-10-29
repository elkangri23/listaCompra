import { Request, Response, NextFunction } from 'express';
import { Logger } from '../../observability/logger/Logger';
import { SecurityAuditService } from '../../observability/audit/SecurityAuditService';

/**
 * Tipos de datos que pueden ser sanitizados
 */
export type SanitizableFieldType = 
  | 'html' 
  | 'text' 
  | 'email' 
  | 'url' 
  | 'filename' 
  | 'sql_identifier'
  | 'json'
  | 'alphanumeric';

/**
 * Configuración de sanitización por campo
 */
interface SanitizationRule {
  type: SanitizableFieldType;
  required?: boolean;
  maxLength?: number;
  minLength?: number;
  allowEmpty?: boolean;
  customValidator?: (value: any) => boolean;
  customSanitizer?: (value: any) => any;
}

/**
 * Configuración de sanitización por endpoint
 */
interface EndpointSanitizationConfig {
  body?: Record<string, SanitizationRule>;
  query?: Record<string, SanitizationRule>;
  params?: Record<string, SanitizationRule>;
  headers?: Record<string, SanitizationRule>;
}

/**
 * Resultado de sanitización
 */
interface SanitizationResult {
  isValid: boolean;
  sanitizedData: any;
  violations: {
    field: string;
    violation: string;
    originalValue?: any;
    sanitizedValue?: any;
  }[];
  securityThreats: {
    type: 'XSS' | 'SQL_INJECTION' | 'PATH_TRAVERSAL' | 'SCRIPT_INJECTION' | 'HTML_INJECTION';
    field: string;
    threat: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  }[];
}

/**
 * Servicio avanzado de sanitización de inputs
 * Protege contra XSS, inyección SQL, path traversal y otros ataques
 */
export class InputSanitizationService {
  private readonly xssPatterns: RegExp[];
  private readonly sqlInjectionPatterns: RegExp[];
  private readonly pathTraversalPatterns: RegExp[];
  private readonly scriptInjectionPatterns: RegExp[];

  constructor(
    private readonly logger: Logger,
    private readonly auditService: SecurityAuditService
  ) {
    // Patrones de detección de amenazas
    this.xssPatterns = [
      /<script[\s\S]*?>[\s\S]*?<\/script>/gi,
      /<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<object[\s\S]*?>[\s\S]*?<\/object>/gi,
      /<embed[\s\S]*?>/gi,
      /vbscript:/gi,
      /<meta[\s\S]*?>/gi
    ];

    this.sqlInjectionPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/gi,
      /((\%27)|(\')|(--)|(\%23)|(#))/gi,
      /((\%3D)|(=))[^\n]*((\%27)|(\')|(--)|(\%23)|(#))/gi,
      /\w*((\%27)|(\'))((\%6F)|o|(\%4F))((\%72)|r|(\%52))/gi,
      /((\%27)|(\'))union/gi
    ];

    this.pathTraversalPatterns = [
      /\.\.\//gi,
      /\.\.\\?/gi,
      /%2e%2e%2f/gi,
      /%2e%2e\\/gi,
      /\.\.%2f/gi,
      /\.\.%5c/gi
    ];

    this.scriptInjectionPatterns = [
      /eval\s*\(/gi,
      /Function\s*\(/gi,
      /setTimeout\s*\(/gi,
      /setInterval\s*\(/gi,
      /document\.write/gi,
      /innerHTML/gi,
      /outerHTML/gi
    ];
  }

  /**
   * Sanitiza datos según reglas especificadas
   */
  sanitizeData(
    data: any,
    rules: Record<string, SanitizationRule>,
    context: string
  ): SanitizationResult {
    const result: SanitizationResult = {
      isValid: true,
      sanitizedData: {},
      violations: [],
      securityThreats: []
    };

    for (const [field, rule] of Object.entries(rules)) {
      const value = data[field];
      
      // Verificar si es requerido
      if (rule.required && (value === undefined || value === null || value === '')) {
        result.violations.push({
          field,
          violation: 'Required field missing'
        });
        result.isValid = false;
        continue;
      }

      // Verificar si permite vacío
      if (!rule.allowEmpty && value === '') {
        result.violations.push({
          field,
          violation: 'Empty value not allowed'
        });
        result.isValid = false;
        continue;
      }

      // Saltear si es undefined/null y no es requerido
      if (value === undefined || value === null) {
        result.sanitizedData[field] = value;
        continue;
      }

      // Convertir a string para procesamiento
      const stringValue = String(value);
      
      // Detectar amenazas de seguridad
      const threats = this.detectSecurityThreats(stringValue, field);
      result.securityThreats.push(...threats);

      // Sanitizar según tipo
      let sanitizedValue = this.sanitizeByType(stringValue, rule.type);

      // Aplicar sanitizador personalizado si existe
      if (rule.customSanitizer) {
        sanitizedValue = rule.customSanitizer(sanitizedValue);
      }

      // Validar longitud
      if (rule.maxLength && sanitizedValue.length > rule.maxLength) {
        result.violations.push({
          field,
          violation: `Value exceeds maximum length of ${rule.maxLength}`,
          originalValue: stringValue,
          sanitizedValue: sanitizedValue.substring(0, rule.maxLength)
        });
        sanitizedValue = sanitizedValue.substring(0, rule.maxLength);
      }

      if (rule.minLength && sanitizedValue.length < rule.minLength) {
        result.violations.push({
          field,
          violation: `Value is shorter than minimum length of ${rule.minLength}`,
          originalValue: stringValue,
          sanitizedValue
        });
        result.isValid = false;
      }

      // Aplicar validador personalizado
      if (rule.customValidator && !rule.customValidator(sanitizedValue)) {
        result.violations.push({
          field,
          violation: 'Custom validation failed',
          originalValue: stringValue,
          sanitizedValue
        });
        result.isValid = false;
      }

      result.sanitizedData[field] = sanitizedValue;

      // Log si hubo sanitización
      if (sanitizedValue !== stringValue) {
        this.logger.debug('Input sanitized', {
          field,
          context,
          originalLength: stringValue.length,
          sanitizedLength: sanitizedValue.length,
          type: rule.type
        });
      }
    }

    // Registrar amenazas críticas
    const criticalThreats = result.securityThreats.filter(t => t.severity === 'CRITICAL');
    if (criticalThreats.length > 0) {
      this.auditService.logSecurityViolation(
        'input_sanitization_critical_threat',
        {
          context,
          threats: criticalThreats,
          total_threats: result.securityThreats.length
        }
      );
    }

    return result;
  }

  /**
   * Sanitiza valor según su tipo (versión simplificada sin DOMPurify)
   */
  private sanitizeByType(value: string, type: SanitizableFieldType): string {
    switch (type) {
      case 'html':
        // Sanitización básica HTML (remover tags peligrosos)
        return value
          .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
          .replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, '')
          .replace(/javascript:/gi, '')
          .replace(/on\w+\s*=/gi, '')
          .replace(/<object[\s\S]*?>[\s\S]*?<\/object>/gi, '')
          .replace(/<embed[\s\S]*?>/gi, '')
          .replace(/vbscript:/gi, '');

      case 'text':
        return value.replace(/[<>\"'&]/g, (match) => {
          const entities: Record<string, string> = {
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#x27;',
            '&': '&amp;'
          };
          return entities[match] || match;
        });

      case 'email':
        return value.toLowerCase()
          .replace(/[^a-z0-9@._-]/g, '')
          .substring(0, 254);

      case 'url':
        try {
          const url = new URL(value);
          if (!['http:', 'https:'].includes(url.protocol)) {
            return '';
          }
          return url.toString();
        } catch {
          return '';
        }

      case 'filename':
        return value
          .replace(/[^a-zA-Z0-9._-]/g, '')
          .replace(/\.{2,}/g, '.')
          .substring(0, 255);

      case 'sql_identifier':
        return value
          .replace(/[^a-zA-Z0-9_]/g, '')
          .substring(0, 64);

      case 'json':
        try {
          JSON.parse(value);
          return value.replace(/[<>\"'&]/g, (match) => {
            const entities: Record<string, string> = {
              '<': '&lt;',
              '>': '&gt;',
              '"': '&quot;',
              "'": '&#x27;',
              '&': '&amp;'
            };
            return entities[match] || match;
          });
        } catch {
          return '{}';
        }

      case 'alphanumeric':
        return value.replace(/[^a-zA-Z0-9]/g, '');

      default:
        return value.replace(/[<>\"'&]/g, (match) => {
          const entities: Record<string, string> = {
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#x27;',
            '&': '&amp;'
          };
          return entities[match] || match;
        });
    }
  }

  /**
   * Detecta amenazas de seguridad en el input
   */
  private detectSecurityThreats(
    value: string, 
    field: string
  ): SanitizationResult['securityThreats'] {
    const threats: SanitizationResult['securityThreats'] = [];

    // Detectar XSS
    for (const pattern of this.xssPatterns) {
      if (pattern.test(value)) {
        threats.push({
          type: 'XSS',
          field,
          threat: 'Cross-site scripting pattern detected',
          severity: 'CRITICAL'
        });
        break;
      }
    }

    // Detectar inyección SQL
    for (const pattern of this.sqlInjectionPatterns) {
      if (pattern.test(value)) {
        threats.push({
          type: 'SQL_INJECTION',
          field,
          threat: 'SQL injection pattern detected',
          severity: 'CRITICAL'
        });
        break;
      }
    }

    // Detectar path traversal
    for (const pattern of this.pathTraversalPatterns) {
      if (pattern.test(value)) {
        threats.push({
          type: 'PATH_TRAVERSAL',
          field,
          threat: 'Path traversal pattern detected',
          severity: 'HIGH'
        });
        break;
      }
    }

    // Detectar inyección de script
    for (const pattern of this.scriptInjectionPatterns) {
      if (pattern.test(value)) {
        threats.push({
          type: 'SCRIPT_INJECTION',
          field,
          threat: 'Script injection pattern detected',
          severity: 'CRITICAL'
        });
        break;
      }
    }

    return threats;
  }

  /**
   * Crea middleware de sanitización para endpoints específicos
   */
  createSanitizationMiddleware(
    config: EndpointSanitizationConfig,
    options: {
      blockOnCriticalThreats?: boolean;
      logViolations?: boolean;
      context?: string;
    } = {}
  ) {
    const {
      blockOnCriticalThreats = true,
      logViolations = true,
      context = 'unknown'
    } = options;

    return (req: Request, res: Response, next: NextFunction): void => {
      try {
        const violations: any[] = [];
        const securityThreats: any[] = [];

        // Sanitizar body
        if (config.body && req.body) {
          const result = this.sanitizeData(req.body, config.body, `${context}.body`);
          req.body = result.sanitizedData;
          violations.push(...result.violations);
          securityThreats.push(...result.securityThreats);
        }

        // Sanitizar query
        if (config.query && req.query) {
          const result = this.sanitizeData(req.query, config.query, `${context}.query`);
          req.query = result.sanitizedData;
          violations.push(...result.violations);
          securityThreats.push(...result.securityThreats);
        }

        // Sanitizar params
        if (config.params && req.params) {
          const result = this.sanitizeData(req.params, config.params, `${context}.params`);
          req.params = result.sanitizedData;
          violations.push(...result.violations);
          securityThreats.push(...result.securityThreats);
        }

        // Sanitizar headers específicos
        if (config.headers) {
          const headerData: Record<string, any> = {};
          for (const header of Object.keys(config.headers)) {
            headerData[header] = req.get(header);
          }
          const result = this.sanitizeData(headerData, config.headers, `${context}.headers`);
          for (const [header, value] of Object.entries(result.sanitizedData)) {
            req.headers[header.toLowerCase()] = String(value);
          }
          violations.push(...result.violations);
          securityThreats.push(...result.securityThreats);
        }

        // Log violaciones si está habilitado
        if (logViolations && (violations.length > 0 || securityThreats.length > 0)) {
          this.logger.warn('Input sanitization violations detected', {
            context,
            violations: violations.length,
            securityThreats: securityThreats.length,
            userId: (req as any).user?.id,
            ip: req.ip,
            userAgent: req.get('User-Agent')
          });
        }

        // Bloquear si hay amenazas críticas
        const criticalThreats = securityThreats.filter(t => t.severity === 'CRITICAL');
        if (blockOnCriticalThreats && criticalThreats.length > 0) {
          this.logger.error('Critical security threats detected in input', {
            context,
            threats: criticalThreats,
            userId: (req as any).user?.id,
            ip: req.ip
          });

          res.status(400).json({
            success: false,
            error: 'Input contains security threats',
            code: 'SECURITY_THREAT_DETECTED',
            threats: criticalThreats.map(t => ({
              type: t.type,
              field: t.field,
              severity: t.severity
            }))
          });
          return;
        }

        // Adjuntar información de sanitización al request
        (req as any).sanitization = {
          violations,
          securityThreats,
          hasViolations: violations.length > 0,
          hasThreats: securityThreats.length > 0
        };

        next();

      } catch (error) {
        this.logger.error('Error in input sanitization middleware', {
          context,
          error: error instanceof Error ? error.message : String(error)
        });

        res.status(500).json({
          success: false,
          error: 'Error procesando input',
          code: 'SANITIZATION_ERROR'
        });
      }
    };
  }

  /**
   * Configuraciones predefinidas para endpoints comunes
   */
  getPresetConfigurations() {
    return {
      // Configuración para endpoints de autenticación
      auth: {
        body: {
          email: { type: 'email' as SanitizableFieldType, required: true, maxLength: 254 },
          password: { type: 'text' as SanitizableFieldType, required: true, minLength: 8, maxLength: 128 },
          nombre: { type: 'text' as SanitizableFieldType, maxLength: 100 },
          apellidos: { type: 'text' as SanitizableFieldType, maxLength: 100 }
        }
      },

      // Configuración para listas
      lists: {
        body: {
          nombre: { type: 'text' as SanitizableFieldType, required: true, maxLength: 200 },
          descripcion: { type: 'text' as SanitizableFieldType, maxLength: 500, allowEmpty: true },
          tiendaId: { type: 'alphanumeric' as SanitizableFieldType, allowEmpty: true }
        }
      },

      // Configuración para productos
      products: {
        body: {
          nombre: { type: 'text' as SanitizableFieldType, required: true, maxLength: 200 },
          descripcion: { type: 'text' as SanitizableFieldType, maxLength: 500, allowEmpty: true },
          cantidad: { type: 'alphanumeric' as SanitizableFieldType, customValidator: (v: any) => !isNaN(Number(v)) && Number(v) > 0 },
          precio: { type: 'alphanumeric' as SanitizableFieldType, allowEmpty: true }
        }
      },

      // Configuración para blueprints
      blueprints: {
        body: {
          nombre: { type: 'text' as SanitizableFieldType, required: true, maxLength: 200 },
          descripcion: { type: 'text' as SanitizableFieldType, maxLength: 1000, allowEmpty: true },
          productos: { type: 'json' as SanitizableFieldType, required: true }
        }
      },

      // Configuración para búsquedas
      search: {
        query: {
          q: { type: 'text' as SanitizableFieldType, maxLength: 200 },
          page: { type: 'alphanumeric' as SanitizableFieldType, customValidator: (v: any) => !isNaN(Number(v)) && Number(v) > 0 },
          limit: { type: 'alphanumeric' as SanitizableFieldType, customValidator: (v: any) => !isNaN(Number(v)) && Number(v) <= 100 }
        }
      }
    };
  }
}