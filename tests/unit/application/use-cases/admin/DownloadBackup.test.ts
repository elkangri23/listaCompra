/**
 * Tests del caso de uso DownloadBackup (fase 6) y del almacén local de
 * ficheros: 404 si la copia no existe o el fichero no está en disco, y
 * protección contra path traversal en LocalBackupFileStore.
 */

import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

import { DownloadBackup } from '@application/use-cases/admin/DownloadBackup';
import { InMemoryBackupRepository } from '@infrastructure/persistence/in-memory/InMemoryBackupRepository';
import { LocalBackupFileStore } from '@infrastructure/external-services/backup/LocalBackupFileStore';
import type { NewBackup } from '@application/ports/repositories/IBackupRepository';

async function seedCreated() {
  const repo = new InMemoryBackupRepository();
  const backup = await repo.save({
    filename: 'listacompra-20261128-040000.sql.gz',
    sizeBytes: 10,
    status: 'CREATED',
    source: 'SCHEDULED',
    createdByUserId: null,
    restoreReason: null,
    restoredAt: null,
    restoreRequestedAt: null,
    restoreRequestedByUserId: null,
    failureReason: null,
  } satisfies NewBackup);
  return { repo, backup };
}

describe('DownloadBackup', () => {
  it('devuelve el buffer del .sql.gz cuando el fichero existe', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'backups-'));
    const content = gzipSync('SELECT 1;');
    await writeFile(join(dir, 'listacompra-20261128-040000.sql.gz'), content);
    const { repo, backup } = await seedCreated();
    const useCase = new DownloadBackup(repo, new LocalBackupFileStore(dir));
    const result = await useCase.execute(backup.id);
    expect(result.isSuccess).toBe(true);
    if (result.isFailure) {
      return;
    }
    expect(result.value.filename).toBe('listacompra-20261128-040000.sql.gz');
    expect(result.value.buffer.equals(content)).toBe(true);
  });

  it('copia inexistente → 404 NotFoundError', async () => {
    const repo = new InMemoryBackupRepository();
    const useCase = new DownloadBackup(repo, new LocalBackupFileStore('/tmp/no-existe'));
    const result = await useCase.execute('id-inexistente');
    expect(result.isFailure).toBe(true);
    if (result.isSuccess) {
      return;
    }
    expect(result.error.constructor.name).toBe('NotFoundError');
  });

  it('fichero no en disco → 404 NotFoundError', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'backups-'));
    const { repo, backup } = await seedCreated();
    const useCase = new DownloadBackup(repo, new LocalBackupFileStore(dir));
    const result = await useCase.execute(backup.id);
    expect(result.isFailure).toBe(true);
    if (result.isSuccess) {
      return;
    }
    expect(result.error.constructor.name).toBe('NotFoundError');
  });
});

describe('LocalBackupFileStore (path traversal)', () => {
  it('un filename con ../ se reduce a su basename dentro del directorio', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'backups-'));
    const content = gzipSync('seguro');
    await writeFile(join(dir, 'passwd'), content);
    const store = new LocalBackupFileStore(dir);
    // "../../etc/passwd" → basename "passwd", que SÍ está en el directorio:
    // el almacén nunca sale de baseDir.
    const read = await store.read('../../etc/passwd');
    expect(read?.equals(content)).toBe(true);
  });

  it('devuelve null cuando el fichero no existe', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'backups-'));
    const store = new LocalBackupFileStore(dir);
    await expect(store.read('no-existe.sql.gz')).resolves.toBeNull();
  });
});
