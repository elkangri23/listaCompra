/**
 * Caso de uso: lista paginada de copias de seguridad para el panel de
 * administración (fase 6). Ordenada por fecha descendente.
 */

import type { IBackupRepository } from '@application/ports/repositories/IBackupRepository';
import type {
  GetBackupsQueryDto,
  GetBackupsResponseDto,
} from '@application/dto/admin/BackupDto';
import { normalizePage, normalizePageSize, toBackupDto } from './backupHelpers';

export class GetBackups {
  constructor(private readonly backupRepository: IBackupRepository) {}

  async execute(query: GetBackupsQueryDto): Promise<GetBackupsResponseDto> {
    const page = normalizePage(query.page);
    const pageSize = normalizePageSize(query.pageSize);

    const result = await this.backupRepository.findMany(page, pageSize);

    return {
      backups: result.backups.map(toBackupDto),
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: result.totalPages,
    };
  }
}
