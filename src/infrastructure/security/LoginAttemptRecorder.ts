/**
 * Registro best-effort de intentos de inicio de sesión.
 * Envuelve el repositorio con try/catch + log: NUNCA propaga errores,
 * para que un fallo de telemetría no rompa el login (mismo patrón que
 * AIUsageRecorder, fase 3). NUNCA registra contraseñas, códigos ni tokens.
 */

import type { ILoginAttemptRecorder } from '../../application/ports/external/ILoginAttemptRecorder';
import type { LoginAttemptInput } from '../../application/ports/external/ILoginAttemptRecorder';
import type { ILoginAttemptRepository } from '../../application/ports/repositories/ILoginAttemptRepository';
import { Logger } from '../observability/logger/Logger';

export class LoginAttemptRecorder implements ILoginAttemptRecorder {
  private readonly logger = new Logger('LoginAttemptRecorder');

  constructor(private readonly repository: ILoginAttemptRepository) {}

  async record(input: LoginAttemptInput): Promise<void> {
    try {
      await this.repository.save({
        email: input.email.trim().toLowerCase(),
        success: input.success,
        reason: input.reason ?? null,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      });
    } catch (error) {
      // Best-effort: la telemetría nunca rompe el login.
      this.logger.warn('No se pudo registrar el intento de inicio de sesión', {
        email: input.email,
        success: input.success,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
