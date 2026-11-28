/**
 * Caso de uso: registrar una solicitud de restauración de una copia
 * (fase 6). SOLO registra la solicitud: NO restaura nada directamente.
 *
 * El watcher (backup-watcher.sh, cada 5 min en el VPS) recoge las filas
 * RESTORING con restoreRequestedAt y delega en restore-prod.sh, que
 * primero ENSAYA en una base aislada y solo si el ensayo pasa crea una
 * copia pre-restore (salvavidas), para la API, vacía la base y restaura.
 *
 * Validación estricta:
 * - confirmacion distinta de "RESTAURAR" → 400
 * - motivo vacío → 400
 * - copia inexistente → 404
 * - copia PENDING o FAILED → 400 (no se puede restaurar lo que no
 *   existe en disco o falló al crearse)
 * - ya hay una restauración solicitada o en curso → 409
 *
 * El estado RESTORING significa a la vez "solicitada, pendiente de
 * procesar" y "en curso": no hay un estado intermedio en el contrato, y
 * el watcher la recoge por restoreRequestedAt no nulo.
 */

import type { IBackupRepository } from '@application/ports/repositories/IBackupRepository';
import type {
  RequestRestoreDto,
  RequestRestoreResponseDto,
} from '@application/dto/admin/BackupDto';
import { ConflictError } from '@application/errors/ConflictError';
import { NotFoundError } from '@application/errors/NotFoundError';
import { ValidationError } from '@application/errors/ValidationError';
import { failure, success, type Result } from '@shared/result';
import { toBackupDto } from './backupHelpers';

export const RESTORE_CONFIRMATION_WORD = 'RESTAURAR';

export class RequestRestore {
  constructor(private readonly backupRepository: IBackupRepository) {}

  async execute(
    adminUserId: string,
    backupId: string,
    dto: RequestRestoreDto
  ): Promise<Result<RequestRestoreResponseDto, Error>> {
    if (dto.confirmacion !== RESTORE_CONFIRMATION_WORD) {
      return failure(
        new ValidationError(
          'La confirmación debe ser exactamente "RESTAURAR"',
          'confirmacion',
          dto.confirmacion
        )
      );
    }

    const motivo = typeof dto.motivo === 'string' ? dto.motivo.trim() : '';
    if (motivo === '') {
      return failure(
        new ValidationError('El motivo de la restauración es obligatorio', 'motivo', dto.motivo)
      );
    }

    const backup = await this.backupRepository.findById(backupId);
    if (!backup) {
      return failure(new NotFoundError('Copia de seguridad', backupId));
    }

    if (backup.status === 'PENDING' || backup.status === 'FAILED') {
      return failure(
        new ValidationError(
          'No se puede restaurar una copia que está pendiente de crear o que falló al crearse',
          'status',
          backup.status
        )
      );
    }

    const restoring = await this.backupRepository.findRestoring();
    if (restoring) {
      return failure(
        new ConflictError(
          'Ya hay una restauración solicitada o en curso. Espera a que termine antes de solicitar otra.'
        )
      );
    }

    const updated = await this.backupRepository.update(backup.id, {
      status: 'RESTORING',
      restoreReason: motivo,
      restoreRequestedAt: new Date(),
      restoreRequestedByUserId: adminUserId,
    });
    if (!updated) {
      return failure(new NotFoundError('Copia de seguridad', backupId));
    }

    return success({ backup: toBackupDto(updated) });
  }
}
