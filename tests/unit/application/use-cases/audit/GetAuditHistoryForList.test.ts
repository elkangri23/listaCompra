import { GetAuditHistoryForList } from '@application/use-cases/audit/GetAuditHistoryForList';
import { IAuditRepository } from '@application/ports/repositories/IAuditRepository';
import { AuditEntry } from '@domain/entities/AuditEntry';
import { success } from '@shared/result';

describe('GetAuditHistoryForList Use Case', () => {
  let auditRepository: IAuditRepository;
  let getAuditHistoryForList: GetAuditHistoryForList;

  beforeEach(() => {
    auditRepository = {
      find: jest.fn(),
      count: jest.fn(),
      save: jest.fn(),
      findById: jest.fn(),
    };
    getAuditHistoryForList = new GetAuditHistoryForList(auditRepository);
  });

  it('should return a paginated list of audit entries for a given listId', async () => {
    const listId = 'list-123';
    const auditEntries = [
      AuditEntry.create({ entityType: 'Lista', entityId: listId, changeType: 'CREATE', newValue: {} }),
      AuditEntry.create({ entityType: 'Lista', entityId: listId, changeType: 'UPDATE', newValue: {}, oldValue: {} }),
    ];

    (auditRepository.find as jest.Mock).mockResolvedValue(success(auditEntries));
    (auditRepository.count as jest.Mock).mockResolvedValue(success(2));

    const result = await getAuditHistoryForList.execute({ listId, page: 1, pageSize: 10 });

    expect(result.isSuccess).toBe(true);
    if (result.isSuccess) {
      expect(result.value.entries.length).toBe(2);
      expect(result.value.total).toBe(2);
      expect(result.value.page).toBe(1);
      expect(result.value.pageSize).toBe(10);
      expect(result.value.totalPages).toBe(1);
      expect(auditRepository.find).toHaveBeenCalledWith({
        entityType: 'Lista',
        entityId: listId,
        page: 1,
        pageSize: 10,
      });
    }
  });

  it('should return a validation error if listId is not provided', async () => {
    const result = await getAuditHistoryForList.execute({ listId: '' });

    expect(result.isFailure).toBe(true);
    if (result.isFailure) {
      expect(result.error.message).toContain('listId is required');
    }
  });

  it('should handle pagination correctly', async () => {
    (auditRepository.find as jest.Mock).mockResolvedValue(success([]));
    (auditRepository.count as jest.Mock).mockResolvedValue(success(25));

    await getAuditHistoryForList.execute({ listId: 'list-123', page: 3, pageSize: 5 });

    expect(auditRepository.find).toHaveBeenCalledWith(expect.objectContaining({ page: 3, pageSize: 5 }));
  });
});
