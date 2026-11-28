/**
 * Tests del repositorio en memoria de intentos de login (fase 5).
 */

import { InMemoryLoginAttemptRepository } from '@infrastructure/persistence/in-memory/InMemoryLoginAttemptRepository';

describe('InMemoryLoginAttemptRepository', () => {
  async function seed() {
    const repo = new InMemoryLoginAttemptRepository();
    await repo.save({ email: 'a@ejemplo.com', success: true, reason: null, ipAddress: '1.1.1.1', userAgent: 'ua' });
    await repo.save({ email: 'a@ejemplo.com', success: false, reason: 'WRONG_PASSWORD', ipAddress: '1.1.1.1', userAgent: 'ua' });
    await repo.save({ email: 'b@ejemplo.com', success: false, reason: 'USER_NOT_FOUND', ipAddress: '2.2.2.2', userAgent: 'ua' });
    return repo;
  }

  it('save devuelve el intento con id y createdAt', async () => {
    const repo = new InMemoryLoginAttemptRepository();
    const created = await repo.save({ email: 'x@ejemplo.com', success: true, reason: null, ipAddress: null, userAgent: null });
    expect(created.id).toBeTruthy();
    expect(created.createdAt).toBeInstanceOf(Date);
    expect(created.email).toBe('x@ejemplo.com');
  });

  it('findMany filtra por email y success, y pagina', async () => {
    const repo = await seed();
    const byEmail = await repo.findMany({ email: 'a@ejemplo.com' }, 1, 20);
    expect(byEmail.total).toBe(2);
    const failed = await repo.findMany({ success: false }, 1, 20);
    expect(failed.total).toBe(2);
    const page1 = await repo.findMany({}, 1, 2);
    expect(page1.attempts).toHaveLength(2);
    expect(page1.totalPages).toBe(2);
    const page2 = await repo.findMany({}, 2, 2);
    expect(page2.attempts).toHaveLength(1);
  });

  it('findMany ordena por fecha descendente', async () => {
    const repo = await seed();
    const result = await repo.findMany({}, 1, 20);
    const times = result.attempts.map((a) => a.createdAt.getTime());
    expect(times[0]).toBeGreaterThanOrEqual(times[1] as number);
    expect(times[1]).toBeGreaterThanOrEqual(times[2] as number);
  });

  it('findFailedSince y countFailedSince solo cuentan fallidos recientes', async () => {
    const repo = await seed();
    const since = new Date(Date.now() - 60 * 60 * 1000);
    expect((await repo.findFailedSince(since)).length).toBe(2);
    expect(await repo.countFailedSince(since)).toBe(2);
    const future = new Date(Date.now() + 60 * 1000);
    expect(await repo.countFailedSince(future)).toBe(0);
    expect(await repo.findFailedSince(future)).toEqual([]);
  });
});
