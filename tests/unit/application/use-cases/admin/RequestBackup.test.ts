/**
 * Tests del caso de uso RequestBackup (fase 6): solo REGISTRA la
 * solicitud (PENDING, MANUAL, filename provisional); 409 si ya hay una
 * PENDING. El dump lo hace backup-prod.sh en el host.
 */

import { RequestBackup } from '@application/use-cases/admin/RequestBackup';
import { InMemoryBackupRepository } from '@infrastructure/persistence/in-memory/InMemoryBackupRepository';

const ADMIN_ID = '11111111-1111-4111-8111-111111111111';

describe('RequestBackup', () => {
  it('registra una PENDING MANUAL con el admin como creador y sizeBytes 0', async () => {
    const repo = new InMemoryBackupRepository();
    const useCase = new RequestBackup(repo);
    const result = await useCase.execute(ADMIN_ID);
    expect(result.isSuccess).toBe(true);
    if (result.isFailure) {
      return;
    }
    const backup = result.value.backup;
    expect(backup.status).toBe('PENDING');
    expect(backup.source).toBe('MANUAL');
    expect(backup.sizeBytes).toBe(0);
    expect(backup.createdByUserId).toBe(ADMIN_ID);
    expect(backup.filename).toMatch(/^manual-[0-9a-f-]+\.sql\.gz$/);
    expect(backup.restoreReason).toBeNull();
    expect(backup.failureReason).toBeNull();
  });

  it('segunda solicitud con una PENDING → 409 ConflictError', async () => {
    const repo = new InMemoryBackupRepository();
    const useCase = new RequestBackup(repo);
    const first = await useCase.execute(ADMIN_ID);
    expect(first.isSuccess).toBe(true);
    const second = await useCase.execute(ADMIN_ID);
    expect(second.isFailure).toBe(true);
    if (second.isSuccess) {
      return;
    }
    expect(second.error.constructor.name).toBe('ConflictError');
    expect(second.error.message).toMatch(/pendiente/);
  });

  it('tras resolver la PENDING (CREATED) se puede pedir otra', async () => {
    const repo = new InMemoryBackupRepository();
    const useCase = new RequestBackup(repo);
    const first = await useCase.execute(ADMIN_ID);
    expect(first.isSuccess).toBe(true);
    if (first.isFailure) {
      return;
    }
    await repo.update(first.value.backup.id, {
      status: 'CREATED',
      filename: 'listacompra-20261128-040000.sql.gz',
      sizeBytes: 1234,
    });
    const second = await useCase.execute(ADMIN_ID);
    expect(second.isSuccess).toBe(true);
  });
});
