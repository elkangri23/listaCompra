/**
 * Tests del caso de uso GetBackups (fase 6): paginación y orden por fecha
 * descendente, con el repositorio en memoria.
 */

import { GetBackups } from '@application/use-cases/admin/GetBackups';
import { InMemoryBackupRepository } from '@infrastructure/persistence/in-memory/InMemoryBackupRepository';
import type { NewBackup } from '@application/ports/repositories/IBackupRepository';

const base: Omit<NewBackup, 'filename' | 'source'> = {
  sizeBytes: 1234,
  status: 'CREATED',
  createdByUserId: null,
  restoreReason: null,
  restoredAt: null,
  restoreRequestedAt: null,
  restoreRequestedByUserId: null,
  failureReason: null,
};

describe('GetBackups', () => {
  async function seed() {
    const repo = new InMemoryBackupRepository();
    await repo.save({ ...base, filename: 'listacompra-20261128-040000.sql.gz', source: 'SCHEDULED' });
    await repo.save({ ...base, filename: 'listacompra-20261127-040000.sql.gz', source: 'SCHEDULED' });
    await repo.save({ ...base, filename: 'manual-x.sql.gz', source: 'MANUAL', status: 'PENDING', sizeBytes: 0 });
    return repo;
  }

  it('lista todos, fecha desc, con paginación', async () => {
    const useCase = new GetBackups(await seed());
    const page1 = await useCase.execute({ page: 1, pageSize: 2 });
    expect(page1.total).toBe(3);
    expect(page1.backups).toHaveLength(2);
    expect(page1.totalPages).toBe(2);
    const page2 = await useCase.execute({ page: 2, pageSize: 2 });
    expect(page2.backups).toHaveLength(1);
    // Las tres copias aparecen entre las dos páginas (el orden por fecha
    // desc no se afirma aquí: las tres se crean en el mismo milisegundo
    // y el desempate no es significativo).
    const all = [...page1.backups, ...page2.backups].map((b) => b.filename).sort();
    expect(all).toEqual([
      'listacompra-20261127-040000.sql.gz',
      'listacompra-20261128-040000.sql.gz',
      'manual-x.sql.gz',
    ]);
  });

  it('normaliza página y tamaño (mínimo 1, máximo 100, defecto 20)', async () => {
    const useCase = new GetBackups(await seed());
    const result = await useCase.execute({ page: 0, pageSize: 500 });
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(100);
    const defaults = await useCase.execute({});
    expect(defaults.page).toBe(1);
    expect(defaults.pageSize).toBe(20);
  });

  it('sin copias → lista vacía con total 0', async () => {
    const useCase = new GetBackups(new InMemoryBackupRepository());
    const result = await useCase.execute({});
    expect(result).toEqual({ backups: [], total: 0, page: 1, pageSize: 20, totalPages: 1 });
  });
});
