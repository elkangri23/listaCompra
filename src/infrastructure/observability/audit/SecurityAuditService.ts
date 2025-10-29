/**
 * Sistema de Auditoría de Seguridad
 * Registra eventos críticos para compliance y análisis de seguridad
 */

import { Logger } from '@infrastructure/observability/logger/Logger';

export interface AuditEvent {
  id: string;
  timestamp: Date;
  eventType: AuditEventType;
  userId?: string;
  userRole?: string;
  resourceType: string;
  resourceId?: string;
  action: string;
  outcome: 'SUCCESS' | 'FAILURE' | 'DENIED';
  details: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export enum AuditEventType {
  // Autenticación y autorización
  AUTH_LOGIN = 'AUTH_LOGIN',
  AUTH_LOGOUT = 'AUTH_LOGOUT',
  AUTH_FAILED_LOGIN = 'AUTH_FAILED_LOGIN',
  AUTH_PASSWORD_CHANGE = 'AUTH_PASSWORD_CHANGE',
  AUTH_PERMISSION_DENIED = 'AUTH_PERMISSION_DENIED',
  
  // Acceso a datos
  DATA_ACCESS = 'DATA_ACCESS',
  DATA_EXPORT = 'DATA_EXPORT',
  DATA_MODIFICATION = 'DATA_MODIFICATION',
  DATA_DELETION = 'DATA_DELETION',
  
  // Administración
  ADMIN_IMPERSONATION_START = 'ADMIN_IMPERSONATION_START',
  ADMIN_IMPERSONATION_END = 'ADMIN_IMPERSONATION_END',
  ADMIN_CONFIG_CHANGE = 'ADMIN_CONFIG_CHANGE',
  ADMIN_USER_MANAGEMENT = 'ADMIN_USER_MANAGEMENT',
  
  // Seguridad
  SECURITY_VIOLATION = 'SECURITY_VIOLATION',
  SECURITY_ANOMALY = 'SECURITY_ANOMALY',
  SECURITY_RATE_LIMIT = 'SECURITY_RATE_LIMIT',
  SECURITY_INJECTION_ATTEMPT = 'SECURITY_INJECTION_ATTEMPT',
  
  // API y servicios externos
  API_AI_REQUEST = 'API_AI_REQUEST',
  API_EMAIL_SENT = 'API_EMAIL_SENT',
  API_RATE_LIMIT_EXCEEDED = 'API_RATE_LIMIT_EXCEEDED',
  
  // Blueprints
  BLUEPRINT_ACCESS = 'BLUEPRINT_ACCESS',
  BLUEPRINT_PRIVACY_VIOLATION = 'BLUEPRINT_PRIVACY_VIOLATION',
  BLUEPRINT_MODIFICATION = 'BLUEPRINT_MODIFICATION'
}

export interface AuditRepository {
  save(event: AuditEvent): Promise<void>;
  findByUserId(userId: string, options?: AuditQueryOptions): Promise<AuditEvent[]>;
  findByEventType(eventType: AuditEventType, options?: AuditQueryOptions): Promise<AuditEvent[]>;
  findByRiskLevel(riskLevel: string, options?: AuditQueryOptions): Promise<AuditEvent[]>;
  findByDateRange(startDate: Date, endDate: Date, options?: AuditQueryOptions): Promise<AuditEvent[]>;
  getStats(timeframe: 'hour' | 'day' | 'week' | 'month'): Promise<AuditStats>;
}

export interface AuditQueryOptions {
  limit?: number;
  offset?: number;
  sortBy?: 'timestamp' | 'riskLevel';
  sortOrder?: 'asc' | 'desc';
}

export interface AuditStats {
  totalEvents: number;
  eventsByType: Record<string, number>;
  eventsByRiskLevel: Record<string, number>;
  eventsByOutcome: Record<string, number>;
  timeframe: string;
  suspiciousActivity: {
    count: number;
    events: AuditEvent[];
  };
}

export class SecurityAuditService {
  constructor(
    private readonly auditRepository: AuditRepository,
    private readonly logger: Logger
  ) {}

