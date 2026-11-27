/**
 * Implementación de IEmailService usando Resend
 * Servicio moderno de emails transaccionales
 */

import { Resend } from 'resend';
import type { 
  IEmailService, 
  EmailOptions, 
  EmailResult 
} from '@application/ports/external/IEmailService';
import {
  renderInvitationEmail,
  renderConfirmationEmail,
  renderNotificationEmail,
  renderVerificationCodeEmail,
  renderPasswordResetCodeEmail,
} from './templates/email-templates';

export interface EmailConfig {
  // API Key de Resend
  apiKey: string;
  
  // Configuración del remitente
  from: {
    name: string; // Nombre del remitente
    email: string; // Email del remitente (debe estar verificado en Resend)
  };
  
  // Opciones de retry
  maxRetries?: number;
  retryDelay?: number; // en milisegundos
}

export class NodemailerService implements IEmailService {
  private resend: Resend | null;
  private config: EmailConfig;
  private stats = {
    sent: 0,
    failed: 0,
    pending: 0
  };

  constructor(config: EmailConfig) {
    this.config = {
      maxRetries: 3,
      retryDelay: 1000,
      ...config
    };
    
    // Resend lanza si la API key está vacía, así que solo se crea el cliente
    // cuando hay clave. Sin clave el servicio queda deshabilitado y sendEmail
    // devuelve un resultado de fallo en lugar de romper la construcción
    // (antes, importar el servidor sin RESEND_API_KEY tumbaba el proceso).
    this.resend = this.config.apiKey ? new Resend(this.config.apiKey) : null;
  }

  async verifyConnection(): Promise<boolean> {
    try {
      // Resend no tiene un método de verificación directo
      // Simplemente verificamos que tenemos una API key
      return !!this.config.apiKey && this.config.apiKey.length > 0;
    } catch (error) {
      console.error('Error verificando conexión de email:', error);
      return false;
    }
  }

  async sendEmail(options: EmailOptions): Promise<EmailResult> {
    this.stats.pending++;
    
    try {
      const emailData = {
        from: `${this.config.from.name} <${this.config.from.email}>`,
        to: Array.isArray(options.to) ? options.to : [options.to],
        cc: options.cc ? (Array.isArray(options.cc) ? options.cc : [options.cc]) : undefined,
        bcc: options.bcc ? (Array.isArray(options.bcc) ? options.bcc : [options.bcc]) : undefined,
        subject: options.subject,
        text: options.text,
        html: options.html,
        reply_to: options.replyTo,
        attachments: options.attachments?.map(att => ({
          filename: att.filename,
          content: att.content instanceof Buffer ? att.content : Buffer.from(att.content),
          content_type: att.contentType
        }))
      };

      const result = await this.sendWithRetry(emailData);
      
      this.stats.pending--;
      this.stats.sent++;
      
      return {
        success: true,
        messageId: result.id
      };
    } catch (error) {
      this.stats.pending--;
      this.stats.failed++;
      
      console.error('Error enviando email:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido'
      };
    }
  }

  private async sendWithRetry(emailData: any): Promise<any> {
    // Sin cliente Resend (sin API key) no se puede enviar: fallar aquí hace
    // que sendEmail devuelva { success: false, error } en lugar de romper.
    if (!this.resend) {
      throw new Error('Email service not configured: missing RESEND_API_KEY');
    }

    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.config.maxRetries!; attempt++) {
      try {
        const { data, error } = await this.resend.emails.send(emailData);
        
        if (error) {
          throw new Error(error.message);
        }
        
        return data;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Error desconocido');
        
        if (attempt < this.config.maxRetries!) {
          const delay = this.config.retryDelay! * Math.pow(2, attempt - 1); // Backoff exponencial
          console.warn(`Reintento ${attempt}/${this.config.maxRetries} en ${delay}ms:`, lastError.message);
          await this.sleep(delay);
        }
      }
    }
    
    throw lastError;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async sendInvitationEmail(
    recipientEmail: string,
    recipientName: string,
    inviterName: string,
    listName: string,
    invitationHash: string,
    expiresAt: Date
  ): Promise<EmailResult> {
    const invitationUrl = `${process.env['FRONTEND_URL'] || 'http://localhost:3333'}/invitations/${invitationHash}`;
    
    const subject = `${inviterName} te ha invitado a colaborar en "${listName}"`;
    
    const html = this.generateInvitationHtml({
      recipientName,
      inviterName,
      listName,
      invitationUrl,
      expiresAt
    });

    const text = `
Hola ${recipientName},

${inviterName} te ha invitado a colaborar en la lista "${listName}".

Para acceder a la lista, haz clic en el siguiente enlace:
${invitationUrl}

Esta invitación expira el ${expiresAt.toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })}.

¡Empieza a colaborar ahora!

Saludos,
El equipo de Lista Compra Colaborativa
    `.trim();

    return this.sendEmail({
      to: recipientEmail,
      subject,
      text,
      html
    });
  }

