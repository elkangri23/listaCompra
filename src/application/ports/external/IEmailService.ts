/**
 * Puerto para servicio de email
 * Abstrae el envío de emails independiente del proveedor (Gmail, Outlook, SMTP)
 */

export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
}

export interface EmailOptions {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  text?: string;
  html?: string;
  attachments?: EmailAttachment[];
  replyTo?: string;
  priority?: 'high' | 'normal' | 'low';
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  rejectedRecipients?: string[];
}

export interface IEmailService {
  /**
   * Envía un email
   */
  sendEmail(options: EmailOptions): Promise<EmailResult>;

  /**
   * Envía email de invitación a lista compartida
   */
  sendInvitationEmail(
    recipientEmail: string,
    recipientName: string,
    inviterName: string,
    listName: string,
    invitationHash: string,
    expiresAt: Date
  ): Promise<EmailResult>;

  /**
   * Envía email de notificación de cambios en lista
   */
  sendListChangeNotification(
    recipientEmail: string,
    recipientName: string,
    listName: string,
    changeType: 'item_added' | 'item_removed' | 'item_updated' | 'list_updated',
    changeDetails: string
  ): Promise<EmailResult>;

  /**
   * Envía email de confirmación de registro
   */
  sendRegistrationConfirmation(
    recipientEmail: string,
    recipientName: string,
    confirmationToken: string
  ): Promise<EmailResult>;

  /**
   * Verifica conectividad del servicio de email
   */
  verifyConnection(): Promise<boolean>;

  /**
   * Obtiene estadísticas de envío
   */
  getStats(): Promise<{
    sent: number;
    failed: number;
    pending: number;
  }>;
}