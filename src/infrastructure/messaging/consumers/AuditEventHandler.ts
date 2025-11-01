import { DomainEvent } from '@domain/events/DomainEvent';
import { IAuditRepository } from '@application/ports/repositories/IAuditRepository';
import { AuditEntry } from '@domain/entities/AuditEntry';
import { ListaUpdatedEvent } from '@domain/events/ListaUpdatedEvent';
import { ProductoUpdatedEvent } from '@domain/events/ProductoUpdatedEvent';
import { ListaDeletedEvent } from '@domain/events/ListaDeletedEvent';
import { ProductoDeletedEvent } from '@domain/events/ProductoDeletedEvent';
import { Logger } from '@infrastructure/observability/logger/Logger';

export class AuditEventHandler {
  constructor(
    private readonly auditRepository: IAuditRepository,
    private readonly logger: Logger
  ) {}

  public async handle(event: DomainEvent): Promise<void> {
    try {
      let auditEntry: AuditEntry | null = null;

      switch (event.eventType) {
        case 'lista.updated': {
          const payload = (event as ListaUpdatedEvent).payload;
          auditEntry = AuditEntry.create({
            entityType: 'Lista',
            entityId: payload.listaId,
            changeType: 'UPDATE',
            changedByUserId: payload.changedByUserId,
            oldValue: payload.oldValue,
            newValue: payload.newValue,
            changedFields: payload.changedFields,
          });
          break;
        }
        case 'producto.updated': {
          const payload = (event as ProductoUpdatedEvent).payload;
          auditEntry = AuditEntry.create({
            entityType: 'Producto',
            entityId: payload.productoId,
            changeType: 'UPDATE',
            changedByUserId: payload.changedByUserId,
            oldValue: payload.oldValue,
            newValue: payload.newValue,
            changedFields: payload.changedFields,
          });
          break;
        }
        case 'lista.deleted': {
          const payload = (event as ListaDeletedEvent).payload;
          auditEntry = AuditEntry.create({
            entityType: 'Lista',
            entityId: payload.listaId,
            changeType: 'DELETE',
            changedByUserId: payload.deletedByUserId,
            oldValue: payload.deletedValue,
          });
          break;
        }
        case 'producto.deleted': {
          const payload = (event as ProductoDeletedEvent).payload;
          auditEntry = AuditEntry.create({
            entityType: 'Producto',
            entityId: payload.productoId,
            changeType: 'DELETE',
            changedByUserId: payload.deletedByUserId,
            oldValue: payload.deletedValue,
          });
          break;
        }
        default:
          // Ignore other events for audit purposes
          return;
      }

      if (auditEntry) {
        const result = await this.auditRepository.save(auditEntry);
        if (result.isFailure) {
          this.logger.error(`Failed to save audit entry for event ${event.eventType}: ${result.error.message}`);
        }
      }
    } catch (error: any) {
      this.logger.error(`Error handling audit event ${event.eventType}: ${error.message}`);
    }
  }
}