  /**
   * Registra un evento de auditoría
   */
  async logEvent(event: Omit<AuditEvent, 'id' | 'timestamp'>): Promise<void> {
    try {
      const auditEvent: AuditEvent = {
        ...event,
        id: this.generateEventId(),
        timestamp: new Date()
      };

      await this.auditRepository.save(auditEvent);

      // Log crítico para eventos de alto riesgo
      if (auditEvent.riskLevel === 'HIGH' || auditEvent.riskLevel === 'CRITICAL') {
        this.logger.error(`🚨 EVENTO CRÍTICO DE SEGURIDAD: ${auditEvent.eventType}`, {
          eventId: auditEvent.id,
          userId: auditEvent.userId,
          action: auditEvent.action,
          outcome: auditEvent.outcome,
          details: auditEvent.details
        });
      }

      // Detectar patrones sospechosos
      await this.detectAnomalies(auditEvent);

    } catch (error) {
      this.logger.error('Error al registrar evento de auditoría', {
        error: error instanceof Error ? error.message : String(error),
        eventType: event.eventType,
        userId: event.userId
      });
    }
  }

  /**
   * Registra intento de login
   */
  async logLoginAttempt(
    userId: string,
    email: string,
    success: boolean,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    const eventData: any = {
      eventType: success ? AuditEventType.AUTH_LOGIN : AuditEventType.AUTH_FAILED_LOGIN,
      resourceType: 'auth',
      action: 'login',
      outcome: success ? 'SUCCESS' : 'FAILURE',
      details: {
        email,
        reason: success ? 'valid_credentials' : 'invalid_credentials'
      },
      riskLevel: success ? 'LOW' : 'MEDIUM'
    };

    if (success && userId) {
      eventData.userId = userId;
    }

    if (ipAddress) {
      eventData.ipAddress = ipAddress;
    }

    if (userAgent) {
      eventData.userAgent = userAgent;
    }

    await this.logEvent(eventData);
  }

  /**
   * Crea un evento de auditoría con campos opcionales manejados correctamente
   */
  private createAuditEventData(data: {
    eventType: AuditEventType;
    userId?: string | undefined;
    resourceType: string;
    resourceId?: string | undefined;
    action: string;
    outcome: 'SUCCESS' | 'FAILURE' | 'DENIED';
    details: Record<string, any>;
    ipAddress?: string | undefined;
    userAgent?: string | undefined;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  }): Omit<AuditEvent, 'id' | 'timestamp'> {
    const eventData: any = {
      eventType: data.eventType,
      resourceType: data.resourceType,
      action: data.action,
      outcome: data.outcome,
      details: data.details,
      riskLevel: data.riskLevel
    };

    if (data.userId !== undefined) {
      eventData.userId = data.userId;
    }

    if (data.resourceId !== undefined) {
      eventData.resourceId = data.resourceId;
    }

    if (data.ipAddress !== undefined) {
      eventData.ipAddress = data.ipAddress;
    }

    if (data.userAgent !== undefined) {
      eventData.userAgent = data.userAgent;
    }

    return eventData;
  }
  async logPasswordChange(userId: string, ipAddress?: string): Promise<void> {
    const eventData = this.createAuditEventData({
      eventType: AuditEventType.AUTH_PASSWORD_CHANGE,
      userId,
      resourceType: 'auth',
      action: 'password_change',
      outcome: 'SUCCESS',
      details: {
        method: 'user_initiated'
      },
      ipAddress,
      riskLevel: 'MEDIUM'
    });

    await this.logEvent(eventData);
  }

  /**
   * Registra denegación de permiso
   */
  async logPermissionDenied(
    userId: string,
    resource: string,
    action: string,
    reason: string,
    ipAddress?: string
  ): Promise<void> {
    const eventData = this.createAuditEventData({
      eventType: AuditEventType.AUTH_PERMISSION_DENIED,
      userId,
      resourceType: resource,
      action,
      outcome: 'DENIED',
      details: {
        reason,
        attempted_action: action
      },
      ipAddress,
      riskLevel: 'HIGH'
    });

    await this.logEvent(eventData);
  }

  /**
   * Registra inicio de impersonación administrativa
   */
  async logImpersonationStart(
    adminId: string,
    targetUserId: string,
    duration: number,
    ipAddress?: string
  ): Promise<void> {
    const eventData = this.createAuditEventData({
      eventType: AuditEventType.ADMIN_IMPERSONATION_START,
      userId: adminId,
      resourceType: 'admin',
      resourceId: targetUserId,
      action: 'impersonate',
      outcome: 'SUCCESS',
      details: {
        target_user_id: targetUserId,
        duration_minutes: duration,
        justification: 'administrative_access'
      },
      ipAddress,
      riskLevel: 'CRITICAL'
    });

    await this.logEvent(eventData);
  }

