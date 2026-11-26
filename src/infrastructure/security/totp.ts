/**
 * Implementación TOTP RFC 6238 (SHA-1, 6 dígitos, período 30s) con node:crypto.
 * Sin dependencias ESM (otplib v13 es ESM-only y no es compatible con el
 * runtime CommonJS de Jest). Verificada contra los vectores oficiales del RFC.
 */

import * as crypto from 'crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** Base32 (RFC 4648) decode — acepta mayúsculas y descarta padding/'='/espacios */
export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[\s=-]/g, '');
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx < 0) throw new Error('Base32 inválido');
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** Base32 encode sin padding (formato estándar para secrets de authenticators) */
export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return out;
}

/** Secret aleatorio de 20 bytes (160 bits) en base32 sin padding */
export function generateTotpSecret(): string {
  return base32Encode(crypto.randomBytes(20));
}

/** Genera el código TOTP de 6 dígitos para un secret y epoch (segundos) */
export function totpCodeAt(secret: string, epochSeconds: number, period: number = 30, digits: number = 6): string {
  const counter = Math.floor(epochSeconds / period);
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigUInt64BE(BigInt(counter));
  const key = base32Decode(secret);
  const hmac = crypto.createHmac('sha1', key).update(counterBuf).digest();
  // Dynamic truncation (RFC 4226 §5.4)
  const offset = (hmac[hmac.length - 1] ?? 0) & 0x0f;
  const bin =
    (((hmac[offset] ?? 0) & 0x7f) << 24) |
    (((hmac[offset + 1] ?? 0) & 0xff) << 16) |
    (((hmac[offset + 2] ?? 0) & 0xff) << 8) |
    ((hmac[offset + 3] ?? 0) & 0xff);
  return String(bin % 10 ** digits).padStart(digits, '0');
}

export interface TotpVerifyOptions {
  /** epoch en segundos (default: now) — inyectable para tests */
  epoch?: number;
  /** tolerancia en SEGUNDOS a ambos lados (default: 31 ≈ ±1 período de 30s) */
  toleranceSeconds?: number;
  period?: number;
}

/** Verifica un código con tolerancia temporal a ambos lados (semántica exacta ±toleranceSeconds) */
export function verifyTotpCode(secret: string, token: string, options: TotpVerifyOptions = {}): boolean {
  if (!/^\d{6}$/.test(token)) return false;
  const { epoch = Math.floor(Date.now() / 1000), toleranceSeconds = 31, period = 30 } = options;
  // Comprueba los 3 epochs explícitos: actual, pasado y futuro dentro de la ventana
  const epochs = new Set([epoch, epoch - toleranceSeconds, epoch + toleranceSeconds]);
  for (const e of epochs) {
    if (totpCodeAt(secret, e, period) === token) {
      return true;
    }
  }
  return false;
}

/** URL otpauth para apps autenticadoras (issuer + label + secret) */
export function buildOtpauthUrl(issuer: string, label: string, secret: string): string {
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: '6',
    period: '30',
  });
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(label)}?${params.toString()}`;
}
