/**
 * Consumer para procesar eventos de notificaciones y enviar emails
 * Procesa eventos de invitaciones, cambios en listas, registros, etc.
 */

import { MessageHandler } from '../rabbitmq/RabbitMQConsumer';
import type { IEmailService } from '../../../application/ports/external/IEmailService';
import type { IUsuarioRepository } from '../../../application/ports/repositories/IUsuarioRepository';
import type { IListaRepository } from '../../../application/ports/repositories/IListaRepository';
import amqp from 'amqplib';

// Tipos de eventos que maneja este consumer
export interface BaseNotificationEvent {
  eventType: string;
  eventId: string;
  timestamp: string;
  aggregateId: string;
  aggregateType: string;
  version: number;
}

export interface ListaCompartidaEvent extends BaseNotificationEvent {
  eventType: 'ListaCompartida';
  data: {
    listaId: string;
    usuarioComparteId: string;
    usuarioInvitadoEmail: string;
    tipoPermiso: 'LECTURA' | 'ESCRITURA';
    invitacionId: string;
    hash: string;
    expiraEn: string; // ISO string
  };
}

export interface UsuarioRegistradoEvent extends BaseNotificationEvent {
  eventType: 'UsuarioRegistrado';
  data: {
    usuarioId: string;
    email: string;
    nombre: string;
    confirmationToken?: string;
  };
}

export interface ProductoAnadidoEvent extends BaseNotificationEvent {
  eventType: 'ProductoAnadido';
  data: {
    listaId: string;
    productoId: string;
    nombre: string;
    usuarioId: string; // Quien añadió el producto
  };
}

export interface ListaActualizadaEvent extends BaseNotificationEvent {
  eventType: 'ListaActualizada';
  data: {
    listaId: string;
    cambios: string;
    usuarioId: string; // Quien hizo el cambio
  };
}

export type NotificationEvent = 
  | ListaCompartidaEvent 
  | UsuarioRegistradoEvent 
  | ProductoAnadidoEvent 
  | ListaActualizadaEvent;

export class NotificationConsumer implements MessageHandler<NotificationEvent> {
  constructor(
    private emailService: IEmailService,
    private usuarioRepository: IUsuarioRepository,
    private listaRepository: IListaRepository
  ) {}

  async handle(event: NotificationEvent, _message: amqp.ConsumeMessage): Promise<void> {
    console.log(`Procesando evento de notificación: ${event.eventType} (ID: ${event.eventId})`);

    try {
      switch (event.eventType) {
        case 'ListaCompartida':
          await this.handleListaCompartida(event as ListaCompartidaEvent);
          break;
        
        case 'UsuarioRegistrado':
          await this.handleUsuarioRegistrado(event as UsuarioRegistradoEvent);
          break;
        
        case 'ProductoAnadido':
          await this.handleProductoAnadido(event as ProductoAnadidoEvent);
          break;
        
        case 'ListaActualizada':
          await this.handleListaActualizada(event as ListaActualizadaEvent);
          break;
        
        default:
          console.warn(`Tipo de evento no manejado: ${(event as any).eventType}`);
      }

      console.log(`Evento procesado exitosamente: ${event.eventType} (ID: ${event.eventId})`);
    } catch (error) {
      console.error(`Error procesando evento ${event.eventType} (ID: ${event.eventId}):`, error);
      throw error; // Re-lanzar para que el consumer maneje el retry
    }
  }

  private async handleListaCompartida(event: ListaCompartidaEvent): Promise<void> {
    const { data } = event;

    try {
      // Obtener información del usuario que comparte
      const usuarioComparteResult = await this.usuarioRepository.findById(data.usuarioComparteId);
      if (usuarioComparteResult.isFailure || !usuarioComparteResult.value) {
        throw new Error(`Usuario que comparte no encontrado: ${data.usuarioComparteId}`);
      }
      const usuarioComparte = usuarioComparteResult.value;

      // Obtener información de la lista
      const listaResult = await this.listaRepository.findById(data.listaId);
      if (listaResult.isFailure || !listaResult.value) {
        throw new Error(`Lista no encontrada: ${data.listaId}`);
      }
      const lista = listaResult.value;

      // Enviar email de invitación
      const emailResult = await this.emailService.sendInvitationEmail(
        data.usuarioInvitadoEmail,
        this.extractNameFromEmail(data.usuarioInvitadoEmail), // Extraer nombre del email si no lo tenemos
        usuarioComparte.nombreCompleto || usuarioComparte.nombre,
        lista.nombre,
        data.hash,
        new Date(data.expiraEn)
      );

      if (!emailResult.success) {
        throw new Error(`Error enviando email de invitación: ${emailResult.error}`);
      }

      console.log(`Email de invitación enviado exitosamente a ${data.usuarioInvitadoEmail}`);
    } catch (error) {
      console.error('Error en handleListaCompartida:', error);
      throw error;
    }
  }