  /**
   * Registra finalización de impersonación
   */
  async logImpersonationEnd(
    adminId: string,
    targetUserId: string,
    duration: number
  ): Promise<void> {
    await this.logEvent({
      eventType: AuditEventType.ADMIN_IMPERSONATION_END,
      userId: adminId,
      resourceType: 'admin',
      resourceId: targetUserId,
      action: 'end_impersonate',
      outcome: 'SUCCESS',
      details: {
        target_user_id: targetUserId,
        actual_duration_minutes: duration
      },
      riskLevel: 'HIGH'
    });
  }

  /**
   * Registra violación de seguridad
   */
  async logSecurityViolation(
    type: string,
    details: Record<string, any>,
    userId?: string,
    ipAddress?: string
  ): Promise<void> {
    const eventData = this.createAuditEventData({
      eventType: AuditEventType.SECURITY_VIOLATION,
      userId,
      resourceType: 'security',
      action: type,
      outcome: 'DENIED',
      details,
      ipAddress,
      riskLevel: 'CRITICAL'
    });

    await this.logEvent(eventData);
  }

  /**
   * Registra intento de inyección
   */
  async logInjectionAttempt(
    type: 'SQL' | 'XSS' | 'PROMPT' | 'COMMAND',
    payload: string,
    userId?: string,
    ipAddress?: string
  ): Promise<void> {
    const eventData = this.createAuditEventData({
      eventType: AuditEventType.SECURITY_INJECTION_ATTEMPT,
      userId,
      resourceType: 'security',
      action: `${type.toLowerCase()}_injection`,
      outcome: 'DENIED',
      details: {
        injection_type: type,
        payload_sample: payload.substring(0, 100),
        payload_length: payload.length
      },
      ipAddress,
      riskLevel: 'CRITICAL'
    });

    await this.logEvent(eventData);
  }

  /**
   * Registra acceso a blueprint
   */
  async logBlueprintAccess(
    blueprintId: string,
    userId: string,
    action: string,
    isPublic: boolean,
    outcome: 'SUCCESS' | 'DENIED',
    ipAddress?: string
  ): Promise<void> {
    const eventData = this.createAuditEventData({
      eventType: AuditEventType.BLUEPRINT_ACCESS,
      userId,
      resourceType: 'blueprint',
      resourceId: blueprintId,
      action,
      outcome,
      details: {
        is_public: isPublic,
        access_type: action
      },
      ipAddress,
      riskLevel: outcome === 'DENIED' ? 'HIGH' : 'LOW'
    });

    await this.logEvent(eventData);
  }

  /**
   * Registra solicitud a API de IA
   */
  async logAIRequest(
    userId: string,
    service: string,
    tokens: number,
    cost: number,
    success: boolean
  ): Promise<void> {
    await this.logEvent({
      eventType: AuditEventType.API_AI_REQUEST,
      userId,
      resourceType: 'ai_api',
      action: 'category_suggestion',
      outcome: success ? 'SUCCESS' : 'FAILURE',
      details: {
        service,
        tokens_used: tokens,
        cost_usd: cost,
        timestamp: new Date().toISOString()
      },
      riskLevel: 'LOW'
    });
  }

  /**
   * Detecta patrones anómalos
   */
  private async detectAnomalies(event: AuditEvent): Promise<void> {
    // Detectar múltiples fallos de login
    if (event.eventType === AuditEventType.AUTH_FAILED_LOGIN) {
      const recentFailures = await this.auditRepository.findByEventType(
        AuditEventType.AUTH_FAILED_LOGIN,
        { limit: 10, sortBy: 'timestamp', sortOrder: 'desc' }
      );

      const recentFailuresFromSameIP = recentFailures.filter(
        e => e.ipAddress === event.ipAddress && 
        e.timestamp > new Date(Date.now() - 15 * 60 * 1000) // Últimos 15 minutos
      );

      if (recentFailuresFromSameIP.length >= 5) {
        const eventData = this.createAuditEventData({
          eventType: AuditEventType.SECURITY_ANOMALY,
          resourceType: 'security',
          action: 'multiple_failed_logins',
          outcome: 'FAILURE',
          details: {
            ip_address: event.ipAddress,
            failure_count: recentFailuresFromSameIP.length,
            time_window: '15_minutes'
          },
          ipAddress: event.ipAddress,
          riskLevel: 'CRITICAL'
        });

        await this.logEvent(eventData);
      }
    }
  }

  /**
   * Obtiene estadísticas de auditoría
   */
  async getAuditStats(timeframe: 'hour' | 'day' | 'week' | 'month'): Promise<AuditStats> {
    return await this.auditRepository.getStats(timeframe);
  }

