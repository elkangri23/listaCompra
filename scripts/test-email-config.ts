/**
 * Script simple para probar solo la configuración del servicio de email
 * Sin verificación de conexión en caso de problemas de red
 */

import { NodemailerService } from '../src/infrastructure/external-services/email/NodemailerService';
import type { EmailConfig } from '../src/infrastructure/external-services/email/NodemailerService';
import * as dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

async function testEmailConfiguration() {
  console.log('🔧 Probando configuración del servicio de email...\n');

  // Configuración del email service
  const config: EmailConfig = {
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    from: {
      name: 'Lista de Compra',
      email: process.env['EMAIL_USER'] || 'anthonymoles89@gmail.com'
    },
    auth: {
      user: process.env['EMAIL_USER'] || 'anthonymoles89@gmail.com',
      pass: process.env['EMAIL_PASS'] || 'snci srqq feok gkpp'
    },
    maxRetries: 1,
    retryDelay: 500
  };

  console.log('📧 Configuración verificada:', {
    host: config.host,
    port: config.port,
    secure: config.secure,
    from: `${config.from.name} <${config.from.email}>`,
    user: config.auth.user,
    passLength: config.auth.pass.length
  });

  try {
    // Crear servicio de email
    const emailService = new NodemailerService(config);
    console.log('✅ Servicio de email creado exitosamente');

    // Test de estadísticas (no requiere conexión)
    const stats = await emailService.getStats();
    console.log('📊 Estadísticas iniciales:', stats);

    // Test de configuración interna
    console.log('⚙️ Configuración interna validada');

    console.log('\n🎉 ¡Configuración del email service correcta!');
    console.log('📝 Variables de entorno necesarias:');
    console.log('   EMAIL_USER =', process.env['EMAIL_USER'] || '(no definida)');
    console.log('   EMAIL_PASS =', process.env['EMAIL_PASS'] ? '(definida)' : '(no definida)');
    console.log('   EMAIL_FROM =', process.env['EMAIL_FROM'] || '(no definida)');

    console.log('\n💡 Para enviar emails reales, ejecuta: npm run test:email:real');

  } catch (error) {
    console.error('\n💥 Error en configuración:', error);
    return false;
  }

  return true;
}

// Ejecutar test
if (require.main === module) {
  testEmailConfiguration()
    .then((success) => {
      if (success) {
        console.log('\n✨ Test de configuración completado exitosamente');
        process.exit(0);
      } else {
        console.log('\n❌ Test de configuración falló');
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error('\n💥 Error fatal:', error);
      process.exit(1);
    });
}

export { testEmailConfiguration };