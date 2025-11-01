import { DomainEvent } from './DomainEvent';

interface ProductoDeletedEventPayload {
  productoId: string;
  listaId: string;
  deletedByUserId: string;
  deletedValue: Record<string, any>;
}

export class ProductoDeletedEvent extends DomainEvent<ProductoDeletedEventPayload> {
  constructor(payload: ProductoDeletedEventPayload) {
    super('producto.deleted', payload);
  }
}
