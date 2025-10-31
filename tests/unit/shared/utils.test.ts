import {
  generateUUID,
  isValidUUID,
  isValidEmail,
  normalizeEmail,
  calculatePagination,
  createPaginationResult,
  sanitizeString,
  capitalize,
  isValidPassword,
  delay,
  createDate,
  isValidName,
  formatError,
  pick,
  omit,
} from '@shared/utils';

describe('Shared utils', () => {
  describe('UUID utilities', () => {
    it('should generate valid UUIDs', () => {
      const uuid = generateUUID();

      expect(isValidUUID(uuid)).toBe(true);
    });

    it('should validate UUID format', () => {
      expect(isValidUUID('123e4567-e89b-12d3-a456-426614174000')).toBe(true);
      expect(isValidUUID('invalid-uuid')).toBe(false);
    });
  });

  describe('Email helpers', () => {
    it('should validate email format', () => {
      expect(isValidEmail('user@example.com')).toBe(true);
      expect(isValidEmail('invalid-email')).toBe(false);
    });

    it('should normalize emails', () => {
      expect(normalizeEmail('  USER@Example.com ')).toBe('user@example.com');
    });
  });

  describe('Pagination', () => {
    it('should calculate pagination boundaries', () => {
      expect(calculatePagination({ page: -1, limit: 500 })).toEqual({ skip: 0, take: 100 });
      expect(calculatePagination({ page: 2, limit: 10 })).toEqual({ skip: 10, take: 10 });
      expect(calculatePagination({ page: 1, limit: 0 })).toEqual({ skip: 0, take: 1 });
    });

    it('should build pagination result metadata', () => {
      const result = createPaginationResult(['item1', 'item2'], 5, { page: 1, limit: 2 });

      expect(result).toEqual({
        data: ['item1', 'item2'],
        total: 5,
        page: 1,
        limit: 2,
        totalPages: 3,
        hasNext: true,
        hasPrevious: false,
      });
    });

    it('should determine navigation flags for last page correctly', () => {
      const result = createPaginationResult(['item3', 'item4'], 4, { page: 2, limit: 2 });

      expect(result.hasNext).toBe(false);
      expect(result.hasPrevious).toBe(true);
    });
  });

  describe('String helpers', () => {
    it('should sanitize strings by trimming and collapsing spaces', () => {
      expect(sanitizeString('   hola    mundo   ')).toBe('hola mundo');
    });

    it('should capitalize strings safely', () => {
      expect(capitalize('hOLA')).toBe('Hola');
      expect(capitalize('')).toBe('');
    });
  });

  describe('Password validation', () => {
    it('should accept strong passwords and reject weak ones', () => {
      expect(isValidPassword('Str0ngPass')).toBe(true);
      expect(isValidPassword('weakpass')).toBe(false);
    });
  });

  describe('Delay helper', () => {
    it('should resolve after the provided milliseconds', async () => {
      jest.useFakeTimers();
      const spy = jest.fn();

      const promise = delay(1000).then(spy);

      jest.advanceTimersByTime(1000);
      await Promise.resolve();

      expect(spy).toHaveBeenCalledTimes(1);

      await promise;
      jest.useRealTimers();
    });
  });

  describe('Date helper', () => {
    it('should create dates from string, Date instance and default to now', () => {
      const fromString = createDate('2024-01-01T00:00:00.000Z');
      const base = new Date('2024-01-02T00:00:00.000Z');
      const fromDate = createDate(base);
      const now = createDate();

      expect(fromString.toISOString()).toBe('2024-01-01T00:00:00.000Z');
      expect(fromDate).toBe(base);
      expect(fromDate.toISOString()).toBe(base.toISOString());
      expect(now).toBeInstanceOf(Date);
    });
  });

  describe('Name validation', () => {
    it('should validate allowed characters and length', () => {
      expect(isValidName('José Pérez')).toBe(true);
      expect(isValidName('A')).toBe(false);
      expect(isValidName('Nombre-Invalido-123')).toBe(false);
    });
  });

  describe('Error formatting', () => {
    it('should format different error inputs', () => {
      expect(formatError(new Error('fail'))).toBe('fail');
      expect(formatError('string error')).toBe('string error');
      expect(formatError({})).toBe('Error desconocido');
    });
  });

  describe('Object helpers', () => {
    it('should pick specified keys', () => {
      const source = { a: 1, b: 2, c: 3 };
      expect(pick(source, ['a', 'c'])).toEqual({ a: 1, c: 3 });
    });

    it('should omit specified keys', () => {
      const source = { a: 1, b: 2, c: 3 };
      expect(omit(source, ['b'])).toEqual({ a: 1, c: 3 });
    });
  });
});
