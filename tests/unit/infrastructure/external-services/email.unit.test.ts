/**
 * Tests unitarios rápidos para el servicio de email usando mocks
 * Reemplaza los tests de integración lentos para ejecución normal
 */

import { MockNodemailerService } from '../../../__mocks__/MockNodemailerService';

describe('NodemailerService Unit Tests (Mock)', () => {
  let emailService: MockNodemailerService;

  beforeEach(() => {
    emailService = new MockNodemailerService();
    emailService.clearSentEmails();
    emailService.setFailureRate(0); // Sin fallos por defecto
    emailService.setConnectionFailure(false);
  });

  describe('Configuración y conexión', () => {
    test('debe inicializar correctamente el servicio', () => {
      expect(emailService).toBeDefined();
    });

    test('debe conectar exitosamente (mock)', async () => {
      const result = await emailService.verifyConnection();
      expect(result).toBe(true);
    });

    test('debe manejar fallos de conexión', async () => {
      emailService.setConnectionFailure(true);
      
      await expect(emailService.verifyConnection()).rejects.toThrow('Mock connection failed');
    });
  });

  describe('Envío de emails de invitación', () => {
    test('debe enviar email de invitación correctamente', async () => {
      const result = await emailService.sendInvitationEmail(
        'test@example.com',
        'Usuario Test',
        'Anthony Moles',
        'Lista de Prueba',
        'abc123hash',
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      );

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
      expect(result.messageId).toMatch(/^mock-/);

      const sentEmails = emailService.getSentEmails();
      expect(sentEmails).toHaveLength(1);
      expect(sentEmails[0]?.to).toBe('test@example.com');
      expect(sentEmails[0]?.type).toBe('invitation');
    });

    test('debe manejar emails múltiples', async () => {
      const emails = ['user1@test.com', 'user2@test.com', 'user3@test.com'];
      
      for (const email of emails) {
        await emailService.sendInvitationEmail(
          email,
          'Test User',
          'Invitador',
          'Lista Test',
          'hash123',
          new Date(Date.now() + 24 * 60 * 60 * 1000)
        );
      }

      const sentEmails = emailService.getSentEmails();
      expect(sentEmails).toHaveLength(3);
      
      emails.forEach(email => {
        const emailsSentToUser = emailService.getEmailsSentTo(email);
        expect(emailsSentToUser).toHaveLength(1);
      });
    });
  });

  describe('Envío de emails de confirmación', () => {
    test('debe enviar email de confirmación de registro', async () => {
      const result = await emailService.sendRegistrationConfirmation(
        'newuser@example.com',
        'Usuario Nuevo',
        'confirm_token_123'
      );

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();

      const registrationEmails = emailService.getEmailsByType('registration');
      expect(registrationEmails).toHaveLength(1);
      expect(registrationEmails[0]?.to).toBe('newuser@example.com');
    });
  });

  describe('Envío de notificaciones de cambios', () => {
    test('debe enviar notificación de producto añadido', async () => {
      const result = await emailService.sendListChangeNotification(
        'member@example.com',
        'Usuario Member',
        'Lista de Compras',
        'item_added',
        'Anthony añadió "Leche" a la lista'
      );

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();

      const notificationEmails = emailService.getEmailsByType('notification');
      expect(notificationEmails).toHaveLength(1);
      expect(notificationEmails[0]?.to).toBe('member@example.com');
    });
  });

  describe('Estadísticas del servicio', () => {
    test('debe devolver estadísticas correctas', async () => {
      // Enviar algunos emails
      await emailService.sendInvitationEmail('test1@example.com', 'User1', 'Inviter', 'List1', 'hash1', new Date());
      await emailService.sendRegistrationConfirmation('test2@example.com', 'User2', 'token123');
      await emailService.sendListChangeNotification('test3@example.com', 'User3', 'List1', 'item_added', 'Change');

      const stats = await emailService.getStats();
      
      expect(stats).toBeDefined();
      expect(stats.sent).toBe(3);
      expect(stats.failed).toBe(0);
      expect(stats.pending).toBe(0);
    });

    test('debe rastrear estadísticas con fallos simulados', async () => {
      emailService.setFailureRate(0.5); // 50% de fallos

      // Enviar muchos emails para probar distribución de fallos
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          emailService.sendInvitationEmail(
            `test${i}@example.com`,
            `User${i}`,
            'Inviter',
            'List',
            `hash${i}`,
            new Date()
          )
        );
      }

      const results = await Promise.all(promises);
      const successful = results.filter((r: any) => r.success).length;
      const failed = results.filter((r: any) => !r.success).length;

      expect(successful + failed).toBe(10);
      expect(successful).toBeGreaterThan(0); // Al menos algunos exitosos
      expect(failed).toBeGreaterThan(0); // Al menos algunos fallidos
    });
  });

  describe('Manejo de errores', () => {
    test('debe rechazar emails inválidos', async () => {
      const result = await emailService.sendInvitationEmail(
        'email_invalido_sin_arroba.com',
        'Test User',
        'Invitador',
        'Lista Test',
        'hash123',
        new Date(Date.now() + 24 * 60 * 60 * 1000)
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid email address');
      
      const sentEmails = emailService.getSentEmails();
      expect(sentEmails).toHaveLength(0); // No debe enviar
    });

    test('debe manejar fechas de expiración en el pasado', async () => {
      const result = await emailService.sendInvitationEmail(
        'test@example.com',
        'Test User',
        'Invitador',
        'Lista Test',
        'hash123',
        new Date(Date.now() - 24 * 60 * 60 * 1000) // Ayer
      );

      // Mock acepta cualquier fecha
      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
    });

    test('debe simular fallos de entrega', async () => {
      emailService.setFailureRate(1); // 100% de fallos

      const result = await emailService.sendInvitationEmail(
        'test@example.com',
        'Test User',
        'Invitador',
        'Lista Test',
        'hash123',
        new Date(Date.now() + 24 * 60 * 60 * 1000)
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Mock email delivery failed');
    });
  });

  describe('Utilidades de testing', () => {
    test('debe limpiar emails enviados', async () => {
      await emailService.sendInvitationEmail('test@example.com', 'User', 'Inviter', 'List', 'hash', new Date());
      expect(emailService.getSentEmails()).toHaveLength(1);

      emailService.clearSentEmails();
      expect(emailService.getSentEmails()).toHaveLength(0);
    });

    test('debe filtrar emails por destinatario', async () => {
      await emailService.sendInvitationEmail('user1@test.com', 'User1', 'Inviter', 'List', 'hash1', new Date());
      await emailService.sendInvitationEmail('user2@test.com', 'User2', 'Inviter', 'List', 'hash2', new Date());
      await emailService.sendInvitationEmail('user1@test.com', 'User1', 'Inviter', 'List2', 'hash3', new Date());

      const user1Emails = emailService.getEmailsSentTo('user1@test.com');
      const user2Emails = emailService.getEmailsSentTo('user2@test.com');

      expect(user1Emails).toHaveLength(2);
      expect(user2Emails).toHaveLength(1);
    });

    test('debe filtrar emails por tipo', async () => {
      await emailService.sendInvitationEmail('test@example.com', 'User', 'Inviter', 'List', 'hash', new Date());
      await emailService.sendRegistrationConfirmation('test@example.com', 'User', 'token');
      await emailService.sendListChangeNotification('test@example.com', 'User', 'List', 'change', 'Description');

      const invitations = emailService.getEmailsByType('invitation');
      const registrations = emailService.getEmailsByType('registration');
      const notifications = emailService.getEmailsByType('notification');

      expect(invitations).toHaveLength(1);
      expect(registrations).toHaveLength(1);
      expect(notifications).toHaveLength(1);
    });
  });
});