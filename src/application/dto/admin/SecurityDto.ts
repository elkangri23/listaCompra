/**
 * DTOs del panel de administración, pestaña Seguridad (fase 5).
 */

import type { LoginAttemptReason } from '@application/ports/repositories/ILoginAttemptRepository';

// ============================================================================
// Overview: GET /admin/security/overview
// ============================================================================

export interface GracePeriodAccountDto {
  email: string;
  /** Fecha ISO en la que se solicitó la eliminación. */
  eliminacionSolicitadaEn: string;
  /** Días que quedan hasta la eliminación definitiva (30 días de gracia). */
  daysLeft: number;
}

export interface SecurityOverviewDto {
  /** Cuentas con 2FA sobre el total; null si no se pudo calcular. */
  twoFactor: { enabled: number; total: number } | null;
  /** Intentos fallidos en las últimas 24 h; null si no se pudo calcular. */
  failedLoginsLast24h: number | null;
  /** Turnstile está activo solo si TURNSTILE_SECRET_KEY está configurada. */
  turnstile: { enabled: boolean };
  /** Cuentas en periodo de gracia GDPR; null si no se pudo calcular. */
  gracePeriod: { count: number; accounts: GracePeriodAccountDto[] } | null;
  /**
   * Motivos por sección cuando un dato no se pudo calcular (nunca se
   * inventa un valor: la sección llega como null y el motivo aquí).
   */
  unavailable: {
    twoFactor?: string;
    failedLogins?: string;
    gracePeriod?: string;
  };
}

// ============================================================================
// Login attempts: GET /admin/security/login-attempts
// ============================================================================

export interface LoginAttemptDto {
  id: string;
  email: string;
  success: boolean;
  reason: LoginAttemptReason | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface GetLoginAttemptsQueryDto {
  email?: string | undefined;
  success?: boolean | undefined;
  startDate?: Date | undefined;
  endDate?: Date | undefined;
  page?: number;
  pageSize?: number;
}

export interface GetLoginAttemptsResponseDto {
  attempts: LoginAttemptDto[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ============================================================================
// Alerts: GET /admin/security/alerts
// ============================================================================

export type SecurityAlertType =
  | 'BRUTE_FORCE_EMAIL'
  | 'ADMIN_WITHOUT_2FA'
  | 'GRACE_PERIOD_ENDING';

export type SecurityAlertSeverity = 'high' | 'medium' | 'low';

export interface SecurityAlertDto {
  id: string;
  type: SecurityAlertType;
  severity: SecurityAlertSeverity;
  message: string;
  /** Cuándo se originó el hecho que genera la alerta. */
  createdAt: string;
  relatedEmail?: string;
}

export interface GetSecurityAlertsResponseDto {
  alerts: SecurityAlertDto[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
