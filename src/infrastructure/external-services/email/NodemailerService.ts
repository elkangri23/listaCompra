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
  private resend: Resend;
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
    
    this.resend = new Resend(this.config.apiKey);
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
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Invitación a Lista Colaborativa</title>
    <style>
        body { font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: #007bff; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { padding: 30px; }
        .button { display: inline-block; padding: 12px 30px; background: #28a745; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        .expires { background: #fff3cd; border: 1px solid #ffeaa7; padding: 10px; border-radius: 4px; margin: 15px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🛒 Lista Compra Colaborativa</h1>
            <p>Invitación para colaborar</p>
        </div>
        <div class="content">
            <h2>¡Hola ${data.recipientName}!</h2>
            <p><strong>${data.inviterName}</strong> te ha invitado a colaborar en la lista <strong>"${data.listName}"</strong>.</p>
            <p>Con esta invitación podrás:</p>
            <ul>
                <li>Ver y editar elementos de la lista</li>
                <li>Marcar productos como comprados</li>
                <li>Colaborar en tiempo real</li>
            </ul>
            <div style="text-align: center;">
                <a href="${data.invitationUrl}" class="button">🎯 Acceder a la Lista</a>
            </div>
            <div class="expires">
                <strong>⏰ Importante:</strong> Esta invitación expira el ${data.expiresAt.toLocaleDateString('es-ES', {
                  year: 'numeric',
                  month: 'long', 
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}.
            </div>
        </div>
        <div class="footer">
            <p>Si no esperabas esta invitación, puedes ignorar este email.</p>
            <p>© 2025 Lista Compra Colaborativa</p>
        </div>
    </div>
</body>
</html>
    `.trim();
  }

  private generateNotificationHtml(data: {
    recipientName: string;
    listName: string;
    changeType: 'item_added' | 'item_removed' | 'item_updated' | 'list_updated';
    changeDetails: string;
  }): string {
    const icons: Record<typeof data.changeType, string> = {
      item_added: '➕',
      item_removed: '➖', 
      item_updated: '✏️',
      list_updated: '📝'
    };

    const colors: Record<typeof data.changeType, string> = {
      item_added: '#28a745',
      item_removed: '#dc3545',
      item_updated: '#ffc107', 
      list_updated: '#007bff'
    };

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cambios en Lista</title>
    <style>
        body { font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: ${colors[data.changeType]}; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { padding: 30px; }
        .change-box { background: #f8f9fa; border-left: 4px solid ${colors[data.changeType]}; padding: 15px; margin: 15px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${icons[data.changeType]} Cambios en Lista</h1>
        </div>
        <div class="content">
            <h2>¡Hola ${data.recipientName}!</h2>
            <p>Ha habido cambios en la lista <strong>"${data.listName}"</strong>.</p>
            <div class="change-box">
                <strong>Detalles del cambio:</strong><br>
                ${data.changeDetails}
            </div>
            <p>Ve todos los cambios en tu panel de listas.</p>
        </div>
        <div class="footer">
            <p>© 2025 Lista Compra Colaborativa</p>
        </div>
    </div>
</body>
</html>
    `.trim();
  }

  private generateConfirmationHtml(data: {
    recipientName: string;
    confirmationUrl: string;
  }): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Confirma tu cuenta</title>
    <style>
        body { font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: #28a745; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { padding: 30px; }
        .button { display: inline-block; padding: 12px 30px; background: #007bff; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>✅ ¡Bienvenido!</h1>
            <p>Lista Compra Colaborativa</p>
        </div>
        <div class="content">
            <h2>¡Hola ${data.recipientName}!</h2>
            <p>¡Bienvenido a Lista Compra Colaborativa! Estás a solo un paso de comenzar a colaborar en listas de compra.</p>
            <p>Para activar tu cuenta y comenzar a usar la plataforma, confirma tu email:</p>
            <div style="text-align: center;">
                <a href="${data.confirmationUrl}" class="button">🎯 Confirmar Email</a>
            </div>
            <p>Una vez confirmado tu email, podrás:</p>
            <ul>
                <li>Crear y gestionar listas de compra</li>
                <li>Compartir listas con familia y amigos</li>
                <li>Colaborar en tiempo real</li>
                <li>Recibir notificaciones de cambios</li>
            </ul>
        </div>
        <div class="footer">
            <p>Si no creaste esta cuenta, puedes ignorar este email.</p>
            <p>© 2025 Lista Compra Colaborativa</p>
        </div>
    </div>
</body>
</html>
    `.trim();
  }
}