import { Result, success, failure } from '@shared/result';
import { IAuditRepository, AuditEntryQuery } from '@application/ports/repositories/IAuditRepository';
import { AuditEntry } from '@domain/entities/AuditEntry';
import { ValidationError } from '@application/errors/ValidationError';

export interface GetAuditHistoryForProductDto {
  productId: string;
  page?: number;
  pageSize?: number;
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

export class GetAuditHistoryForProduct {
  constructor(private readonly auditRepository: IAuditRepository) {}

  async execute(dto: GetAuditHistoryForProductDto): Promise<Result<AuditHistoryResponse, ValidationError | Error>> {
    if (!dto.productId) {
      return failure(ValidationError.create('productId is required', 'productId', dto.productId));
    }

    const query: AuditEntryQuery = {
      entityType: 'Producto',
      entityId: dto.productId,
      page: dto.page ?? 1,
      pageSize: dto.pageSize ?? 10,
      ...(dto.changeType && { changeType: dto.changeType }),
      ...(dto.changedByUserId && { changedByUserId: dto.changedByUserId }),
      ...(dto.startDate && { startDate: dto.startDate }),
      ...(dto.endDate && { endDate: dto.endDate }),
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
