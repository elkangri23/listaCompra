/**
 * Evento de dominio: Lista Compartida
 * Se dispara cuando se comparte una lista con otros usuarios
 */

import { BaseDomainEvent } from './DomainEvent';

export interface ListaCompartidaData {
  listaId: string;
  propietarioId: string;
  hashCompartir: string;
  fechaCompartir: string; // ISO string
  nombreLista: string;
  emailsInvitados?: string[]; // Si se especifican emails concretos
}

export class ListaCompartida extends BaseDomainEvent {
  constructor(
    listaId: string,
    data: ListaCompartidaData,
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
        listaId: data.listaId,
        propietarioId: data.propietarioId,
        hashCompartir: data.hashCompartir,
        fechaCompartir: data.fechaCompartir,
        nombreLista: data.nombreLista,
        emailsInvitados: data.emailsInvitados,
      },
      context
    );
  }

  /**
   * Datos específicos del evento tipados
   */
  get compartirData(): ListaCompartidaData {
    return {
      listaId: this.eventData['listaId'],
      propietarioId: this.eventData['propietarioId'],
      hashCompartir: this.eventData['hashCompartir'],
      fechaCompartir: this.eventData['fechaCompartir'],
      nombreLista: this.eventData['nombreLista'],
      emailsInvitados: this.eventData['emailsInvitados'],
    };
  }

  /**
   * Crea el evento desde JSON
   */
  static override fromJSON(json: Record<string, any>): ListaCompartida {
    return new ListaCompartida(
      json['aggregateId'],
      {
        listaId: json['eventData']['listaId'],
        propietarioId: json['eventData']['propietarioId'],
        hashCompartir: json['eventData']['hashCompartir'],
        fechaCompartir: json['eventData']['fechaCompartir'],
        nombreLista: json['eventData']['nombreLista'],
        emailsInvitados: json['eventData']['emailsInvitados'],
      },
      json['eventContext']
    );
  }
}