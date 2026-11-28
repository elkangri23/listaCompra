/**
 * DTOs del panel de administración, pestaña Copias (fase 6).
 */

import type { BackupSource, BackupStatus } from '@application/ports/repositories/IBackupRepository';

// ============================================================================
// Listado / detalle: GET /admin/backups, POST /admin/backups,
// POST /admin/backups/:id/restore
// ============================================================================

export interface BackupDto {
  id: string;
  filename: string;
  sizeBytes: number;
  status: BackupStatus;
  source: BackupSource;
  createdAt: string;
  createdByUserId: string | null;
  restoreReason: string | null;
  restoredAt: string | null;
  /** Motivo del fallo de creación o de restauración, si lo hubo. */
  failureReason: string | null;
}

export interface GetBackupsQueryDto {
  page?: number;
  pageSize?: number;
}

export interface GetBackupsResponseDto {
  backups: BackupDto[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface RequestBackupResponseDto {
  backup: BackupDto;
}

export interface RequestRestoreDto {
  /** Debe ser exactamente "RESTAURAR" (palabra de confirmación). */
  confirmacion: string;
  /** Motivo no vacío de la restauración. */
  motivo: string;
}

export interface RequestRestoreResponseDto {
  backup: BackupDto;
}
