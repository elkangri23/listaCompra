import { BaseDomainEvent } from './DomainEvent';

interface ProductoDeletedEventPayload {
  productoId: string;
  listaId: string;
  deletedByUserId: string;
  deletedValue: Record<string, any>;
}

export class ProductoDeletedEvent extends BaseDomainEvent {
  constructor(payload: ProductoDeletedEventPayload) {
    super(payload.productoId, 'Producto', payload);
  }
}
