/**
 * Utilidades criptográficas para la verificación de email por código (item 3)
 * - Código de 6 dígitos generado con crypto.randomInt
 * - Solo se guarda el HMAC-SHA256 del código (sub-clave HKDF derivada de
 *   JWT_SECRET, separada de la de firma de tokens y de la de MFA)
 * - Normalización y comparación timing-safe (reutiliza safeCompareHmac)
 */

import * as crypto from 'crypto';
import { safeCompareHmac } from './mfa-crypto';

export { safeCompareHmac };

/** Sub-clave HKDF para HMAC de códigos de verificación (separación de usos) */
function deriveVerificationKey(): Buffer {
  const raw = process.env['JWT_SECRET'];
  if (!raw) {
    throw new Error('JWT_SECRET no está configurada. No se pueden generar códigos de verificación.');
  }
  const master = Buffer.from(raw, 'utf8');
  const derived = crypto.hkdfSync('sha256', master, Buffer.alloc(0), Buffer.from('email-verification-codes'), 32);
  return Buffer.from(derived);
}

/** Genera un código de 6 dígitos (100000–999999) */
export function generateVerificationCode(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

/** Normaliza un código: sin espacios ni guiones; solo 6 dígitos, si no '' */
export function normalizeVerificationCode(raw: string): string {
  const normalized = raw.replace(/[\s-]/g, '');
  if (!/^\d{6}$/.test(normalized)) {
    return '';
  }
  return normalized;
}

/** HMAC-SHA256(código normalizado, sub-clave HKDF) en base64 */
export function hmacVerificationCode(normalized: string): string {
  const key = deriveVerificationKey();
  return crypto.createHmac('sha256', key).update(normalized, 'utf8').digest('base64');
}
