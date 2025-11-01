import { PrismaClient } from '@prisma/client';
import { PrismaAuditRepository } from '@infrastructure/persistence/prisma/repositories/PrismaAuditRepository';
import { AuditEntry } from '@domain/entities/AuditEntry';

describe('PrismaAuditRepository Integration Test', () => {
  let prisma: PrismaClient;
  let repository: PrismaAuditRepository;

  beforeAll(() => {
    prisma = new PrismaClient();
    repository = new PrismaAuditRepository(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.auditEntry.deleteMany({});
  });

  it('should save and find an audit entry by ID', async () => {
    const entry = AuditEntry.create({
      entityType: 'TestEntity',
      entityId: 'test-1',
      changeType: 'CREATE',
      changedByUserId: 'user-test',
      newValue: { data: 'sample' },
    });

    await repository.save(entry);

    const findResult = await repository.findById(entry.id);

    expect(findResult.isSuccess).toBe(true);
    if (findResult.isSuccess) {
      expect(findResult.value).toBeInstanceOf(AuditEntry);
      expect(findResult.value?.id).toBe(entry.id);
      expect(findResult.value?.entityType).toBe('TestEntity');
    }
  });

  it('should find audit entries based on a query', async () => {
    await prisma.auditEntry.createMany({
      data: [
        { entityType: 'TypeA', entityId: '1', changeType: 'CREATE' },
        { entityType: 'TypeA', entityId: '2', changeType: 'UPDATE' },
        { entityType: 'TypeB', entityId: '3', changeType: 'CREATE' },
      ],
    });

    const query = { entityType: 'TypeA' };
    const findResult = await repository.find(query);
    const countResult = await repository.count(query);

    expect(findResult.isSuccess).toBe(true);
    expect(countResult.isSuccess).toBe(true);

    if (findResult.isSuccess && countResult.isSuccess) {
      expect(findResult.value.length).toBe(2);
      expect(countResult.value).toBe(2);
    }
  });

  it('should paginate results correctly', async () => {
    const entries = Array.from({ length: 15 }, (_, i) => ({
      entityType: 'Paginate',
      entityId: `${i}`,
      changeType: 'CREATE',
    }));
    await prisma.auditEntry.createMany({ data: entries });

    const query = { entityType: 'Paginate', page: 2, pageSize: 5 };
    const findResult = await repository.find(query);

    expect(findResult.isSuccess).toBe(true);
    if (findResult.isSuccess) {
      expect(findResult.value.length).toBe(5);
    }
  });
});
