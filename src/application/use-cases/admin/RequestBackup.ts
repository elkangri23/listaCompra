/**
 * Caso de uso: registrar una solicitud manual de copia de seguridad
 * (fase 6). SOLO registra la solicitud: NO hace el dump.
 *
 * El watcher (backup-watcher.sh, cada 5 min en el VPS) recoge las filas
 * PENDING y ejecuta backup-prod.sh <id>, que hace el pg_dump, comprime y
 * actualiza la fila a CREATED (con filename y sizeBytes reales) o FAILED.
 * Si ya hay una PENDING, se devuelve 409 para no encolar duplicados.
 */

import { randomUUID } from 'node:crypto';

import type { IBackupRepository } from '@application/ports/repositories/IBackupRepository';
import type { RequestBackupResponseDto } from '@application/dto/admin/BackupDto';
import { ConflictError } from '@application/errors/ConflictError';
import { failure, success, type Result } from '@shared/result';
import { toBackupDto } from './backupHelpers';

export class RequestBackup {
  constructor(private readonly backupRepository: IBackupRepository) {}

  async execute(adminUserId: string): Promise<Result<RequestBackupResponseDto, Error>> {
    const pending = await this.backupRepository.findPending();
    if (pending) {
      return failure(
        new ConflictError(
          'Ya hay una copia de seguridad pendiente de procesar. Espera a que termine antes de solicitar otra.'
        )
      );
    }

    // Nombre provisional: backup-prod.sh lo corrige al completarse con el
    // nombre real listacompra-YYYYMMDD-HHMMSS.sql.gz.
    const backup = await this.backupRepository.save({
      filename: `manual-${randomUUID()}.sql.gz`,
      sizeBytes: 0,
      status: 'PENDING',
      source: 'MANUAL',
      createdByUserId: adminUserId,
      restoreReason: null,
      restoredAt: null,
      restoreRequestedAt: null,
      restoreRequestedByUserId: null,
      failureReason: null,
    });

    return success({ backup: toBackupDto(backup) });
  }
}
