/**
 * Tests unitarios para las utilidades criptográficas de verificación de email (item 3)
 */

import {
  generateVerificationCode,
  normalizeVerificationCode,
  hmacVerificationCode,
  safeCompareHmac,
} from '../../../../src/infrastructure/security/email-verification-crypto';

describe('email-verification-crypto', () => {
  describe('generateVerificationCode', () => {
    it('genera un código de 6 dígitos', () => {
      const code = generateVerificationCode();
      expect(code).toMatch(/^\d{6}$/);
      expect(Number(code)).toBeGreaterThanOrEqual(100000);
      expect(Number(code)).toBeLessThanOrEqual(999999);
    });
  });

  describe('normalizeVerificationCode', () => {
    it('acepta 6 dígitos tal cual', () => {
      expect(normalizeVerificationCode('482913')).toBe('482913');
    });

    it('quita espacios y guiones', () => {
      expect(normalizeVerificationCode('482 913')).toBe('482913');
      expect(normalizeVerificationCode('482-913')).toBe('482913');
    });

    it('rechaza lo que no son 6 dígitos', () => {
      expect(normalizeVerificationCode('12345')).toBe('');
      expect(normalizeVerificationCode('1234567')).toBe('');
      expect(normalizeVerificationCode('abcdef')).toBe('');
      expect(normalizeVerificationCode('')).toBe('');
      expect(normalizeVerificationCode('48a913')).toBe('');
    });
  });

  describe('hmacVerificationCode', () => {
    it('es determinista para el mismo código', () => {
      expect(hmacVerificationCode('482913')).toBe(hmacVerificationCode('482913'));
    });

    it('cambia con el código', () => {
      expect(hmacVerificationCode('482913')).not.toBe(hmacVerificationCode('482914'));
    });

    it('cambia con JWT_SECRET', () => {
      const original = process.env['JWT_SECRET'];
      const hashA = hmacVerificationCode('482913');
      process.env['JWT_SECRET'] = 'otro-secreto-de-prueba-diferente-1234567890';
      const hashB = hmacVerificationCode('482913');
      process.env['JWT_SECRET'] = original;
      expect(hashA).not.toBe(hashB);
    });
  });

  describe('safeCompareHmac', () => {
    it('true para hashes iguales', () => {
      const hash = hmacVerificationCode('482913');
      expect(safeCompareHmac(hash, hash)).toBe(true);
    });

    it('false para hashes distintos o de distinta longitud', () => {
      expect(safeCompareHmac(hmacVerificationCode('482913'), hmacVerificationCode('482914'))).toBe(false);
      expect(safeCompareHmac('abc', 'abcdef')).toBe(false);
      expect(safeCompareHmac('', '')).toBe(false);
    });
  });
});
