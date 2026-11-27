/**
 * Tests unitarios para las utilidades criptográficas de restablecimiento de contraseña (item 9c)
 */

import {
  generateResetCode,
  normalizeResetCode,
  hmacResetCode,
  safeCompareHmac,
} from '../../../../src/infrastructure/security/password-reset-crypto';

describe('password-reset-crypto', () => {
  describe('generateResetCode', () => {
    it('genera un código de 6 dígitos', () => {
      const code = generateResetCode();
      expect(code).toMatch(/^\d{6}$/);
      expect(Number(code)).toBeGreaterThanOrEqual(100000);
      expect(Number(code)).toBeLessThanOrEqual(999999);
    });
  });

  describe('normalizeResetCode', () => {
    it('acepta 6 dígitos tal cual', () => {
      expect(normalizeResetCode('482913')).toBe('482913');
    });

    it('quita espacios y guiones', () => {
      expect(normalizeResetCode('482 913')).toBe('482913');
      expect(normalizeResetCode('482-913')).toBe('482913');
    });

    it('rechaza lo que no son 6 dígitos', () => {
      expect(normalizeResetCode('12345')).toBe('');
      expect(normalizeResetCode('1234567')).toBe('');
      expect(normalizeResetCode('abcdef')).toBe('');
      expect(normalizeResetCode('')).toBe('');
      expect(normalizeResetCode('48a913')).toBe('');
    });
  });

  describe('hmacResetCode', () => {
    it('es determinista para el mismo código', () => {
      expect(hmacResetCode('482913')).toBe(hmacResetCode('482913'));
    });

    it('cambia con el código', () => {
      expect(hmacResetCode('482913')).not.toBe(hmacResetCode('482914'));
    });

    it('cambia con JWT_SECRET', () => {
      const original = process.env['JWT_SECRET'];
      const hashA = hmacResetCode('482913');
      process.env['JWT_SECRET'] = 'otro-secreto-de-prueba-diferente-1234567890';
      const hashB = hmacResetCode('482913');
      process.env['JWT_SECRET'] = original;
      expect(hashA).not.toBe(hashB);
    });
  });

  describe('safeCompareHmac', () => {
    it('true para hashes iguales', () => {
      const hash = hmacResetCode('482913');
      expect(safeCompareHmac(hash, hash)).toBe(true);
    });

    it('false para hashes distintos o de distinta longitud', () => {
      expect(safeCompareHmac(hmacResetCode('482913'), hmacResetCode('482914'))).toBe(false);
      expect(safeCompareHmac('abc', 'abcdef')).toBe(false);
      expect(safeCompareHmac('', '')).toBe(false);
    });
  });
});
