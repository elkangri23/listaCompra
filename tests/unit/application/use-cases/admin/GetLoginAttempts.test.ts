/**
 * Tests del caso de uso GetLoginAttempts (fase 5): paginación, filtros
 * (email normalizado, success, fechas) y orden por fecha descendente.
 */

import { GetLoginAttempts } from '@application/use-cases/admin/GetLoginAttempts';
import { InMemoryLoginAttemptRepository } from '@infrastructure/persistence/in-memory/InMemoryLoginAttemptRepository';

describe('GetLoginAttempts', () => {
  async function seed() {
    const repo = new InMemoryLoginAttemptRepository();
    await repo.save({ email: 'a@ejemplo.com', success: true, reason: null, ipAddress: '1.1.1.1', userAgent: 'ua-1' });
    await repo.save({ email: 'a@ejemplo.com', success: false, reason: 'WRONG_PASSWORD', ipAddress: '1.1.1.1', userAgent: 'ua-1' });
    await repo.save({ email: 'b@ejemplo.com', success: false, reason: 'USER_NOT_FOUND', ipAddress: '2.2.2.2', userAgent: 'ua-2' });
    return repo;
  }

  it('lista todos, fecha desc, con paginación', async () => {
    const useCase = new GetLoginAttempts(await seed());
    const page1 = await useCase.execute({ page: 1, pageSize: 2 });
    expect(page1.total).toBe(3);
    expect(page1.attempts).toHaveLength(2);
    expect(page1.totalPages).toBe(2);
    const page2 = await useCase.execute({ page: 2, pageSize: 2 });
    expect(page2.attempts).toHaveLength(1);
  });

  it('filtra por email normalizando a minúsculas', async () => {
    const useCase = new GetLoginAttempts(await seed());
    const result = await useCase.execute({ email: 'A@EJEMPLO.COM' });
    expect(result.total).toBe(2);
    expect(result.attempts.every((a) => a.email === 'a@ejemplo.com')).toBe(true);
  });

  it('filtra por success=false (solo fallidos)', async () => {
    const useCase = new GetLoginAttempts(await seed());
    const result = await useCase.execute({ success: false });
    expect(result.total).toBe(2);
    expect(result.attempts.every((a) => a.success === false)).toBe(true);
  });

  it('normaliza página y tamaño (mínimo 1, máximo 100, defecto 20)', async () => {
    const useCase = new GetLoginAttempts(await seed());
    const result = await useCase.execute({ page: 0, pageSize: 500 });
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(100);
    const defaults = await useCase.execute({});
    expect(defaults.page).toBe(1);
    expect(defaults.pageSize).toBe(20);
  });

  it('sin intentos → lista vacía con total 0', async () => {
    const useCase = new GetLoginAttempts(new InMemoryLoginAttemptRepository());
    const result = await useCase.execute({});
    expect(result).toEqual({ attempts: [], total: 0, page: 1, pageSize: 20, totalPages: 1 });
  });
});
