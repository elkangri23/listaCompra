import { BaseDomainEvent } from './DomainEvent';

interface ProductoUpdatedEventPayload {
  productoId: string;
  listaId: string;
  oldValue: Record<string, any>;
  newValue: Record<string, any>;
  changedByUserId: string;
  changedFields: string[];
}

export class ProductoUpdatedEvent extends BaseDomainEvent {
  constructor(payload: ProductoUpdatedEventPayload) {
    super(payload.productoId, 'Producto', payload);
  }
}
