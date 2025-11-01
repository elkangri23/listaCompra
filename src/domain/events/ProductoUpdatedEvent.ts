import { DomainEvent } from './DomainEvent';

interface ProductoUpdatedEventPayload {
  productoId: string;
  listaId: string;
  oldValue: Record<string, any>;
  newValue: Record<string, any>;
  changedByUserId: string;
  changedFields: string[];
}

export class ProductoUpdatedEvent extends DomainEvent<ProductoUpdatedEventPayload> {
  constructor(payload: ProductoUpdatedEventPayload) {
    super('producto.updated', payload);
  }
}
