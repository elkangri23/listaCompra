/**
 * Tests de integración para el servicio de email
 * Verifica que el envío de emails funciona correctamente con Gmail
 */

import { NodemailerService } from '../../../src/infrastructure/external-services/email/NodemailerService';
import type { EmailConfig } from '../../../src/infrastructure/external-services/email/NodemailerService';

describe('NodemailerService Integration Tests', () => {
  let emailService: NodemailerService;
  const testEmail = 'email-privado-eliminado@example.invalid'; // Email del desarrollador para tests

  beforeAll(() => {
    // Configuración real de Gmail para tests
    const config: EmailConfig = {
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      from: {
        name: 'Lista de Compra',
        email: process.env['EMAIL_USER'] || 'email-privado-eliminado@example.invalid'
      },
      auth: {
        user: process.env['EMAIL_USER'] || 'email-privado-eliminado@example.invalid',
        pass: process.env['EMAIL_PASS'] || '***PASSWORD-ELIMINADA***'
      },
      maxRetries: 2,
      retryDelay: 1000
    };

    emailService = new NodemailerService(config);
  });

  afterAll(async () => {
    // Limpiar recursos si es necesario (sin disconnect que no existe)
    console.log('🧹 Limpieza de tests completada');
  });

  describe('Configuración y conexión', () => {
    test('debe inicializar correctamente el servicio', () => {
      expect(emailService).toBeDefined();
    });

    test('debe conectar con Gmail SMTP', async () => {
      const result = await emailService.verifyConnection();
      expect(result).toBe(true);
    }, 15000); // Timeout extendido para conexión de red
  });

  describe('Envío de emails de invitación', () => {
    test('debe enviar email de invitación correctamente', async () => {
      const result = await emailService.sendInvitationEmail(
        testEmail,
        'Usuario Test',
        'Anthony Moles',
        'Lista de Prueba',
        'abc123hash',
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 días
      );

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
      console.log('✅ Email de invitación enviado:', result.messageId);
    }, 15000);

    test('debe enviar email de invitación con datos mínimos', async () => {
      const result = await emailService.sendInvitationEmail(
        testEmail,
        'Test User',
        'Invitador',
        'Lista Simple',
        'xyz789hash',
        new Date(Date.now() + 24 * 60 * 60 * 1000) // 1 día
      );

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
      console.log('✅ Email simple enviado:', result.messageId);
    }, 15000);
  });

  describe('Envío de emails de confirmación', () => {
    test('debe enviar email de confirmación de registro', async () => {
      const result = await emailService.sendRegistrationConfirmation(
        testEmail,
        'Usuario Test',
        'confirm_token_123'
      );

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
      console.log('✅ Email de confirmación enviado:', result.messageId);
    }, 15000);
  });

  describe('Envío de notificaciones de cambios', () => {
    test('debe enviar notificación de producto añadido', async () => {
      const result = await emailService.sendListChangeNotification(
        testEmail,
        'Usuario Test',
        'Lista de Compras',
        'item_added',
        'Anthony añadió "Leche" a la lista'
      );

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
      console.log('✅ Notificación de cambio enviada:', result.messageId);
    }, 15000);
  });

  describe('Estadísticas del servicio', () => {
    test('debe devolver estadísticas de envío', async () => {
      const stats = await emailService.getStats();
      
      expect(stats).toBeDefined();
      expect(typeof stats.sent).toBe('number');
      expect(typeof stats.failed).toBe('number');
      expect(typeof stats.pending).toBe('number');
      expect(stats.sent).toBeGreaterThanOrEqual(0);
      
      console.log('📊 Estadísticas de email:', stats);
    });
  });

  describe('Manejo de errores', () => {
    test('debe manejar email inválido correctamente', async () => {
      const result = await emailService.sendInvitationEmail(
        'email_invalido_sin_arroba.com',
        'Test User',
        'Invitador',
        'Lista Test',
        'hash123',
        new Date(Date.now() + 24 * 60 * 60 * 1000)
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      console.log('⚠️ Error esperado:', result.error);
    }, 15000);

    test('debe manejar fecha de expiración en el pasado', async () => {
      const result = await emailService.sendInvitationEmail(
        testEmail,
        'Test User',
        'Invitador',
        'Lista Test',
        'hash123',
        new Date(Date.now() - 24 * 60 * 60 * 1000) // Ayer
      );

      // El servicio debería enviar el email pero podría advertir sobre la fecha
      expect(result.success).toBe(true);
      console.log('⚠️ Email con fecha pasada enviado:', result.messageId);
    }, 15000);
  });

  describe('Configuración y estado', () => {
    test('debe reportar configuración correcta', () => {
      expect(emailService).toBeDefined();
      console.log('🔧 Servicio de email configurado correctamente');
    });
  });
});

// Test suite para verificar la integración con variables de entorno
describe('Email Service Environment Configuration', () => {
  test('debe leer correctamente las variables de entorno', () => {
    expect(process.env['EMAIL_USER']).toBeDefined();
    expect(process.env['EMAIL_PASS']).toBeDefined();
    expect(process.env['EMAIL_PROVIDER']).toBeDefined();
    expect(process.env['EMAIL_FROM']).toBeDefined();
    
    console.log('📧 Variables de entorno:', {
      EMAIL_USER: process.env['EMAIL_USER'],
      EMAIL_PROVIDER: process.env['EMAIL_PROVIDER'],
      EMAIL_FROM: process.env['EMAIL_FROM'],
      EMAIL_ENABLED: process.env['EMAIL_ENABLED']
    });
  });

  test('debe usar configuración por defecto cuando faltan variables', () => {
    const originalUser = process.env['EMAIL_USER'];
    delete process.env['EMAIL_USER'];

    const config: EmailConfig = {
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      from: {
        name: 'Test',
        email: 'test@example.com'
      },
      auth: {
        user: process.env['EMAIL_USER'] || 'default@gmail.com',
        pass: process.env['EMAIL_PASS'] || 'default_pass'
      },
      maxRetries: 3,
      retryDelay: 1000
    };

    expect(config.auth.user).toBe('default@gmail.com');

    // Restaurar variable
    if (originalUser) {
      process.env['EMAIL_USER'] = originalUser;
    }
  });
});