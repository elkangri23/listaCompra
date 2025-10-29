/**
 * DTO para la funcionalidad de impersonación de usuario
 */

import type { UUID } from '@shared/types';

export interface ImpersonateUserDto {
  /** ID del usuario a impersonar */
  targetUserId?: UUID;
  /** Email del usuario a impersonar (alternativo al ID) */
  targetUserEmail?: string;
  /** Razón de la impersonación (para auditoría) */
  reason?: string;
  /** Duración máxima de la impersonación en minutos (default: 60) */
  durationMinutes?: number;
}

export interface ImpersonationResponseDto {
  /** Token de impersonación */
  impersonationToken: string;
  /** Datos del usuario impersonado */
  impersonatedUser: {
    id: UUID;
    email: string;
    nombre: string;
    apellidos?: string;
  };
  /** Datos del administrador que realiza la impersonación */
  adminUser: {
    id: UUID;
    email: string;
    nombre: string;
  };
  /** Tiempo de expiración del token */
  expiresAt: Date;
  /** Timestamp de inicio de la impersonación */
  startedAt: Date;
}

export interface ImpersonationSessionDto {
  /** ID único de la sesión de impersonación */
  sessionId: UUID;
  /** ID del administrador */
  adminId: UUID;
  /** Email del administrador */
  adminEmail: string;
  /** ID del usuario impersonado */
  targetUserId: UUID;
  /** Email del usuario impersonado */
  targetUserEmail: string;
  /** Razón de la impersonación */
  reason: string;
  /** Fecha de inicio */
  startedAt: Date;
  /** Fecha de expiración */
  expiresAt: Date;
  /** Estado de la sesión */
  status: 'active' | 'expired' | 'terminated';
}