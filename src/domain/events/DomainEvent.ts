/**
 * Interfaz base para todos los eventos de dominio
 * Los eventos de dominio representan algo que ha ocurrido en el dominio
 * y que es relevante para el negocio
 */

export interface DomainEvent {
  /**
   * Identificador único del evento
   */
  readonly eventId: string;

  /**
   * Tipo de evento (nombre de la clase)
   */
  readonly eventType: string;

  /**
   * Versión del evento para versionado
   */
  readonly eventVersion: number;

  /**
   * Timestamp de cuando ocurrió el evento
   */
  readonly occurredOn: Date;

  /**
   * ID de la entidad agregada que generó el evento
   */
  readonly aggregateId: string;

  /**
   * Tipo de agregado que generó el evento
   */
  readonly aggregateType: string;

  /**
   * Datos específicos del evento
   */
  readonly eventData: Record<string, any>;

  /**
   * Contexto adicional del evento (usuario, sesión, etc.)
   */
  readonly eventContext: {
    userId?: string;
    correlationId?: string;
    causationId?: string;
    userAgent?: string;
    ipAddress?: string;
  } | undefined;
}

/**
 * Clase base abstracta para implementar eventos de dominio
 */
export abstract class BaseDomainEvent implements DomainEvent {
  public readonly eventId: string;
  public readonly eventType: string;
  public readonly eventVersion: number = 1;
  public readonly occurredOn: Date;
  public readonly aggregateId: string;
  public readonly aggregateType: string;
  public readonly eventData: Record<string, any>;
  public readonly eventContext: {
    userId?: string;
    correlationId?: string;
    causationId?: string;
    userAgent?: string;
    ipAddress?: string;
  } | undefined;

  constructor(
    aggregateId: string,
    aggregateType: string,
    eventData: Record<string, any>,
    eventContext?: {
      userId?: string;
      correlationId?: string;
      causationId?: string;
      userAgent?: string;
      ipAddress?: string;
    }
  ) {
    this.eventId = this.generateEventId();
    this.eventType = this.constructor.name;
    this.occurredOn = new Date();
    this.aggregateId = aggregateId;
    this.aggregateType = aggregateType;
    this.eventData = eventData;
    this.eventContext = eventContext;
  }

  /**
   * Genera un ID único para el evento
   */
  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Serializa el evento a JSON
   */
  toJSON(): Record<string, any> {
    return {
      eventId: this.eventId,
      eventType: this.eventType,
      eventVersion: this.eventVersion,
      occurredOn: this.occurredOn.toISOString(),
      aggregateId: this.aggregateId,
      aggregateType: this.aggregateType,
      eventData: this.eventData,
      eventContext: this.eventContext,
    };
  }

  /**
   * Deserializa un evento desde JSON
   */
  static fromJSON(_json: Record<string, any>): DomainEvent {
    throw new Error('fromJSON must be implemented by concrete event classes');
  }
}