  async sendListChangeNotification(
    recipientEmail: string,
    recipientName: string,
    listName: string,
    changeType: 'item_added' | 'item_removed' | 'item_updated' | 'list_updated',
    changeDetails: string
  ): Promise<EmailResult> {
    const changeMessages = {
      item_added: 'Se ha añadido un nuevo elemento',
      item_removed: 'Se ha eliminado un elemento', 
      item_updated: 'Se ha actualizado un elemento',
      list_updated: 'Se ha actualizado la lista'
    };

    const subject = `Cambios en "${listName}" - ${changeMessages[changeType]}`;
    
    const html = this.generateNotificationHtml({
      recipientName,
      listName,
      changeType,
      changeDetails
    });

    const text = `
Hola ${recipientName},

Ha habido cambios en la lista "${listName}":

${changeMessages[changeType]}: ${changeDetails}

Ve los cambios en: ${process.env['FRONTEND_URL'] || 'http://localhost:3333'}/lists

Saludos,
El equipo de Lista Compra Colaborativa
    `.trim();

    return this.sendEmail({
      to: recipientEmail,
      subject,
      text,
      html
    });
  }

  async sendRegistrationConfirmation(
    recipientEmail: string,
    recipientName: string,
    confirmationToken: string
  ): Promise<EmailResult> {
    const confirmationUrl = `${process.env['FRONTEND_URL'] || 'http://localhost:3333'}/confirm-email/${confirmationToken}`;
    
    const subject = 'Confirma tu cuenta - Lista Compra Colaborativa';
    
    const html = this.generateConfirmationHtml({
      recipientName,
      confirmationUrl
    });

    const text = `
Hola ${recipientName},

¡Bienvenido a Lista Compra Colaborativa!

Para completar tu registro y activar tu cuenta, confirma tu email haciendo clic en:
${confirmationUrl}

Si no creaste esta cuenta, puedes ignorar este email.

Saludos,
El equipo de Lista Compra Colaborativa
    `.trim();

    return this.sendEmail({
      to: recipientEmail,
      subject,
      text,
      html
    });
  }

  async sendVerificationCodeEmail(
    recipientEmail: string,
    recipientName: string,
    codigo: string
  ): Promise<EmailResult> {
    const subject = 'Tu código de verificación - Lista de Compra';

    const html = this.generateVerificationCodeHtml({
      recipientName,
      codigo,
    });

    const text = `
Hola ${recipientName},

Tu código de verificación para Lista de Compra es: ${codigo}

El código caduca en 15 minutos y solo sirve una vez.

Si no creaste esta cuenta, puedes ignorar este correo.

Saludos,
El equipo de Lista de Compra
    `.trim();

    return this.sendEmail({
      to: recipientEmail,
      subject,
      text,
      html
    });
  }

  async sendPasswordResetCodeEmail(
    recipientEmail: string,
    recipientName: string,
    codigo: string
  ): Promise<EmailResult> {
    const subject = 'Tu código para restablecer la contraseña - Lista de Compra';

    const html = this.generatePasswordResetCodeHtml({
      recipientName,
      codigo,
    });

    const text = `
Hola ${recipientName},

Has pedido restablecer tu contraseña en Lista de Compra. Tu código es: ${codigo}

El código caduca en 15 minutos y solo sirve una vez.

Si no pediste restablecer tu contraseña, puedes ignorar este correo: tu contraseña no cambia.

Saludos,
El equipo de Lista de Compra
    `.trim();

    return this.sendEmail({
      to: recipientEmail,
      subject,
      text,
      html
    });
  }

  async getStats(): Promise<{ sent: number; failed: number; pending: number; }> {
    return { ...this.stats };
  }

  private generateInvitationHtml(data: {
    recipientName: string;
    inviterName: string;
    listName: string;
    invitationUrl: string;
    expiresAt: Date;
  }): string {
    return renderInvitationEmail(data);
  }

  private generateNotificationHtml(data: {
    recipientName: string;
    listName: string;
    changeType: 'item_added' | 'item_removed' | 'item_updated' | 'list_updated';
    changeDetails: string;
  }): string {
    return renderNotificationEmail({
      ...data,
      listsUrl: `${process.env['FRONTEND_URL'] || 'http://localhost:3333'}/lists`,
    });
  }

  private generateConfirmationHtml(data: {
    recipientName: string;
    confirmationUrl: string;
  }): string {
    return renderConfirmationEmail(data);
  }

  private generateVerificationCodeHtml(data: {
    recipientName: string;
    codigo: string;
  }): string {
    return renderVerificationCodeEmail(data);
  }

  private generatePasswordResetCodeHtml(data: {
    recipientName: string;
    codigo: string;
  }): string {
    return renderPasswordResetCodeEmail(data);
  }

}