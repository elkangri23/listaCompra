import { Result, success, failure } from '@shared/result';
import { IAuditRepository, AuditEntryQuery } from '@application/ports/repositories/IAuditRepository';
import { AuditEntry } from '@domain/entities/AuditEntry';
import { ValidationError } from '@application/errors/ValidationError';

export interface GetGlobalAuditHistoryDto {
  page?: number;
  pageSize?: number;
  entityType?: string;
  entityId?: string;
  changeType?: 'CREATE' | 'UPDATE' | 'DELETE';
  changedByUserId?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface AuditHistoryResponse {
  entries: AuditEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export class GetGlobalAuditHistory {
  constructor(private readonly auditRepository: IAuditRepository) {}

  async execute(dto: GetGlobalAuditHistoryDto): Promise<Result<AuditHistoryResponse, ValidationError | Error>> {
    const query: AuditEntryQuery = {
      page: dto.page || 1,
      pageSize: dto.pageSize || 10,
      entityType: dto.entityType,
      entityId: dto.entityId,
      changeType: dto.changeType,
      changedByUserId: dto.changedByUserId,
      startDate: dto.startDate,
      endDate: dto.endDate,
    };

    const findResult = await this.auditRepository.find(query);
    if (findResult.isFailure) {
      return failure(findResult.error);
    }

    const countResult = await this.auditRepository.count(query);
    if (countResult.isFailure) {
      return failure(countResult.error);
    }

    const total = countResult.value;
    const totalPages = Math.ceil(total / (query.pageSize || 10));

    return success({
      entries: findResult.value,
      total,
      page: query.page || 1,
      pageSize: query.pageSize || 10,
      totalPages,
    });
  }
}
