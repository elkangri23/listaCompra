import { DomainEvent } from './DomainEvent';

interface ListaDeletedEventPayload {
  listaId: string;
  deletedByUserId: string;
  deletedValue: Record<string, any>;
}

export class ListaDeletedEvent extends DomainEvent<ListaDeletedEventPayload> {
  constructor(payload: ListaDeletedEventPayload) {
    super('lista.deleted', payload);
  }
}
