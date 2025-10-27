/**
 * Evento de dominio: Invitación Enviada
 * Se dispara cuando se envía una invitación para acceder a una lista compartida
 */

import { BaseDomainEvent } from './DomainEvent';

export interface InvitacionEnviadaData {
  invitacionId: string;
  listaId: string;
  propietarioId: string;
  emailDestino: string;
  hashAcceso: string;
  tipoPermiso: 'lectura' | 'escritura';
  fechaExpiracion?: string; // ISO string
  fechaEnvio: string; // ISO string
  nombreLista: string;
  nombrePropietario: string;
}

export class InvitacionEnviada extends BaseDomainEvent {
  constructor(
    invitacionId: string,
    data: InvitacionEnviadaData,
    context?: {
      userId?: string;
      correlationId?: string;
      causationId?: string;
      userAgent?: string;
      ipAddress?: string;
    }
  ) {
    super(
      invitacionId,
      'Invitacion',
      {
        invitacionId: data.invitacionId,
        listaId: data.listaId,
        propietarioId: data.propietarioId,
        emailDestino: data.emailDestino,
        hashAcceso: data.hashAcceso,
        tipoPermiso: data.tipoPermiso,
        fechaExpiracion: data.fechaExpiracion,
        fechaEnvio: data.fechaEnvio,
        nombreLista: data.nombreLista,
        nombrePropietario: data.nombrePropietario,
      },
      context
    );
  }

  /**
   * Datos específicos del evento tipados
   */
  get invitacionData(): InvitacionEnviadaData {
    return {
      invitacionId: this.eventData['invitacionId'],
      listaId: this.eventData['listaId'],
      propietarioId: this.eventData['propietarioId'],
      emailDestino: this.eventData['emailDestino'],
      hashAcceso: this.eventData['hashAcceso'],
      tipoPermiso: this.eventData['tipoPermiso'],
      fechaExpiracion: this.eventData['fechaExpiracion'],
      fechaEnvio: this.eventData['fechaEnvio'],
      nombreLista: this.eventData['nombreLista'],
      nombrePropietario: this.eventData['nombrePropietario'],
    };
  }

  /**
   * Crea el evento desde JSON
   */
  static override fromJSON(json: Record<string, any>): InvitacionEnviada {
    return new InvitacionEnviada(
      json['aggregateId'],
      {
        invitacionId: json['eventData']['invitacionId'],
        listaId: json['eventData']['listaId'],
        propietarioId: json['eventData']['propietarioId'],
        emailDestino: json['eventData']['emailDestino'],
        hashAcceso: json['eventData']['hashAcceso'],
        tipoPermiso: json['eventData']['tipoPermiso'],
        fechaExpiracion: json['eventData']['fechaExpiracion'],
        fechaEnvio: json['eventData']['fechaEnvio'],
        nombreLista: json['eventData']['nombreLista'],
        nombrePropietario: json['eventData']['nombrePropietario'],
      },
      json['eventContext']
    );
  }
}