/**
 * Evento de dominio: Usuario Registrado
 * Se dispara cuando un nuevo usuario se registra en el sistema
 */

import { BaseDomainEvent } from './DomainEvent';

export interface UsuarioRegistradoData {
  email: string;
  nombre: string;
  apellidos?: string;
  emailVerificado: boolean;
  fechaRegistro: string; // ISO string
}

export class UsuarioRegistrado extends BaseDomainEvent {
  constructor(
    usuarioId: string,
    data: UsuarioRegistradoData,
    context?: {
      userId?: string;
      correlationId?: string;
      causationId?: string;
      userAgent?: string;
      ipAddress?: string;
    }
  ) {
    super(
      usuarioId,
      'Usuario',
      {
        email: data.email,
        nombre: data.nombre,
        apellidos: data.apellidos,
        emailVerificado: data.emailVerificado,
        fechaRegistro: data.fechaRegistro,
      },
      context
    );
  }

  /**
   * Datos específicos del evento tipados
   */
  get usuarioData(): UsuarioRegistradoData {
    return {
      email: this.eventData['email'],
      nombre: this.eventData['nombre'],
      apellidos: this.eventData['apellidos'],
      emailVerificado: this.eventData['emailVerificado'],
      fechaRegistro: this.eventData['fechaRegistro'],
    };
  }

  /**
   * Crea el evento desde JSON
   */
  static override fromJSON(json: Record<string, any>): UsuarioRegistrado {
    return new UsuarioRegistrado(
      json['aggregateId'],
      {
        email: json['eventData']['email'],
        nombre: json['eventData']['nombre'],
        apellidos: json['eventData']['apellidos'],
        emailVerificado: json['eventData']['emailVerificado'],
        fechaRegistro: json['eventData']['fechaRegistro'],
      },
      json['eventContext']
    );
  }
}