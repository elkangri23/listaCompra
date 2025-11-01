import { DomainEvent } from './DomainEvent';

interface ListaUpdatedEventPayload {
  listaId: string;
  oldValue: Record<string, any>;
  newValue: Record<string, any>;
  changedByUserId: string;
  changedFields: string[];
}

export class ListaUpdatedEvent extends DomainEvent<ListaUpdatedEventPayload> {
  constructor(payload: ListaUpdatedEventPayload) {
    super('lista.updated', payload);
  }
}
