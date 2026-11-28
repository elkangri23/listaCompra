/**
 * Utilidades compartidas por los casos de uso de copias (fase 6):
 * normalización de paginación y mapeo de la fila `backups` al DTO.
 */

import type { Backup } from '@application/ports/repositories/IBackupRepository';
import type { BackupDto } from '@application/dto/admin/BackupDto';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export function normalizePage(page?: number): number {
  if (!page || !Number.isFinite(page) || page < 1) {
    return DEFAULT_PAGE;
  }
  return Math.floor(page);
}

export function normalizePageSize(pageSize?: number): number {
  if (!pageSize || !Number.isFinite(pageSize) || pageSize < 1) {
    return DEFAULT_PAGE_SIZE;
  }
  return Math.min(Math.floor(pageSize), MAX_PAGE_SIZE);
}

export function toBackupDto(backup: Backup): BackupDto {
  return {
    id: backup.id,
    filename: backup.filename,
    sizeBytes: backup.sizeBytes,
    status: backup.status,
    source: backup.source,
    createdAt: backup.createdAt.toISOString(),
    createdByUserId: backup.createdByUserId,
    restoreReason: backup.restoreReason,
    restoredAt: backup.restoredAt ? backup.restoredAt.toISOString() : null,
    failureReason: backup.failureReason,
  };
}
