import { BaseDomainEvent } from './DomainEvent';

interface ListaUpdatedEventPayload {
  listaId: string;
  oldValue: Record<string, any>;
  newValue: Record<string, any>;
  changedByUserId: string;
  changedFields: string[];
}

export class ListaUpdatedEvent extends BaseDomainEvent {
  constructor(payload: ListaUpdatedEventPayload) {
    super(payload.listaId, 'Lista', payload);
  }
}
