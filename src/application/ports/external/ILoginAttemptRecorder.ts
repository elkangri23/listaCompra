/**
 * Registro best-effort de intentos de inicio de sesión.
 *
 * El contrato es no romper nunca el login: `record` NUNCA propaga
 * errores (la implementación los traga con log). Los casos de uso lo
 * llaman como defensa en profundidad también envuelto en try/catch.
 */

import type { LoginAttemptReason } from '../repositories/ILoginAttemptRepository';

export interface LoginAttemptInput {
  email: string;
  success: boolean;
  reason?: LoginAttemptReason | null | undefined;
  ipAddress?: string | null | undefined;
  userAgent?: string | null | undefined;
}

export interface ILoginAttemptRecorder {
  record(input: LoginAttemptInput): Promise<void>;
}
