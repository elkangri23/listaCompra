import { PrismaClient } from '@prisma/client';
import { AuditEntry } from '@domain/entities/AuditEntry';
import { IAuditRepository, AuditEntryQuery } from '@application/ports/repositories/IAuditRepository';
import { Result, success, failure } from '@shared/result';

export class PrismaAuditRepository implements IAuditRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(auditEntry: AuditEntry): Promise<Result<AuditEntry, Error>> {
    try {
      const createdAuditEntry = await this.prisma.auditEntry.create({
        data: {
          id: auditEntry.id,
          entityType: auditEntry.entityType,
          entityId: auditEntry.entityId,
          changeType: auditEntry.changeType,
          changedByUserId: auditEntry.changedByUserId,
          timestamp: auditEntry.timestamp,
          oldValue: auditEntry.oldValue || undefined,
          newValue: auditEntry.newValue || undefined,
          changedFields: auditEntry.changedFields || undefined,
        },
      });
      return success(AuditEntry.create(createdAuditEntry));
    } catch (error: any) {
      return failure(new Error(`Error saving audit entry: ${error.message}`));
    }
  }

  async findById(id: string): Promise<Result<AuditEntry | null, Error>> {
    try {
      const auditEntry = await this.prisma.auditEntry.findUnique({
        where: { id },
      });
      return success(auditEntry ? AuditEntry.create(auditEntry) : null);
    } catch (error: any) {
      return failure(new Error(`Error finding audit entry by ID: ${error.message}`));
    }
  }

  async find(query: AuditEntryQuery): Promise<Result<AuditEntry[], Error>> {
    try {
      const where: any = {};
      if (query.entityType) where.entityType = query.entityType;
      if (query.entityId) where.entityId = query.entityId;
      if (query.changeType) where.changeType = query.changeType;
      if (query.changedByUserId) where.changedByUserId = query.changedByUserId;
      if (query.startDate) where.timestamp = { ...where.timestamp, gte: query.startDate };
      if (query.endDate) where.timestamp = { ...where.timestamp, lte: query.endDate };

      const auditEntries = await this.prisma.auditEntry.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip: query.page && query.pageSize ? (query.page - 1) * query.pageSize : undefined,
        take: query.pageSize || undefined,
      });
      return success(auditEntries.map((entry) => AuditEntry.create(entry)));
    } catch (error: any) {
      return failure(new Error(`Error finding audit entries: ${error.message}`));
    }
  }

  async count(query: AuditEntryQuery): Promise<Result<number, Error>> {
    try {
      const where: any = {};
      if (query.entityType) where.entityType = query.entityType;
      if (query.entityId) where.entityId = query.entityId;
      if (query.changeType) where.changeType = query.changeType;
      if (query.changedByUserId) where.changedByUserId = query.changedByUserId;
      if (query.startDate) where.timestamp = { ...where.timestamp, gte: query.startDate };
      if (query.endDate) where.timestamp = { ...where.timestamp, lte: query.endDate };

      const count = await this.prisma.auditEntry.count({ where });
      return success(count);
    } catch (error: any) {
      return failure(new Error(`Error counting audit entries: ${error.message}`));
    }
  }
}
