import { AuditEntry } from '@domain/entities/AuditEntry';
import { Result } from '@shared/result';

export interface AuditEntryQuery {
  entityType?: string;
  entityId?: string;
  changeType?: 'CREATE' | 'UPDATE' | 'DELETE';
  changedByUserId?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  pageSize?: number;
}

export interface IAuditRepository {
  save(auditEntry: AuditEntry): Promise<Result<AuditEntry, Error>>;
  findById(id: string): Promise<Result<AuditEntry | null, Error>>;
  find(query: AuditEntryQuery): Promise<Result<AuditEntry[], Error>>;
  count(query: AuditEntryQuery): Promise<Result<number, Error>>;
}
