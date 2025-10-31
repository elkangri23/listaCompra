/**
 * Evento de dominio: Lista Compartida
 * Se dispara cuando se comparte una lista con otros usuarios
 */

import { BaseDomainEvent } from './DomainEvent';

export interface ListaCompartidaData {
  listaId: string;
  propietarioId: string;
  invitacionId: string;
  hashCompartir: string;
  tipoPermiso: 'LECTURA' | 'ESCRITURA';
  fechaCompartir: string; // ISO string
  expiraEn: string; // ISO string
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
        invitacionId: data.invitacionId,
        hashCompartir: data.hashCompartir,
        tipoPermiso: data.tipoPermiso,
        fechaCompartir: data.fechaCompartir,
        expiraEn: data.expiraEn,
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
      invitacionId: this.eventData['invitacionId'],
      hashCompartir: this.eventData['hashCompartir'],
      tipoPermiso: this.eventData['tipoPermiso'],
      fechaCompartir: this.eventData['fechaCompartir'],
      expiraEn: this.eventData['expiraEn'],
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
        invitacionId: json['eventData']['invitacionId'],
        hashCompartir: json['eventData']['hashCompartir'],
        tipoPermiso: json['eventData']['tipoPermiso'],
        fechaCompartir: json['eventData']['fechaCompartir'],
        expiraEn: json['eventData']['expiraEn'],
        nombreLista: json['eventData']['nombreLista'],
        emailsInvitados: json['eventData']['emailsInvitados'],
      },
      json['eventContext']
    );
  }
}