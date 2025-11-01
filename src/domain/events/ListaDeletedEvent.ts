import { BaseDomainEvent } from './DomainEvent';

interface ListaDeletedEventPayload {
  listaId: string;
  deletedByUserId: string;
  deletedValue: Record<string, any>;
}

export class ListaDeletedEvent extends BaseDomainEvent {
  constructor(payload: ListaDeletedEventPayload) {
    super(payload.listaId, 'Lista', payload);
  }
}
