/**
 * Redactor de logs: reemplaza recursivamente campos sensibles por [REDACTED].
 * Todo lo que pueda contener secretos TOTP, códigos, credenciales o tokens
 * pasa por aquí antes de loguearse (spec MFA §5.4).
 */

const SENSITIVE_KEYS = new Set([
  'secret',
  'password',
  'code',
  'backupCode',
  'backupcode',
  'credential',
  'credentials',
  'token',
  'accesstoken',
  'refreshtoken',
  'otpauthurl',
  'totpsecret',
  'authorization',
]);

export type Redactable = Record<string, unknown>;

/** Devuelve una copia del objeto con los campos sensibles redactados */
export function redact<T extends Redactable>(obj: T): T {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.has(lowerKey)) {
      output[key] = '[REDACTED]';
    } else if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      output[key] = redact(value as Redactable);
    } else {
      output[key] = value;
    }
  }
  return output as T;
}
