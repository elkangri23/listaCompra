/**
 * Tests del caso de uso RequestRestore (fase 6): validación estricta de
 * confirmación y motivo, estados que no se pueden restaurar, 409 si ya
 * hay una restauración en curso. SOLO registra la solicitud (RESTORING);
 * la restauración la hace restore-prod.sh en el host.
 */

import { RequestRestore } from '@application/use-cases/admin/RequestRestore';
import { InMemoryBackupRepository } from '@infrastructure/persistence/in-memory/InMemoryBackupRepository';
import type {
  BackupStatus,
  NewBackup,
} from '@application/ports/repositories/IBackupRepository';

const ADMIN_ID = '11111111-1111-4111-8111-111111111111';

async function seed(status: BackupStatus) {
  const repo = new InMemoryBackupRepository();
  const backup = await repo.save({
    filename: 'listacompra-20261128-040000.sql.gz',
    sizeBytes: 1234,
    status,
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

describe('RequestRestore', () => {
  it('CREATED + RESTAURAR + motivo → 202, RESTORING con motivo y solicitante', async () => {
    const { repo, backup } = await seed('CREATED');
    const useCase = new RequestRestore(repo);
    const result = await useCase.execute(ADMIN_ID, backup.id, {
      confirmacion: 'RESTAURAR',
      motivo: 'La base quedó corrupta tras el despliegue',
    });
    expect(result.isSuccess).toBe(true);
    if (result.isFailure) {
      return;
    }
    const dto = result.value.backup;
    expect(dto.status).toBe('RESTORING');
    expect(dto.restoreReason).toBe('La base quedó corrupta tras el despliegue');
    const stored = await repo.findById(backup.id);
    expect(stored?.restoreRequestedAt).not.toBeNull();
    expect(stored?.restoreRequestedByUserId).toBe(ADMIN_ID);
  });

  it('confirmación distinta de RESTAURAR → 400 ValidationError', async () => {
    const { repo, backup } = await seed('CREATED');
    const useCase = new RequestRestore(repo);
    const result = await useCase.execute(ADMIN_ID, backup.id, {
      confirmacion: 'RESTAURAR ',
      motivo: 'motivo',
    });
    expect(result.isFailure).toBe(true);
    if (result.isSuccess) {
      return;
    }
    expect(result.error.constructor.name).toBe('ValidationError');
  });

  it('motivo vacío o solo espacios → 400 ValidationError', async () => {
    const { repo, backup } = await seed('CREATED');
    const useCase = new RequestRestore(repo);
    for (const motivo of ['', '   ']) {
      const result = await useCase.execute(ADMIN_ID, backup.id, {
        confirmacion: 'RESTAURAR',
        motivo,
      });
      expect(result.isFailure).toBe(true);
      if (result.isSuccess) {
        return;
      }
      expect(result.error.constructor.name).toBe('ValidationError');
    }
  });

  it('copia inexistente → 404 NotFoundError', async () => {
    const repo = new InMemoryBackupRepository();
    const useCase = new RequestRestore(repo);
    const result = await useCase.execute(ADMIN_ID, 'id-inexistente', {
      confirmacion: 'RESTAURAR',
      motivo: 'motivo',
    });
    expect(result.isFailure).toBe(true);
    if (result.isSuccess) {
      return;
    }
    expect(result.error.constructor.name).toBe('NotFoundError');
  });

  it.each(['PENDING', 'FAILED'] as const)(
    'copia %s → 400 (no se puede restaurar lo que no existe o falló)',
    async (status) => {
      const { repo, backup } = await seed(status);
      const useCase = new RequestRestore(repo);
      const result = await useCase.execute(ADMIN_ID, backup.id, {
        confirmacion: 'RESTAURAR',
        motivo: 'motivo',
      });
      expect(result.isFailure).toBe(true);
      if (result.isSuccess) {
        return;
      }
      expect(result.error.constructor.name).toBe('ValidationError');
    }
  );

  it('ya hay una RESTORING → 409 ConflictError', async () => {
    const { repo, backup } = await seed('CREATED');
    const other = await repo.save({
      filename: 'listacompra-20261127-040000.sql.gz',
      sizeBytes: 999,
      status: 'RESTORING',
      source: 'MANUAL',
      createdByUserId: ADMIN_ID,
      restoreReason: 'otra restauración',
      restoredAt: null,
      restoreRequestedAt: new Date(),
      restoreRequestedByUserId: ADMIN_ID,
      failureReason: null,
    } satisfies NewBackup);
    expect(other.status).toBe('RESTORING');
    const useCase = new RequestRestore(repo);
    const result = await useCase.execute(ADMIN_ID, backup.id, {
      confirmacion: 'RESTAURAR',
      motivo: 'motivo',
    });
    expect(result.isFailure).toBe(true);
    if (result.isSuccess) {
      return;
    }
    expect(result.error.constructor.name).toBe('ConflictError');
  });

  it('una RESTORED se puede volver a restaurar', async () => {
    const { repo, backup } = await seed('RESTORED');
    const useCase = new RequestRestore(repo);
    const result = await useCase.execute(ADMIN_ID, backup.id, {
      confirmacion: 'RESTAURAR',
      motivo: 'revertir de nuevo',
    });
    expect(result.isSuccess).toBe(true);
  });
});
