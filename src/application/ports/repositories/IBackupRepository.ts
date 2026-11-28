/**
 * Copia de seguridad persistida (fila de `backups`).
 *
 * Ciclo de vida (documentado en el modelo Prisma y en el schema):
 * PENDING → CREATED | FAILED (creación por backup-prod.sh) y
 * CREATED → RESTORING → RESTORED | RESTORE_FAILED (restauración por
 * restore-prod.sh, previo ensayo en base aislada). El backend solo
 * REGISTRA y EXPONE: el trabajo pesado lo hacen scripts del host + cron,
 * porque el contenedor de la API no puede ejecutar comandos del host ni
 * docker exec. Sin FK a usuarios (una copia programada no tiene creador)
 * y fuera de la cascada GDPR, igual que ai_usage_events y login_attempts.
 */

export type BackupStatus =
  | 'PENDING'
  | 'CREATED'
  | 'FAILED'
  | 'RESTORING'
  | 'RESTORED'
  | 'RESTORE_FAILED';

export type BackupSource = 'SCHEDULED' | 'MANUAL';

export interface Backup {
  id: string;
  filename: string;
  /** Bytes del .sql.gz en disco; 0 mientras PENDING. */
  sizeBytes: number;
  status: BackupStatus;
  source: BackupSource;
  createdByUserId: string | null;
  createdAt: Date;
  /** Motivo de la restauración, dado por el admin que la solicitó. */
  restoreReason: string | null;
  restoredAt: Date | null;
  /**
   * Cuándo se solicitó la restauración. Distingue "solicitada, pendiente
   * de procesar" de "en curso": el watcher procesa las filas RESTORING
   * con este campo no nulo. Mientras haya una, no se acepta otra (409).
   */
  restoreRequestedAt: Date | null;
  restoreRequestedByUserId: string | null;
  /**
   * Motivo del fallo de creación (FAILED) o de restauración
   * (RESTORE_FAILED). El detalle completo queda en el log del script.
   */
  failureReason: string | null;
}

export type NewBackup = Omit<Backup, 'id' | 'createdAt'>;

export interface BackupUpdate {
  filename?: string;
  sizeBytes?: number;
  status?: BackupStatus;
  restoreReason?: string | null;
  restoredAt?: Date | null;
  restoreRequestedAt?: Date | null;
  restoreRequestedByUserId?: string | null;
  failureReason?: string | null;
}

export interface PaginatedBackups {
  backups: Backup[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface IBackupRepository {
  save(backup: NewBackup): Promise<Backup>;
  findById(id: string): Promise<Backup | null>;
  /** Todas las copias, ordenadas por createdAt desc, paginadas. */
  findMany(page: number, pageSize: number): Promise<PaginatedBackups>;
  /** La primera solicitud manual pendiente, si la hay (para el watcher). */
  findPending(): Promise<Backup | null>;
  /** La última copia en estado CREATED, si la hay (salud de copias del panel admin). */
  findLatestCreated(): Promise<Backup | null>;
  /**
   * Alguna restauración solicitada o en curso (status RESTORING con
   * restoreRequestedAt). Mientras haya una, no se acepta otra (409).
   */
  findRestoring(): Promise<Backup | null>;
  update(id: string, patch: BackupUpdate): Promise<Backup | null>;
}
