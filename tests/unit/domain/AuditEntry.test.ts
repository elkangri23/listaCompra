import { AuditEntry } from '@domain/entities/AuditEntry';

describe('AuditEntry Entity', () => {
  it('should create an audit entry with default values', () => {
    const props = {
      entityType: 'Lista',
      entityId: 'list-123',
      changeType: 'CREATE' as const,
      changedByUserId: 'user-123',
      newValue: { nombre: 'Nueva Lista' },
    };

    const auditEntry = AuditEntry.create(props);

    expect(auditEntry.id).toBeDefined();
    expect(auditEntry.timestamp).toBeInstanceOf(Date);
    expect(auditEntry.entityType).toBe('Lista');
    expect(auditEntry.changeType).toBe('CREATE');
    expect(auditEntry.changedByUserId).toBe('user-123');
    expect(auditEntry.newValue).toEqual({ nombre: 'Nueva Lista' });
    expect(auditEntry.oldValue).toBeUndefined();
    expect(auditEntry.changedFields).toBeUndefined();
  });

  it('should create an audit entry for an UPDATE with all fields', () => {
    const props = {
      entityType: 'Producto',
      entityId: 'prod-456',
      changeType: 'UPDATE' as const,
      changedByUserId: 'user-456',
      oldValue: { nombre: 'Leche' },
      newValue: { nombre: 'Leche Descremada' },
      changedFields: ['nombre'],
    };

    const auditEntry = AuditEntry.create(props);

    expect(auditEntry.changeType).toBe('UPDATE');
    expect(auditEntry.oldValue).toEqual({ nombre: 'Leche' });
    expect(auditEntry.newValue).toEqual({ nombre: 'Leche Descremada' });
    expect(auditEntry.changedFields).toEqual(['nombre']);
  });

  it('should create an audit entry for a DELETE', () => {
    const props = {
      entityType: 'Lista',
      entityId: 'list-789',
      changeType: 'DELETE' as const,
      changedByUserId: 'user-789',
      oldValue: { nombre: 'Lista a borrar' },
    };

    const auditEntry = AuditEntry.create(props);

    expect(auditEntry.changeType).toBe('DELETE');
    expect(auditEntry.oldValue).toEqual({ nombre: 'Lista a borrar' });
    expect(auditEntry.newValue).toBeUndefined();
  });

  it('should serialize to JSON correctly', () => {
    const now = new Date();
    const props = {
      id: 'audit-1',
      entityType: 'Lista',
      entityId: 'list-123',
      changeType: 'CREATE' as const,
      changedByUserId: 'user-123',
      timestamp: now,
      newValue: { nombre: 'Mi Lista' },
    };

    const auditEntry = AuditEntry.create(props);
    const json = auditEntry.toJSON();

    expect(json).toEqual({
      id: 'audit-1',
      entityType: 'Lista',
      entityId: 'list-123',
      changeType: 'CREATE',
      changedByUserId: 'user-123',
      timestamp: now.toISOString(),
      newValue: { nombre: 'Mi Lista' },
      oldValue: undefined,
      changedFields: undefined,
    });
  });
});
