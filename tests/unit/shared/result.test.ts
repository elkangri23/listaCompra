import {
  Success,
  Failure,
  success,
  failure,
  isSuccess,
  isFailure,
  map,
  flatMap,
  mapError,
  combine,
} from '@shared/result';

class TestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TestError';
  }
}

describe('Result utilities', () => {
  describe('Success', () => {
    it('should create a successful result with value accessors', () => {
      const result = success(42);

      expect(result).toBeInstanceOf(Success);
      expect(result.isSuccess).toBe(true);
      expect(result.isFailure).toBe(false);
      expect(result.value).toBe(42);
      expect(result.getValue()).toBe(42);
      expect(() => result.getError()).toThrow('Success result has no error');
    });
  });

  describe('Failure', () => {
    it('should create a failed result with error accessors', () => {
      const error = new TestError('something went wrong');
      const result = failure(error);

      expect(result).toBeInstanceOf(Failure);
      expect(result.isSuccess).toBe(false);
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe(error);
      expect(result.getError()).toBe(error);
      expect(() => result.getValue()).toThrow('Failure result has no value');
    });
  });

  describe('type guards', () => {
    it('should correctly discriminate success and failure', () => {
      const ok = success('value');
      const err = failure(new TestError('error'));

      expect(isSuccess(ok)).toBe(true);
      expect(isFailure(ok)).toBe(false);
      expect(isSuccess(err)).toBe(false);
      expect(isFailure(err)).toBe(true);
    });
  });

  describe('map', () => {
    it('should transform the value of a successful result', () => {
      const result = map(success(2), value => value * 2);

      expect(result.isSuccess).toBe(true);
      if (result.isSuccess) {
        expect(result.value).toBe(4);
      }
    });

    it('should keep failure unchanged', () => {
      const original = failure(new TestError('failure'));
      const mapped = map(original, value => value);

      expect(mapped).toBe(original);
      expect(mapped.isFailure).toBe(true);
    });
  });

  describe('flatMap', () => {
    it('should chain successful operations', () => {
      const result = flatMap(success(2), value => success(value * 3));

      expect(result.isSuccess).toBe(true);
      if (result.isSuccess) {
        expect(result.value).toBe(6);
      }
    });

    it('should propagate failures', () => {
      const result = flatMap(success(2), () => failure(new TestError('boom')));

      expect(result.isFailure).toBe(true);
      if (result.isFailure) {
        expect(result.error).toBeInstanceOf(TestError);
        expect(result.error.message).toBe('boom');
      }
    });

    it('should keep original failure unchanged', () => {
      const original = failure(new TestError('original failure'));
      const mapped = flatMap(original, () => success('value'));

      expect(mapped).toBe(original);
      expect(mapped.isFailure).toBe(true);
    });
  });

  describe('mapError', () => {
    it('should transform errors for failure results', () => {
      const original = failure(new TestError('original error'));
      const mapped = mapError(original, error => new Error(`Wrapped: ${error.message}`));

      expect(mapped.isFailure).toBe(true);
      if (mapped.isFailure) {
        expect(mapped.error).toBeInstanceOf(Error);
        expect(mapped.error.message).toBe('Wrapped: original error');
      }
    });

    it('should keep success unchanged', () => {
      const original = success('value');
      const mapped = mapError(original, () => new Error('should not run'));

      expect(mapped.isSuccess).toBe(true);
      if (mapped.isSuccess) {
        expect(mapped.value).toBe('value');
      }
    });
  });

  describe('combine', () => {
    it('should combine multiple successful results into an array', () => {
      const combined = combine([success(1), success(2), success(3)]);

      expect(combined.isSuccess).toBe(true);
      if (combined.isSuccess) {
        expect(combined.value).toEqual([1, 2, 3]);
      }
    });

    it('should short-circuit on first failure', () => {
      const error = new TestError('failure');
      const combined = combine([success(1), failure(error), success(3)]);

      expect(combined.isFailure).toBe(true);
      if (combined.isFailure) {
        expect(combined.error).toBe(error);
      }
    });
  });
});
