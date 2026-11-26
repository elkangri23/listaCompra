/**
 * Tests unitarios de mfa-crypto (fase MFA TOTP)
 * Vectores RFC 6238 + reglas de normalización/timing-safe
 */

import * as crypto from 'crypto';
import {
  encryptSecret,
  decryptSecret,
  normalizeBackupCode,
  hmacBackupCode,
  safeCompareHmac,
  generateBackupCodes,
} from '@infrastructure/security/mfa-crypto';
import { MfaCryptoError } from '@domain/errors/MfaError';

// Clave base64 de 32 bytes estable para los vectores
const TEST_KEY = Buffer.alloc(32, 7).toString('base64');

beforeAll(() => {
  process.env['MFA_ENCRYPTION_KEY'] = TEST_KEY;
});

describe('mfa-crypto — cifrado AES-256-GCM', () => {
  it('cifra y descifra round-trip', () => {
    const secret = 'JBSWY3DPEHPK3PXP';
    const payload = encryptSecret(secret);
    expect(payload.startsWith('v1:')).toBe(true);
    expect(payload).not.toContain(secret); // nunca en claro
    expect(decryptSecret(payload)).toBe(secret);
  });

  it('produce ciphertext distinto con el mismo plaintext (IV aleatorio)', () => {
    const a = encryptSecret('same-secret');
    const b = encryptSecret('same-secret');
    expect(a).not.toBe(b);
    expect(decryptSecret(a)).toBe('same-secret');
    expect(decryptSecret(b)).toBe('same-secret');
  });

  it('falla si el payload está manipulado (auth tag GCM)', () => {
    const payload = encryptSecret('secret');
    const parts = payload.split(':');
    if (!parts[1] || !parts[2] || !parts[3]) throw new Error('formato inesperado');
    const tampered = Buffer.from(parts[1], 'base64');
    tampered.set([tampered[0]! ^ 0xff], 0);
    const corrupted = [parts[0], tampered.toString('base64'), parts[2], parts[3]].join(':');
    expect(() => decryptSecret(corrupted)).toThrow(MfaCryptoError);
  });

  it('rechaza payload sin prefijo v1 o con longitud inválida', () => {
    expect(() => decryptSecret('v2:AAAA:BBBB:CCCC')).toThrow(MfaCryptoError);
    expect(() => decryptSecret('v1:AAAA')).toThrow(MfaCryptoError);
    expect(() => decryptSecret('')).toThrow(MfaCryptoError);
  });
});

describe('totp (RFC 6238) — vectores oficiales', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { totpCodeAt, verifyTotpCode } = require('@infrastructure/security/totp');
  // Secreto RFC 6238: "12345678901234567890" ASCII → base32
  const RFC_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'; // "12345678901234567890" ASCII (20 bytes)

  it('vector T=59 → 8 dígitos = 94287082', () => {
    expect(totpCodeAt(RFC_SECRET, 59, 30, 8)).toBe('94287082');
  });

  it('vector T=59 → 6 dígitos = 287082; T=1111111109 → 081804 (6 dígitos de 07081804)', () => {
    expect(totpCodeAt(RFC_SECRET, 59, 30, 6)).toBe('287082');
    // T=1111111109 → 8 dígitos = 07081804 → 6 dígitos = 708180
    expect(totpCodeAt(RFC_SECRET, 1111111109, 30, 8)).toBe('07081804');
    // 6 dígitos = valor mod 10^6
    expect(totpCodeAt(RFC_SECRET, 1111111109, 30, 6)).toBe('081804');
  });

  it('verifica el código en epoch y con tolerancia ±1 período (31s)', () => {
    const token = totpCodeAt(RFC_SECRET, 1000, 30, 6);
    expect(verifyTotpCode(RFC_SECRET, token, { epoch: 1000 })).toBe(true);
    expect(verifyTotpCode(RFC_SECRET, token, { epoch: 1030 })).toBe(true); // step siguiente
    expect(verifyTotpCode(RFC_SECRET, token, { epoch: 970 })).toBe(true); // step anterior
    expect(verifyTotpCode(RFC_SECRET, token, { epoch: 1061 })).toBe(false); // fuera de ventana
  });

  it('rechaza tokens malformados', () => {
    expect(verifyTotpCode(RFC_SECRET, '12345', { epoch: 59 })).toBe(false);
    expect(verifyTotpCode(RFC_SECRET, 'abcdef', { epoch: 59 })).toBe(false);
    expect(verifyTotpCode(RFC_SECRET, '', { epoch: 59 })).toBe(false);
  });
});

describe('mfa-crypto — códigos de respaldo', () => {
  it('normaliza: uppercase, sin guiones/espacios', () => {
    expect(normalizeBackupCode('a3f9-k2m7')).toBe('A3F9K2M7');
    expect(normalizeBackupCode(' a3f9 k2m7 ')).toBe('A3F9K2M7');
  });

  it('rechaza lookalikes I/L/O/U y caracteres inválidos', () => {
    expect(normalizeBackupCode('AI3F-K2M7')).toBe('');
    expect(normalizeBackupCode('A3F9-K2LO')).toBe('');
    expect(normalizeBackupCode('A3F9-K2M!')).toBe('');
    expect(normalizeBackupCode('')).toBe('');
  });

  it('genera 10 códigos con formato XXXX-YYYY del alfabeto Crockford', () => {
    const codes = generateBackupCodes(10);
    expect(codes).toHaveLength(10);
    for (const code of codes) {
      expect(code).toMatch(/^[0-9A-HJ-NP-TV-Z]{4}-[0-9A-HJ-NP-TV-Z]{4}$/);
    }
    // únicos
    expect(new Set(codes).size).toBe(10);
  });

  it('HMAC es determinista y timing-safe en comparación', () => {
    const h1 = hmacBackupCode('A3F9K2M7');
    const h2 = hmacBackupCode('A3F9K2M7');
    expect(h1).toBe(h2);
    expect(safeCompareHmac(h1, h2)).toBe(true);
    expect(safeCompareHmac(h1, hmacBackupCode('B4G0L3N8'))).toBe(false);
    expect(safeCompareHmac(h1, '')).toBe(false);
    expect(safeCompareHmac(h1, 'AAAA')).toBe(false);
  });

  it('la clave HMAC es una sub-clave HKDF: distinta del HMAC con la maestra', () => {
    const masterHmac = crypto.createHmac('sha256', Buffer.from(TEST_KEY, 'base64')).update('A3F9K2M7').digest('base64');
    const derivedHmac = hmacBackupCode('A3F9K2M7');
    expect(masterHmac).not.toBe(derivedHmac);
  });
});
