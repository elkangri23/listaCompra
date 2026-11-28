/**
 * Caso de uso: descargar el fichero .sql.gz de una copia (fase 6).
 *
 * Lee del volumen `/backups` (solo lectura en el contenedor de la API).
 * Si la copia no existe o el fichero no está en disco → 404. La
 * protección contra path traversal vive en el almacén de ficheros
 * (LocalBackupFileStore): solo usa el basename del filename guardado.
 */

import type { IBackupRepository } from '@application/ports/repositories/IBackupRepository';
import type { IBackupFileStore } from '@application/ports/external/IBackupFileStore';
import { NotFoundError } from '@application/errors/NotFoundError';
import { failure, success, type Result } from '@shared/result';

export interface DownloadBackupResult {
  filename: string;
  buffer: Buffer;
}

export class DownloadBackup {
  constructor(
    private readonly backupRepository: IBackupRepository,
    private readonly backupFileStore: IBackupFileStore
  ) {}

  async execute(backupId: string): Promise<Result<DownloadBackupResult, Error>> {
    const backup = await this.backupRepository.findById(backupId);
    if (!backup) {
      return failure(new NotFoundError('Copia de seguridad', backupId));
    }

    const buffer = await this.backupFileStore.read(backup.filename);
    if (!buffer) {
      return failure(
        new NotFoundError(
          'Fichero de la copia de seguridad',
          backup.filename
        )
      );
    }

    return success({ filename: backup.filename, buffer });
  }
}
