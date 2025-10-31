/**
 * Evento de dominio: Lista Creada
 * Se dispara cuando se crea una nueva lista de compras
 */

import { BaseDomainEvent } from './DomainEvent';

export interface ListaCreadaData {
  nombre: string;
  descripcion?: string;
  propietarioId: string;
  tiendaId?: string;
  fechaCreacion: string; // ISO string
}

export class ListaCreada extends BaseDomainEvent {
  constructor(
    listaId: string,
    data: ListaCreadaData,
    context?: {
      userId?: string;
      correlationId?: string;
      causationId?: string;
      userAgent?: string;
      ipAddress?: string;
    }
  ) {
    super(
      listaId,
      'Lista',
      {
        nombre: data.nombre,
        descripcion: data.descripcion,
        propietarioId: data.propietarioId,
        tiendaId: data.tiendaId,
        fechaCreacion: data.fechaCreacion,
      },
      context
    );
  }

  /**
   * Datos específicos del evento tipados
   */
  get listaData(): ListaCreadaData {
    return {
      nombre: this.eventData['nombre'],
      descripcion: this.eventData['descripcion'],
      propietarioId: this.eventData['propietarioId'],
      tiendaId: this.eventData['tiendaId'],
      fechaCreacion: this.eventData['fechaCreacion'],
    };
  }

  /**
   * Crea el evento desde JSON
   */
  static override fromJSON(json: Record<string, any>): ListaCreada {
    return new ListaCreada(
      json['aggregateId'],
      {
        nombre: json['eventData']['nombre'],
        descripcion: json['eventData']['descripcion'],
        propietarioId: json['eventData']['propietarioId'],
        tiendaId: json['eventData']['tiendaId'],
        fechaCreacion: json['eventData']['fechaCreacion'],
      },
      json['eventContext']
    );
  }
}