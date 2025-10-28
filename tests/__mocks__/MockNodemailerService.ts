/**
 * Mock del NodemailerService para tests unitarios y de integración
 * Elimina dependencia de Gmail SMTP real y acelera ejecución
 */

export interface MockEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface MockEmailStats {
  sent: number;
  failed: number;
  pending: number;
}

export class MockNodemailerService {
  private sentEmails: Array<{
    to: string;
    subject: string;
    timestamp: Date;
    type: string;
  }> = [];
  
  private failureRate: number = 0; // 0 = nunca falla, 1 = siempre falla
  private shouldFailConnection: boolean = false;

  constructor(_config?: any) {
    // Mock constructor - ignora configuración real
  }

  /**
   * Simula verificación de conexión SMTP
   */
  async verifyConnection(): Promise<boolean> {
    // Simula tiempo de conexión real (mucho más rápido)
    await new Promise(resolve => setTimeout(resolve, 50));
    
    if (this.shouldFailConnection) {
      throw new Error('Mock connection failed');
    }
    
    return true;
  }

  /**
   * Mock del envío de email de invitación
   */
  async sendInvitationEmail(
    to: string,
    _userName: string,
    _inviterName: string,
    listName: string,
    _invitationHash: string,
    _expiresAt: Date
  ): Promise<MockEmailResult> {
    // Simula tiempo de envío
    await new Promise(resolve => setTimeout(resolve, 10));

    // Validar email básico
    if (!to.includes('@')) {
      return {
        success: false,
        error: 'Invalid email address'
      };
    }

    // Simular fallos según failure rate
    if (Math.random() < this.failureRate) {
      return {
        success: false,
        error: 'Mock email delivery failed'
      };
    }

    const messageId = `mock-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    
    this.sentEmails.push({
      to,
      subject: `Invitación a ${listName}`,
      timestamp: new Date(),
      type: 'invitation'
    });

    return {
      success: true,
      messageId
    };
  }

  /**
   * Mock del envío de confirmación de registro
   */
  async sendRegistrationConfirmation(
    to: string,
    _userName: string,
    _confirmationToken: string
  ): Promise<MockEmailResult> {
    await new Promise(resolve => setTimeout(resolve, 10));

    if (!to.includes('@')) {
      return {
        success: false,
        error: 'Invalid email address'
      };
    }

    if (Math.random() < this.failureRate) {
      return {
        success: false,
        error: 'Mock email delivery failed'
      };
    }

    const messageId = `mock-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    
    this.sentEmails.push({
      to,
      subject: 'Confirma tu registro',
      timestamp: new Date(),
      type: 'registration'
    });

    return {
      success: true,
      messageId
    };
  }

  /**
   * Mock de notificación de cambios en lista
   */
  async sendListChangeNotification(
    to: string,
    _userName: string,
    listName: string,
    _changeType: string,
    _changeDescription: string
  ): Promise<MockEmailResult> {
    await new Promise(resolve => setTimeout(resolve, 10));

    if (!to.includes('@')) {
      return {
        success: false,
        error: 'Invalid email address'
      };
    }

    if (Math.random() < this.failureRate) {
      return {
        success: false,
        error: 'Mock email delivery failed'
      };
    }

    const messageId = `mock-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    
    this.sentEmails.push({
      to,
      subject: `Cambio en ${listName}`,
      timestamp: new Date(),
      type: 'notification'
    });

    return {
      success: true,
      messageId
    };
  }

  /**
   * Mock de estadísticas
   */
  async getStats(): Promise<MockEmailStats> {
    return {
      sent: this.sentEmails.length,
      failed: Math.floor(this.sentEmails.length * this.failureRate),
      pending: 0
    };
  }

  // Métodos de utilidad para tests
  getSentEmails() {
    return [...this.sentEmails];
  }

  clearSentEmails() {
    this.sentEmails = [];
  }

  setFailureRate(rate: number) {
    this.failureRate = Math.max(0, Math.min(1, rate));
  }

  setConnectionFailure(shouldFail: boolean) {
    this.shouldFailConnection = shouldFail;
  }

  getEmailsSentTo(email: string) {
    return this.sentEmails.filter(e => e.to === email);
  }

  getEmailsByType(type: string) {
    return this.sentEmails.filter(e => e.type === type);
  }
}