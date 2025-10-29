/**
 * DTO para finalizar impersonación
 */

import type { UUID } from '@shared/types';

export interface EndImpersonationDto {
  /** ID de la sesión de impersonación (opcional si se puede inferir del token) */
  sessionId?: UUID;
  /** Razón para finalizar la impersonación */
  reason?: string;
}

export interface EndImpersonationResponseDto {
  /** Confirmación de que la impersonación terminó */
  success: boolean;
  /** Mensaje descriptivo */
  message: string;
  /** Información de la sesión terminada */
  terminatedSession: {
    sessionId: UUID;
    adminId: UUID;
    targetUserId: UUID;
    startedAt: Date;
    endedAt: Date;
    duration: string; // Duración en formato legible "2h 15m"
  };
  /** Token original del administrador restaurado */
  adminToken: string;
}

export interface ImpersonationAuditDto {
  /** ID único del evento de auditoría */
  auditId: UUID;
  /** Tipo de evento */
  eventType: 'impersonation_started' | 'impersonation_ended' | 'impersonation_expired';
  /** ID del administrador */
  adminId: UUID;
  /** Email del administrador */
  adminEmail: string;
  /** ID del usuario objetivo */
  targetUserId: UUID;
  /** Email del usuario objetivo */
  targetUserEmail: string;
  /** Timestamp del evento */
  timestamp: Date;
  /** IP desde donde se realizó la acción */
  ipAddress: string;
  /** User agent del navegador */
  userAgent: string;
  /** Duración de la sesión (solo para eventos de finalización) */
  sessionDuration?: number; // en minutos
  /** Razón proporcionada */
  reason?: string;
  /** Datos adicionales para auditoría */
  metadata?: {
    [key: string]: any;
  };
}