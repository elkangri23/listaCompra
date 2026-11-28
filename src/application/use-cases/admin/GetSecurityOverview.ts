/**
 * Caso de uso: resumen de seguridad para el panel de administración
 * (fase 5). Datos REALES: cuentas con 2FA, intentos fallidos en 24 h,
 * estado de Turnstile y cuentas en periodo de gracia GDPR.
 *
 * Si un dato no se puede calcular (fallo de repositorio), esa sección
 * llega como null y el motivo queda en `unavailable`: NUNCA se inventa
 * un valor.
 */

import type { ILoginAttemptRepository } from '@application/ports/repositories/ILoginAttemptRepository';
import type { IUsuarioRepository } from '@application/ports/repositories/IUsuarioRepository';
import type { ITurnstileVerifier } from '@application/ports/auth/ITurnstileVerifier';
import type { SecurityOverviewDto } from '@application/dto/admin/SecurityDto';
import { Logger } from '@infrastructure/observability/logger/Logger';
import { daysLeftUntilDeletion } from '@application/use-cases/admin/securityCalculations';

const logger = new Logger('GetSecurityOverview');

const HOURS_24_MS = 24 * 60 * 60 * 1000;

export class GetSecurityOverview {
  constructor(
    private readonly loginAttemptRepository: ILoginAttemptRepository,
    private readonly usuarioRepository: IUsuarioRepository,
    private readonly turnstileVerifier: ITurnstileVerifier
  ) {}

  async execute(): Promise<SecurityOverviewDto> {
    const now = new Date();
    const unavailable: SecurityOverviewDto['unavailable'] = {};

    // 2FA: cuentas con TOTP activado sobre el total de usuarios.
    let twoFactor: SecurityOverviewDto['twoFactor'] = null;
    try {
      const [enabledResult, totalResult] = await Promise.all([
        this.usuarioRepository.countTotpEnabled(),
        this.usuarioRepository.count(),
      ]);
      if (enabledResult.isFailure) {
        throw enabledResult.error;
      }
      if (totalResult.isFailure) {
        throw totalResult.error;
      }
      twoFactor = { enabled: enabledResult.value, total: totalResult.value };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      logger.error('No se pudo calcular el resumen de 2FA', { error: reason });
      unavailable.twoFactor = reason;
    }

    // Intentos fallidos en las últimas 24 h.
    let failedLoginsLast24h: number | null = null;
    try {
      failedLoginsLast24h = await this.loginAttemptRepository.countFailedSince(
        new Date(now.getTime() - HOURS_24_MS)
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      logger.error('No se pudieron contar los intentos fallidos', { error: reason });
      unavailable.failedLogins = reason;
    }

    // Turnstile: activo solo si hay clave secreta configurada. La clave
    // NUNCA sale de aquí (solo el booleano).
    const turnstile = { enabled: this.turnstileVerifier.enabled() };

    // Periodo de gracia: cuentas con eliminacionSolicitadaEn.
    let gracePeriod: SecurityOverviewDto['gracePeriod'] = null;
    try {
      const graceResult = await this.usuarioRepository.findGracePeriodAccounts();
      if (graceResult.isFailure) {
        throw graceResult.error;
      }
      gracePeriod = {
        count: graceResult.value.length,
        accounts: graceResult.value
          .filter((u) => u.eliminacionSolicitadaEn !== null)
          .map((u) => ({
            email: u.email.value,
            eliminacionSolicitadaEn: (u.eliminacionSolicitadaEn as Date).toISOString(),
            daysLeft: daysLeftUntilDeletion(u.eliminacionSolicitadaEn as Date, now),
          })),
      };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      logger.error('No se pudieron listar las cuentas en periodo de gracia', {
        error: reason,
      });
      unavailable.gracePeriod = reason;
    }

    return {
      twoFactor,
      failedLoginsLast24h,
      turnstile,
      gracePeriod,
      unavailable,
    };
  }
}
