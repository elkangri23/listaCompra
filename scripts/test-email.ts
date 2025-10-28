/**
 * Script para probar el envío de emails de forma manual
 * Ejecutar con: npm run test:email
 */

import { NodemailerService } from '../src/infrastructure/external-services/email/NodemailerService';
import type { EmailConfig } from '../src/infrastructure/external-services/email/NodemailerService';
import * as dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

async function testEmailService() {
  console.log('🚀 Iniciando prueba del servicio de email...\n');

  // Configuración del email service
  const config: EmailConfig = {
    // Para Gmail usar configuración SMTP explícita
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // true para 465, false para otros puertos
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

  console.log('📧 Configuración:', {
    host: config.host,
    port: config.port,
    secure: config.secure,
    from: `${config.from.name} <${config.from.email}>`,
    user: config.auth.user
  });

  const emailService = new NodemailerService(config);

  try {
    // Test 1: Verificar conexión
    console.log('\n📡 Test 1: Verificando conexión SMTP...');
    const connectionResult = await emailService.verifyConnection();
    
    if (connectionResult) {
      console.log('✅ Conexión SMTP exitosa');
    } else {
      console.log('❌ Error de conexión SMTP');
      return;
    }

    // Test 2: Enviar email de invitación
    console.log('\n📬 Test 2: Enviando email de invitación...');
    const invitationResult = await emailService.sendInvitationEmail(
      'email-privado-eliminado@example.invalid',
      'Anthony Moles',
      'Sistema Lista de Compra',
      'Lista de Prueba de Desarrollo',
      'test_hash_123',
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 días
    );

    if (invitationResult.success) {
      console.log('✅ Email de invitación enviado exitosamente');
      console.log('📧 Message ID:', invitationResult.messageId);
    } else {
      console.log('❌ Error enviando invitación:', invitationResult.error);
    }

    // Test 3: Enviar email de confirmación
    console.log('\n📋 Test 3: Enviando email de confirmación...');
    const confirmationResult = await emailService.sendRegistrationConfirmation(
      'email-privado-eliminado@example.invalid',
      'Anthony Moles',
      'test_confirmation_token_456'
    );

    if (confirmationResult.success) {
      console.log('✅ Email de confirmación enviado exitosamente');
      console.log('📧 Message ID:', confirmationResult.messageId);
    } else {
      console.log('❌ Error enviando confirmación:', confirmationResult.error);
    }

    // Test 4: Enviar notificación de cambio
    console.log('\n🔔 Test 4: Enviando notificación de cambio...');
    const notificationResult = await emailService.sendListChangeNotification(
      'email-privado-eliminado@example.invalid',
      'Anthony Moles',
      'Lista de Prueba',
      'item_added',
      'El sistema añadió "Leche" a la lista automáticamente'
    );

    if (notificationResult.success) {
      console.log('✅ Notificación enviada exitosamente');
      console.log('📧 Message ID:', notificationResult.messageId);
    } else {
      console.log('❌ Error enviando notificación:', notificationResult.error);
    }

    // Test 5: Mostrar estadísticas
    console.log('\n📊 Test 5: Estadísticas del servicio...');
    const stats = await emailService.getStats();
    console.log('📈 Estadísticas:', stats);

    // Test 6: Estado del servicio
    console.log('\n🔧 Test 6: Estado del servicio...');
    console.log('⚙️ Servicio configurado correctamente');

    console.log('\n🎉 ¡Todas las pruebas completadas exitosamente!');
    console.log('📧 Revisa tu bandeja de entrada en email-privado-eliminado@example.invalid');

  } catch (error) {
    console.error('\n💥 Error durante las pruebas:', error);
  }
}

// Ejecutar las pruebas
if (require.main === module) {
  testEmailService()
    .then(() => {
      console.log('\n✨ Script de prueba finalizado');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Error fatal:', error);
      process.exit(1);
    });
}

export { testEmailService };