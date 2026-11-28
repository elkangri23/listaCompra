/**
 * Intento de inicio de sesión persistido (fila de `login_attempts`).
 *
 * Telemetría de seguridad, sin FK a usuarios: un intento puede ser de un
 * email inexistente, y no debe interferir con la cascada GDPR de borrado
 * de cuenta (igual que `ai_usage_events`). NUNCA se guardan contraseñas,
 * códigos ni tokens.
 */

export type LoginAttemptReason =
  | 'WRONG_PASSWORD'
  | 'USER_NOT_FOUND'
  | 'UNVERIFIED_EMAIL'
  | 'INACTIVE_ACCOUNT'
  | 'MFA_FAILED';

export interface LoginAttempt {
  id: string;
  /** Email normalizado en minúsculas. */
  email: string;
  success: boolean;
  /** Motivo real del fallo; null cuando success es true. */
  reason: LoginAttemptReason | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}

export type NewLoginAttempt = Omit<LoginAttempt, 'id' | 'createdAt'>;

export interface LoginAttemptFilters {
  email?: string;
  success?: boolean;
  startDate?: Date;
  endDate?: Date;
}

export interface PaginatedLoginAttempts {
  attempts: LoginAttempt[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ILoginAttemptRepository {
  save(attempt: NewLoginAttempt): Promise<LoginAttempt>;
  findMany(
    filters: LoginAttemptFilters,
    page: number,
    pageSize: number
  ): Promise<PaginatedLoginAttempts>;
  /** Intentos fallidos desde una fecha (para alertas de fuerza bruta). */
  findFailedSince(since: Date): Promise<LoginAttempt[]>;
  /** Intentos correctos desde una fecha (para actividad diaria del panel admin). */
  findSuccessfulSince(since: Date): Promise<LoginAttempt[]>;
  /** Nº de intentos fallidos desde una fecha (para el overview). */
  countFailedSince(since: Date): Promise<number>;
}
