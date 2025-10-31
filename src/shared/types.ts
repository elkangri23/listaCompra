/**
 * Tipos compartidos en toda la aplicación
 */

// Identificadores únicos
export type UUID = string;
export type Email = string;
export type HashedPassword = string;

// Tipos de auditoría
export interface AuditableEntity {
  fechaCreacion: Date;
  fechaActualizacion: Date;
}

// Paginación
export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginationResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

// Tipos de eventos de dominio
export interface DomainEvent {
  aggregateId: UUID;
  eventType: string;
  eventData: Record<string, unknown>;
  occurredOn: Date;
}

// Configuración de aplicación
export interface AppConfig {
  port: number;
  nodeEnv: 'development' | 'production' | 'test';
  database: {
    url: string;
  };
  jwt: {
    secret: string;
    accessExpiresIn: string;
    refreshExpiresIn: string;
  };
  cors: {
    origin: string[];
    credentials: boolean;
  };
}

// Respuestas HTTP estándar
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}