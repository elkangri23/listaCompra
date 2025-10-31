import { Hash } from '../../../../src/domain/value-objects/Hash';
import { InvalidValueError } from '../../../../src/domain/errors/DomainError';

describe('Hash Value Object', () => {
  describe('create', () => {
    it('debería crear un hash válido', () => {
      const validHash = 'abcd1234567890abcdef1234567890abcdef1234567890abcdef';
      const result = Hash.create(validHash);

      expect(result.isSuccess).toBe(true);
      if (result.isSuccess) {
        expect(result.value.toString()).toBe(validHash);
      }
    });

    it('debería fallar con hash vacío', () => {
      const result = Hash.create('');

      expect(result.isSuccess).toBe(false);
      if (!result.isSuccess) {
        expect(result.error).toBeInstanceOf(InvalidValueError);
        expect(result.error.message).toContain('Hash no puede estar vacío');
      }
    });

    it('debería fallar con hash null', () => {
      const result = Hash.create(null as any);

      expect(result.isSuccess).toBe(false);
      if (!result.isSuccess) {
        expect(result.error).toBeInstanceOf(InvalidValueError);
      }
    });

    it('debería fallar con hash undefined', () => {
      const result = Hash.create(undefined as any);

      expect(result.isSuccess).toBe(false);
      if (!result.isSuccess) {
        expect(result.error).toBeInstanceOf(InvalidValueError);
      }
    });

    it('debería fallar con caracteres no alfanuméricos', () => {
      const invalidHash = 'abc123-def456_ghi789!';
      const result = Hash.create(invalidHash);

      expect(result.isSuccess).toBe(false);
      if (!result.isSuccess) {
        expect(result.error.message).toContain('caracteres alfanuméricos');
      }
    });

    it('debería fallar con hash demasiado corto', () => {
      const shortHash = 'abc123'; // menos de 32 caracteres
      const result = Hash.create(shortHash);

      expect(result.isSuccess).toBe(false);
      if (!result.isSuccess) {
        expect(result.error.message).toContain('entre 32 y 128 caracteres');
      }
    });

    it('debería fallar con hash demasiado largo', () => {
      const longHash = 'a'.repeat(129); // más de 128 caracteres
      const result = Hash.create(longHash);

      expect(result.isSuccess).toBe(false);
      if (!result.isSuccess) {
        expect(result.error.message).toContain('entre 32 y 128 caracteres');
      }
    });

    it('debería aceptar hash en el límite mínimo (32 caracteres)', () => {
      const minHash = 'a'.repeat(32);
      const result = Hash.create(minHash);

      expect(result.isSuccess).toBe(true);
    });

    it('debería aceptar hash en el límite máximo (128 caracteres)', () => {
      const maxHash = 'a'.repeat(128);
      const result = Hash.create(maxHash);

      expect(result.isSuccess).toBe(true);
    });

    it('debería manejar números en el hash', () => {
      const numericHash = '1234567890123456789012345678901234567890';
      const result = Hash.create(numericHash);

      expect(result.isSuccess).toBe(true);
    });

    it('debería manejar mayúsculas y minúsculas', () => {
      const mixedCaseHash = 'AbCd1234567890AbCdEf1234567890AbCdEf123456';
      const result = Hash.create(mixedCaseHash);

      expect(result.isSuccess).toBe(true);
    });
  });

  describe('equals', () => {
    it('debería devolver true para hashes iguales', () => {
      const hashValue = 'abcd1234567890abcdef1234567890abcdef';
      const hash1 = Hash.create(hashValue);
      const hash2 = Hash.create(hashValue);

      if (hash1.isSuccess && hash2.isSuccess) {
        expect(hash1.value.equals(hash2.value)).toBe(true);
      } else {
        fail('Hash creation should have succeeded');
      }
    });

    it('debería devolver false para hashes diferentes', () => {
      const hash1 = Hash.create('abcd1234567890abcdef1234567890abcdef');
      const hash2 = Hash.create('1234567890abcdef1234567890abcdef1234');

      if (hash1.isSuccess && hash2.isSuccess) {
        expect(hash1.value.equals(hash2.value)).toBe(false);
      } else {
        fail('Hash creation should have succeeded');
      }
    });
  });

  describe('toString', () => {
    it('debería devolver el valor del hash', () => {
      const hashValue = 'abcd1234567890abcdef1234567890abcdef';
      const result = Hash.create(hashValue);

      if (result.isSuccess) {
        expect(result.value.toString()).toBe(hashValue);
      } else {
        fail('Hash creation should have succeeded');
      }
    });
  });

  describe('toMasked', () => {
    it('debería enmascarar hashes largos', () => {
      const hashValue = 'abcd1234567890abcdef1234567890abcdef';
      const result = Hash.create(hashValue);

      if (result.isSuccess) {
        const masked = result.value.toMasked();
        expect(masked).toBe('abcd...cdef');
      } else {
        fail('Hash creation should have succeeded');
      }
    });

    it('debería enmascarar hashes cortos', () => {
      const hashValue = '12345678901234567890123456789012'; // 32 chars
      const result = Hash.create(hashValue);

      if (result.isSuccess) {
        const masked = result.value.toMasked();
        expect(masked).toBe('1234...9012');
      } else {
        fail('Hash creation should have succeeded');
      }
    });
  });

  describe('getLikelyAlgorithm', () => {
    it('debería identificar MD5 (32 caracteres)', () => {
      const md5Hash = '1234567890123456789012345678901234567890'.substring(0, 32);
      const result = Hash.create(md5Hash);

      if (result.isSuccess) {
        expect(result.value.getLikelyAlgorithm()).toBe('MD5');
      } else {
        fail('Hash creation should have succeeded');
      }
    });

    it('debería identificar SHA-256 (64 caracteres)', () => {
      const sha256Hash = '1234567890123456789012345678901234567890123456789012345678901234';
      const result = Hash.create(sha256Hash);

      if (result.isSuccess) {
        expect(result.value.getLikelyAlgorithm()).toBe('SHA-256');
      } else {
        fail('Hash creation should have succeeded');
      }
    });

    it('debería devolver Unknown para longitudes no estándar', () => {
      const customHash = '123456789012345678901234567890123456'; // 36 chars
      const result = Hash.create(customHash);

      if (result.isSuccess) {
        expect(result.value.getLikelyAlgorithm()).toBe('Unknown');
      } else {
        fail('Hash creation should have succeeded');
      }
    });
  });
});