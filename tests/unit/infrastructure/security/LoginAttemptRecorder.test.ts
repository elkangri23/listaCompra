/**
 * Tests del recorder best-effort de intentos de login (fase 5): normaliza
 * el email y NUNCA propaga errores.
 */

import { LoginAttemptRecorder } from '@infrastructure/security/LoginAttemptRecorder';
import { InMemoryLoginAttemptRepository } from '@infrastructure/persistence/in-memory/InMemoryLoginAttemptRepository';
import type { ILoginAttemptRepository } from '@application/ports/repositories/ILoginAttemptRepository';

describe('LoginAttemptRecorder', () => {
  it('registra el intento con el email normalizado a minúsculas', async () => {
    const repo = new InMemoryLoginAttemptRepository();
    const recorder = new LoginAttemptRecorder(repo);
    await recorder.record({
      email: '  Ana@Ejemplo.COM ',
      success: false,
      reason: 'WRONG_PASSWORD',
      ipAddress: '1.2.3.4',
      userAgent: 'test-agent',
    });
    const result = await repo.findMany({}, 1, 20);
    expect(result.total).toBe(1);
    expect(result.attempts[0]?.email).toBe('ana@ejemplo.com');
    expect(result.attempts[0]?.success).toBe(false);
    expect(result.attempts[0]?.reason).toBe('WRONG_PASSWORD');
    expect(result.attempts[0]?.ipAddress).toBe('1.2.3.4');
  });

  it('un fallo del repositorio no rompe el login: record resuelve sin lanzar', async () => {
    const throwingRepo = {
      save: async () => {
        throw new Error('BD caída');
      },
      findMany: async () => ({ attempts: [], total: 0, page: 1, pageSize: 20, totalPages: 1 }),
      findFailedSince: async () => [],
      countFailedSince: async () => 0,
    } as unknown as ILoginAttemptRepository;
    const recorder = new LoginAttemptRecorder(throwingRepo);
    await expect(
      recorder.record({ email: 'a@ejemplo.com', success: true, reason: null })
    ).resolves.toBeUndefined();
  });
});