  private async handleUsuarioRegistrado(event: UsuarioRegistradoEvent): Promise<void> {
    const { data } = event;

    try {
      // Solo enviar confirmación si hay token de confirmación
      if (data.confirmationToken) {
        const emailResult = await this.emailService.sendRegistrationConfirmation(
          data.email,
          data.nombre,
          data.confirmationToken
        );

        if (!emailResult.success) {
          throw new Error(`Error enviando email de confirmación: ${emailResult.error}`);
        }

        console.log(`Email de confirmación enviado exitosamente a ${data.email}`);
      } else {
        console.log(`Usuario ${data.email} registrado sin token de confirmación, omitiendo email`);
      }
    } catch (error) {
      console.error('Error en handleUsuarioRegistrado:', error);
      throw error;
    }
  }

  private async handleProductoAnadido(event: ProductoAnadidoEvent): Promise<void> {
    const { data } = event;

    try {
      // Obtener información de la lista
      const listaResult = await this.listaRepository.findById(data.listaId);
      if (listaResult.isFailure || !listaResult.value) {
        throw new Error(`Lista no encontrada: ${data.listaId}`);
      }
      const lista = listaResult.value;

      // Obtener información del usuario que añadió el producto
      const usuarioResult = await this.usuarioRepository.findById(data.usuarioId);
      if (usuarioResult.isFailure || !usuarioResult.value) {
        throw new Error(`Usuario no encontrado: ${data.usuarioId}`);
      }
      const usuario = usuarioResult.value;

      // Obtener todos los usuarios con permisos en la lista (excepto el que añadió)
      const colaboradores = await this.getListCollaborators(data.listaId, data.usuarioId);

      // Enviar notificación a cada colaborador
      for (const colaborador of colaboradores) {
        try {
          const emailResult = await this.emailService.sendListChangeNotification(
            colaborador.email,
            colaborador.nombre,
            lista.nombre,
            'item_added',
            `${usuario.nombreCompleto || usuario.nombre} añadió "${data.nombre}" a la lista`
          );

          if (!emailResult.success) {
            console.error(`Error enviando notificación a ${colaborador.email}: ${emailResult.error}`);
          } else {
            console.log(`Notificación de producto añadido enviada a ${colaborador.email}`);
          }
        } catch (error) {
          console.error(`Error procesando notificación para ${colaborador.email}:`, error);
          // Continuar con el siguiente colaborador
        }
      }
    } catch (error) {
      console.error('Error en handleProductoAnadido:', error);
      throw error;
    }
  }

  private async handleListaActualizada(event: ListaActualizadaEvent): Promise<void> {
    const { data } = event;

    try {
      // Obtener información de la lista
      const listaResult = await this.listaRepository.findById(data.listaId);
      if (listaResult.isFailure || !listaResult.value) {
        throw new Error(`Lista no encontrada: ${data.listaId}`);
      }
      const lista = listaResult.value;

      // Obtener información del usuario que hizo el cambio
      const usuarioResult = await this.usuarioRepository.findById(data.usuarioId);
      if (usuarioResult.isFailure || !usuarioResult.value) {
        throw new Error(`Usuario no encontrado: ${data.usuarioId}`);
      }
      const usuario = usuarioResult.value;

      // Obtener todos los usuarios con permisos en la lista (excepto el que hizo el cambio)
      const colaboradores = await this.getListCollaborators(data.listaId, data.usuarioId);

      // Enviar notificación a cada colaborador
      for (const colaborador of colaboradores) {
        try {
          const emailResult = await this.emailService.sendListChangeNotification(
            colaborador.email,
            colaborador.nombre,
            lista.nombre,
            'list_updated',
            `${usuario.nombreCompleto || usuario.nombre} actualizó la lista: ${data.cambios}`
          );

          if (!emailResult.success) {
            console.error(`Error enviando notificación a ${colaborador.email}: ${emailResult.error}`);
          } else {
            console.log(`Notificación de lista actualizada enviada a ${colaborador.email}`);
          }
        } catch (error) {
          console.error(`Error procesando notificación para ${colaborador.email}:`, error);
          // Continuar con el siguiente colaborador
        }
      }
    } catch (error) {
      console.error('Error en handleListaActualizada:', error);
      throw error;
    }
  }

  private async getListCollaborators(listaId: string, excludeUserId: string): Promise<Array<{email: string, nombre: string}>> {
    try {
      // TODO: Implementar método en repositorio para obtener colaboradores
      // Por ahora retornamos array vacío como placeholder
      console.log(`Obteniendo colaboradores de lista ${listaId}, excluyendo usuario ${excludeUserId}`);
      return [];
    } catch (error) {
      console.error('Error obteniendo colaboradores:', error);
      return [];
    }
  }

  private extractNameFromEmail(email: string): string {
    // Extraer nombre del email como fallback
    const localPart = email.split('@')[0];
    if (!localPart) {
      return 'Usuario';
    }
    
    return localPart
      .replace(/[._-]/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }
}