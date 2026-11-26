/**
 * Utilidades criptográficas para MFA (TOTP)
 * - Cifrado AES-256-GCM del secreto TOTP en reposo (clave: MFA_ENCRYPTION_KEY)
 * - HMAC-SHA256 de códigos de respaldo (sub-clave HKDF derivada de la maestra)
 * - Normalización y comparación timing-safe de códigos
 */

import * as crypto from 'crypto';
import { MfaCryptoError } from '@domain/errors/MfaError';

const PAYLOAD_VERSION = 'v1';

function loadMasterKey(): Buffer {
  const raw = process.env['MFA_ENCRYPTION_KEY'];
  if (!raw) {
    throw new MfaCryptoError(
      'MFA_ENCRYPTION_KEY no está configurada. No se pueden usar las funciones MFA.'
    );
  }
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new MfaCryptoError(
      'MFA_ENCRYPTION_KEY debe ser una clave base64 de 32 bytes (AES-256).'
    );
  }
  return key;
}

/** Sub-clave HKDF para HMAC de backup codes (separación de usos de la clave maestra) */
function deriveBackupKey(): Buffer {
  const master = loadMasterKey();
  const derived = crypto.hkdfSync('sha256', master, Buffer.alloc(0), Buffer.from('backup-codes'), 32);
  return Buffer.from(derived);
}

/**
 * Cifra un secreto TOTP: "v1:<b64(ciphertext)>:<b64(iv)>:<b64(tag)>"
 * El prefijo de versión permite rotación futura de clave.
 */
export function encryptSecret(plain: string): string {
  const key = loadMasterKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [PAYLOAD_VERSION, ciphertext.toString('base64'), iv.toString('base64'), tag.toString('base64')].join(':');
}

/**
 * Descifra un payload producido por encryptSecret. Lanza MfaCryptoError si
 * la clave es incorrecta o el payload está corrupto.
 */
export function decryptSecret(payload: string): string {
  const parts = payload.split(':');
  if (parts.length !== 4 || parts[0] !== PAYLOAD_VERSION) {
    throw new MfaCryptoError('Payload TOTP corrupto o con versión desconocida.');
  }
  const [, ciphertextB64, ivB64, tagB64] = parts;
  if (!ciphertextB64 || !ivB64 || !tagB64) {
    throw new MfaCryptoError('Payload TOTP corrupto o con versión desconocida.');
  }
  let key: Buffer;
  try {
    key = loadMasterKey();
  } catch {
    throw new MfaCryptoError();
  }
  try {
    const ciphertext = Buffer.from(ciphertextB64, 'base64');
    const iv = Buffer.from(ivB64, 'base64');
    const tag = Buffer.from(tagB64, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  } catch {
    // Clave incorrecta / payload manipulado — nunca detalles internos al cliente
    throw new MfaCryptoError();
  }
}

/** Normaliza un código de respaldo: uppercase, sin guiones/espacios; rechaza lookalikes I/L/O/U */
export function normalizeBackupCode(raw: string): string {
  const normalized = raw.toUpperCase().replace(/[\s-]/g, '');
  if (!normalized || !/^[A-Z0-9]+$/.test(normalized) || /[ILOU]/.test(normalized)) {
    return '';
  }
  return normalized;
}

/** HMAC-SHA256(normalized, subClave HKDF) en base64 — comparación O(1), sin slow-hash */
export function hmacBackupCode(normalized: string): string {
  const key = deriveBackupKey();
  return crypto.createHmac('sha256', key).update(normalized, 'utf8').digest('base64');
}

/** Comparación timing-safe de dos HMACs base64 */
export function safeCompareHmac(aB64: string, bB64: string): boolean {
  if (!aB64 || !bB64 || aB64.length !== bB64.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(aB64, 'base64'), Buffer.from(bB64, 'base64'));
  } catch {
    return false;
  }
}

/**
 * Genera N códigos de respaldo de 8 chars del alfabeto Crockford base32
 * (0123456789ABCDEFGHJKMNPQRSTVWXYZ — sin I/L/O/U), formato "XXXX-YYYY".
 */
export function generateBackupCodes(count: number = 10): string[] {
  const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    let half = '';
    for (let c = 0; c < 8; c++) {
      half += ALPHABET[crypto.randomInt(ALPHABET.length)];
    }
    codes.push(`${half.slice(0, 4)}-${half.slice(4)}`);
  }
  return codes;
}
