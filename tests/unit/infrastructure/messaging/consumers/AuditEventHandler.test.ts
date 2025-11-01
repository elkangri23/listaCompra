import { AuditEventHandler } from '@infrastructure/messaging/consumers/AuditEventHandler';
import { IAuditRepository } from '@application/ports/repositories/IAuditRepository';
import { Logger } from '@infrastructure/observability/logger/Logger';
import { ListaUpdatedEvent } from '@domain/events/ListaUpdatedEvent';
import { ProductoDeletedEvent } from '@domain/events/ProductoDeletedEvent';
import { AuditEntry } from '@domain/entities/AuditEntry';
import { success } from '@shared/result';
import { DomainEvent } from '@domain/events/DomainEvent';

describe('AuditEventHandler', () => {
  let auditRepository: IAuditRepository;
  let logger: Logger;
  let handler: AuditEventHandler;

  beforeEach(() => {
    auditRepository = { save: jest.fn() } as any;
    logger = { error: jest.fn() } as any;
    handler = new AuditEventHandler(auditRepository, logger);
  });

  it('should create and save an audit entry for a ListaUpdatedEvent', async () => {
    const payload = {
      listaId: 'list-1',
      oldValue: { nombre: 'Old Name' },
      newValue: { nombre: 'New Name' },
      changedByUserId: 'user-1',
      changedFields: ['nombre'],
    };
    const event = new ListaUpdatedEvent(payload);

    (auditRepository.save as jest.Mock).mockResolvedValue(success(null));

    await handler.handle(event);

    expect(auditRepository.save).toHaveBeenCalledTimes(1);
    const savedEntry: AuditEntry = (auditRepository.save as jest.Mock).mock.calls[0][0];
    expect(savedEntry.entityType).toBe('Lista');
    expect(savedEntry.entityId).toBe('list-1');
    expect(savedEntry.changeType).toBe('UPDATE');
    expect(savedEntry.changedByUserId).toBe('user-1');
    expect(savedEntry.oldValue).toEqual({ nombre: 'Old Name' });
    expect(savedEntry.newValue).toEqual({ nombre: 'New Name' });
    expect(savedEntry.changedFields).toEqual(['nombre']);
  });

  it('should create and save an audit entry for a ProductoDeletedEvent', async () => {
    const payload = {
      productoId: 'prod-1',
      listaId: 'list-1',
      deletedByUserId: 'user-2',
      deletedValue: { nombre: 'Deleted Product' },
    };
    const event = new ProductoDeletedEvent(payload);

    (auditRepository.save as jest.Mock).mockResolvedValue(success(null));

    await handler.handle(event);

    expect(auditRepository.save).toHaveBeenCalledTimes(1);
    const savedEntry: AuditEntry = (auditRepository.save as jest.Mock).mock.calls[0][0];
    expect(savedEntry.entityType).toBe('Producto');
    expect(savedEntry.entityId).toBe('prod-1');
    expect(savedEntry.changeType).toBe('DELETE');
    expect(savedEntry.changedByUserId).toBe('user-2');
    expect(savedEntry.oldValue).toEqual({ nombre: 'Deleted Product' });
  });

  it('should not do anything for unhandled events', async () => {
    class UnhandledEvent extends DomainEvent {
      constructor() { super('unhandled.event', {}); }
    }
    const unhandledEvent = new UnhandledEvent();

    await handler.handle(unhandledEvent);

    expect(auditRepository.save).not.toHaveBeenCalled();
  });

  it('should log an error if saving the audit entry fails', async () => {
    const payload = {
      listaId: 'list-fail',
      oldValue: { nombre: 'Old Name' },
      newValue: { nombre: 'New Name' },
      changedByUserId: 'user-fail',
      changedFields: ['nombre'],
    };
    const event = new ListaUpdatedEvent(payload);
    const error = new Error('DB Error');

    (auditRepository.save as jest.Mock).mockResolvedValue({ isFailure: true, error });

    await handler.handle(event);

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to save audit entry'),
      expect.stringContaining('DB Error')
    );
  });
});
