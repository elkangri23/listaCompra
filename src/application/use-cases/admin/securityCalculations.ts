/**
 * Cálculo puro de las alertas de seguridad del panel admin (fase 5).
 *
 * Qué genera una alerta (umbrales razonables, documentados aquí):
 *
 * 1. BRUTE_FORCE_EMAIL (alta): más de BRUTE_FORCE_THRESHOLD intentos
 *    fallidos para el mismo email dentro de BRUTE_FORCE_WINDOW_HOURS.
 *    Es la señal de un ataque de fuerza bruta o de credenciales
 *    comprometidas en pruebas. El limitador de auth (5 intentos / 15 min
 *    por IP) no deja consultar su estado por cuenta, así que esta alerta
 *    es la forma de verlo por email.
 * 2. ADMIN_WITHOUT_2FA (media): un usuario con rol ADMIN sin TOTP
 *    activado. Un admin sin segundo factor es el mayor riesgo de la
 *    aplicación con un solo usuario administrador.
 * 3. GRACE_PERIOD_ENDING (media): una cuenta en periodo de gracia GDPR
 *    (30 días desde eliminacionSolicitadaEn) a la que le quedan menos de
 *    GRACE_PERIOD_WARNING_DAYS días para su eliminación definitiva
 *    (incluye el caso vencido: la purga diaria debería haberla borrado).
 *
 * Sin datos que cumplan las condiciones, la lista es vacía: NUNCA se
 * inventan alertas.
 */

import type { Usuario } from '@domain/entities/Usuario';
import type { LoginAttempt } from '@application/ports/repositories/ILoginAttemptRepository';
import type { SecurityAlertDto } from '@application/dto/admin/SecurityDto';
import { DIAS_GRACIA_ELIMINACION } from '@application/use-cases/gdpr/RequestAccountDeletion';

export const BRUTE_FORCE_THRESHOLD = 5;
export const BRUTE_FORCE_WINDOW_HOURS = 1;
export const GRACE_PERIOD_WARNING_DAYS = 7;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Días (redondeados hacia arriba) hasta la eliminación definitiva. */
export function daysLeftUntilDeletion(
  eliminacionSolicitadaEn: Date,
  now: Date
): number {
  const deadline =
    eliminacionSolicitadaEn.getTime() + DIAS_GRACIA_ELIMINACION * MS_PER_DAY;
  return Math.ceil((deadline - now.getTime()) / MS_PER_DAY);
}

export interface SecurityAlertInputs {
  /** Intentos fallidos dentro de la ventana (ya filtrados por fecha). */
  failedAttempts: LoginAttempt[];
  /** Administradores sin TOTP activado. */
  adminsWithoutTotp: Usuario[];
  /** Cuentas con eliminacionSolicitadaEn no nula. */
  graceAccounts: Usuario[];
  now: Date;
}

export function computeSecurityAlerts(inputs: SecurityAlertInputs): SecurityAlertDto[] {
  const { failedAttempts, adminsWithoutTotp, graceAccounts, now } = inputs;
  const alerts: SecurityAlertDto[] = [];

  // 1. Fuerza bruta por email.
  const byEmail = new Map<string, LoginAttempt[]>();
  for (const attempt of failedAttempts) {
    const list = byEmail.get(attempt.email) ?? [];
    list.push(attempt);
    byEmail.set(attempt.email, list);
  }
  for (const [email, attempts] of byEmail) {
    if (attempts.length > BRUTE_FORCE_THRESHOLD) {
      const latest = attempts.reduce((a, b) =>
        a.createdAt.getTime() >= b.createdAt.getTime() ? a : b
      );
      alerts.push({
        id: `brute-force:${email}`,
        type: 'BRUTE_FORCE_EMAIL',
        severity: 'high',
        message: `${attempts.length} intentos fallidos de inicio de sesión en la última hora para ${email}`,
        createdAt: latest.createdAt.toISOString(),
        relatedEmail: email,
      });
    }
  }

  // 2. Administradores sin 2FA.
  for (const admin of adminsWithoutTotp) {
    alerts.push({
      id: `admin-without-2fa:${admin.id}`,
      type: 'ADMIN_WITHOUT_2FA',
      severity: 'medium',
      message: `El administrador ${admin.email.value} no tiene activada la autenticación en dos pasos`,
      createdAt: now.toISOString(),
      relatedEmail: admin.email.value,
    });
  }

  // 3. Periodo de gracia a punto de vencer.
  for (const account of graceAccounts) {
    if (!account.eliminacionSolicitadaEn) {
      continue;
    }
    const daysLeft = daysLeftUntilDeletion(account.eliminacionSolicitadaEn, now);
    if (daysLeft < GRACE_PERIOD_WARNING_DAYS) {
      alerts.push({
        id: `grace-period-ending:${account.id}`,
        type: 'GRACE_PERIOD_ENDING',
        severity: 'medium',
        message:
          daysLeft >= 0
            ? `La cuenta ${account.email.value} se eliminará definitivamente en ${daysLeft} ${daysLeft === 1 ? 'día' : 'días'}`
            : `El plazo de gracia de ${account.email.value} venció hace ${-daysLeft} ${-daysLeft === 1 ? 'día' : 'días'} y la cuenta sigue activa`,
        createdAt: account.eliminacionSolicitadaEn.toISOString(),
        relatedEmail: account.email.value,
      });
    }
  }

  // Alta severidad primero; dentro de cada severidad, lo más reciente.
  const severityRank = { high: 0, medium: 1, low: 2 };
  return alerts.sort(
    (a, b) =>
      severityRank[a.severity] - severityRank[b.severity] ||
      b.createdAt.localeCompare(a.createdAt)
  );
}
