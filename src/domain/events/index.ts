/**
 * Exportaciones de eventos de dominio
 */

// Interfaz y clase base
export { DomainEvent, BaseDomainEvent } from './DomainEvent';

// Eventos específicos
export { UsuarioRegistrado, type UsuarioRegistradoData } from './UsuarioRegistrado';
export { ListaCreada, type ListaCreadaData } from './ListaCreada';
export { ListaCompartida, type ListaCompartidaData } from './ListaCompartida';
export { ProductoAnadido, type ProductoAnadidoData } from './ProductoAnadido';
export { InvitacionEnviada, type InvitacionEnviadaData } from './InvitacionEnviada';

// Importaciones para el factory
import { DomainEvent } from './DomainEvent';
import { UsuarioRegistrado } from './UsuarioRegistrado';
import { ListaCreada } from './ListaCreada';
import { ListaCompartida } from './ListaCompartida';
import { ProductoAnadido } from './ProductoAnadido';
import { InvitacionEnviada } from './InvitacionEnviada';

// Factory para crear eventos desde JSON
export class DomainEventFactory {
  static fromJSON(json: Record<string, any>): DomainEvent {
    const eventType = json['eventType'];
    
    switch (eventType) {
      case 'UsuarioRegistrado':
        return UsuarioRegistrado.fromJSON(json);
      case 'ListaCreada':
        return ListaCreada.fromJSON(json);
      case 'ListaCompartida':
        return ListaCompartida.fromJSON(json);
      case 'ProductoAnadido':
        return ProductoAnadido.fromJSON(json);
      case 'InvitacionEnviada':
        return InvitacionEnviada.fromJSON(json);
      default:
        throw new Error(`Unknown event type: ${eventType}`);
    }
  }

  /**
   * Obtiene todos los tipos de eventos registrados
   */
  static getEventTypes(): string[] {
    return [
      'UsuarioRegistrado',
      'ListaCreada',
      'ListaCompartida',
      'ProductoAnadido',
      'InvitacionEnviada',
    ];
  }
}