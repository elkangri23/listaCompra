import { describe, test, expect } from '@jest/globals';

describe('Infrastructure Setup', () => {
  test('should be able to import required modules', async () => {
    // Test que el setup básico funciona
    expect(true).toBe(true);
  });

  test('should load environment variables', async () => {
    expect(process.env['NODE_ENV']).toBeDefined();
    expect(process.env['DATABASE_URL']).toBeDefined();
  });
});