  /**
   * Busca eventos por usuario
   */
  async getUserAuditTrail(userId: string, options?: AuditQueryOptions): Promise<AuditEvent[]> {
    return await this.auditRepository.findByUserId(userId, options);
  }

  /**
   * Busca eventos de alto riesgo
   */
  async getHighRiskEvents(options?: AuditQueryOptions): Promise<AuditEvent[]> {
    const highRisk = await this.auditRepository.findByRiskLevel('HIGH', options);
    const critical = await this.auditRepository.findByRiskLevel('CRITICAL', options);
    
    return [...critical, ...highRisk].sort((a, b) => 
      b.timestamp.getTime() - a.timestamp.getTime()
    );
  }

  /**
   * Genera ID único para eventos
   */
  private generateEventId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Implementación en memoria del repositorio de auditoría
 * En producción debería usar una base de datos separada
 */
export class InMemoryAuditRepository implements AuditRepository {
  private events: AuditEvent[] = [];

  async save(event: AuditEvent): Promise<void> {
    this.events.push(event);
    
    // Mantener solo los últimos 10000 eventos en memoria
    if (this.events.length > 10000) {
      this.events = this.events.slice(-10000);
    }
  }

  async findByUserId(userId: string, options?: AuditQueryOptions): Promise<AuditEvent[]> {
    let filtered = this.events.filter(e => e.userId === userId);
    return this.applyOptions(filtered, options);
  }

  async findByEventType(eventType: AuditEventType, options?: AuditQueryOptions): Promise<AuditEvent[]> {
    let filtered = this.events.filter(e => e.eventType === eventType);
    return this.applyOptions(filtered, options);
  }

  async findByRiskLevel(riskLevel: string, options?: AuditQueryOptions): Promise<AuditEvent[]> {
    let filtered = this.events.filter(e => e.riskLevel === riskLevel);
    return this.applyOptions(filtered, options);
  }

  async findByDateRange(startDate: Date, endDate: Date, options?: AuditQueryOptions): Promise<AuditEvent[]> {
    let filtered = this.events.filter(e => 
      e.timestamp >= startDate && e.timestamp <= endDate
    );
    return this.applyOptions(filtered, options);
  }

  async getStats(timeframe: 'hour' | 'day' | 'week' | 'month'): Promise<AuditStats> {
    const now = new Date();
    const startDate = this.getStartDate(now, timeframe);
    const eventsInTimeframe = this.events.filter(e => e.timestamp >= startDate);

    const eventsByType: Record<string, number> = {};
    const eventsByRiskLevel: Record<string, number> = {};
    const eventsByOutcome: Record<string, number> = {};

    eventsInTimeframe.forEach(event => {
      eventsByType[event.eventType] = (eventsByType[event.eventType] || 0) + 1;
      eventsByRiskLevel[event.riskLevel] = (eventsByRiskLevel[event.riskLevel] || 0) + 1;
      eventsByOutcome[event.outcome] = (eventsByOutcome[event.outcome] || 0) + 1;
    });

    const suspiciousEvents = eventsInTimeframe.filter(e => 
      e.riskLevel === 'HIGH' || e.riskLevel === 'CRITICAL'
    );

    return {
      totalEvents: eventsInTimeframe.length,
      eventsByType,
      eventsByRiskLevel,
      eventsByOutcome,
      timeframe,
      suspiciousActivity: {
        count: suspiciousEvents.length,
        events: suspiciousEvents.slice(0, 10) // Últimos 10
      }
    };
  }

  private applyOptions(events: AuditEvent[], options?: AuditQueryOptions): AuditEvent[] {
    let result = [...events];

    // Ordenar
    if (options?.sortBy) {
      result.sort((a, b) => {
        if (options.sortBy === 'timestamp') {
          const order = options.sortOrder === 'asc' ? 1 : -1;
          return order * (a.timestamp.getTime() - b.timestamp.getTime());
        }
        return 0;
      });
    }

    // Paginación
    if (options?.offset) {
      result = result.slice(options.offset);
    }

    if (options?.limit) {
      result = result.slice(0, options.limit);
    }

    return result;
  }

  private getStartDate(now: Date, timeframe: string): Date {
    const start = new Date(now);
    
    switch (timeframe) {
      case 'hour':
        start.setHours(start.getHours() - 1);
        break;
      case 'day':
        start.setDate(start.getDate() - 1);
        break;
      case 'week':
        start.setDate(start.getDate() - 7);
        break;
      case 'month':
        start.setMonth(start.getMonth() - 1);
        break;
    }

    return start;
  }
}