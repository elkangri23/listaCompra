import { Prisma, PrismaClient } from '@prisma/client';
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
          changedByUserId: auditEntry.changedByUserId || null,
          timestamp: auditEntry.timestamp,
          oldValue: auditEntry.oldValue || Prisma.JsonNull,
          newValue: auditEntry.newValue || Prisma.JsonNull,
          changedFields: auditEntry.changedFields || Prisma.JsonNull,
        },
      });
      return success(AuditEntry.create(createdAuditEntry as any));
    } catch (error: any) {
      return failure(new Error(`Error saving audit entry: ${error.message}`));
    }
  }

  async findById(id: string): Promise<Result<AuditEntry | null, Error>> {
    try {
      const auditEntry = await this.prisma.auditEntry.findUnique({
        where: { id },
      });
      return success(auditEntry ? AuditEntry.create(auditEntry as any) : null);
    } catch (error: any) {
      return failure(new Error(`Error finding audit entry by ID: ${error.message}`));
    }
  }

  async find(query: AuditEntryQuery): Promise<Result<AuditEntry[], Error>> {
    try {
      const where: Prisma.AuditEntryWhereInput = {};
      if (query.entityType) where.entityType = query.entityType;
      if (query.entityId) where.entityId = query.entityId;
      if (query.changeType) where.changeType = query.changeType;
      if (query.changedByUserId) where.changedByUserId = query.changedByUserId;
      if (query.startDate || query.endDate) {
        where.timestamp = {};
        if (query.startDate) where.timestamp.gte = query.startDate;
        if (query.endDate) where.timestamp.lte = query.endDate;
      }

      const auditEntries = await this.prisma.auditEntry.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        ...(query.page && query.pageSize && { skip: (query.page - 1) * query.pageSize }),
        ...(query.pageSize && { take: query.pageSize }),
      });
      return success(auditEntries.map((entry) => AuditEntry.create(entry as any)));
    } catch (error: any) {
      return failure(new Error(`Error finding audit entries: ${error.message}`));
    }
  }

  async count(query: AuditEntryQuery): Promise<Result<number, Error>> {
    try {
      const where: Prisma.AuditEntryWhereInput = {};
      if (query.entityType) where.entityType = query.entityType;
      if (query.entityId) where.entityId = query.entityId;
      if (query.changeType) where.changeType = query.changeType;
      if (query.changedByUserId) where.changedByUserId = query.changedByUserId;
      if (query.startDate || query.endDate) {
        where.timestamp = {};
        if (query.startDate) where.timestamp.gte = query.startDate;
        if (query.endDate) where.timestamp.lte = query.endDate;
      }

      const count = await this.prisma.auditEntry.count({ where });
      return success(count);
    } catch (error: any) {
      return failure(new Error(`Error counting audit entries: ${error.message}`));
    }
  }
}
