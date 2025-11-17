/**
 * Script de prueba para verificar el servicio de Resend
 * Uso: npx ts-node scripts/test-resend.ts
 */

import { Resend } from 'resend';
import * as dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

async function testResendService() {
  console.log('🧪 Iniciando prueba de Resend...\n');

  const apiKey = process.env['RESEND_API_KEY'];
  const fromName = process.env['EMAIL_FROM_NAME'] || 'Lista de Compra';
  const fromEmail = process.env['EMAIL_FROM'] || 'onboarding@resend.dev';

  if (!apiKey) {
    console.error('❌ Error: RESEND_API_KEY no está configurada en .env');
    console.error('\n💡 Solución:');
    console.error('   1. Crea/edita el archivo .env en la raíz del proyecto');
    console.error('   2. Añade: RESEND_API_KEY=tu_api_key_aqui');
    console.error('   3. Obtén tu API key en: https://resend.com/api-keys\n');
    process.exit(1);
  }

  console.log('📧 Configuración:');
  console.log(`   API Key: ${apiKey.substring(0, 10)}...`);
  console.log(`   From: ${fromName} <${fromEmail}>\n`);

  const resend = new Resend(apiKey);

  try {
    console.log('📤 Enviando email de prueba...');
    
    const { data, error } = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: 'anthonymoles@hotmail.com',
      subject: 'Test de Resend - Lista de Compra',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                body { font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px; }
                .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                .header { background: #28a745; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; margin: -30px -30px 30px; }
                .success { background: #d4edda; border: 1px solid #c3e6cb; color: #155724; padding: 15px; border-radius: 5px; margin: 20px 0; }
                .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>✅ Test Exitoso</h1>
                </div>
                <h2>¡Resend está funcionando correctamente!</h2>
                <p>Este es un email de prueba enviado desde <strong>Lista de Compra Colaborativa</strong> usando <strong>Resend</strong>.</p>
                
                <div class="success">
                    <strong>✓ Configuración verificada:</strong>
                    <ul>
                        <li>API Key configurada correctamente</li>
                        <li>Servicio de email operativo</li>
                        <li>Templates HTML funcionando</li>
                    </ul>
                </div>

                <p>El sistema está listo para enviar:</p>
                <ul>
                    <li>📨 Invitaciones a listas compartidas</li>
                    <li>🔔 Notificaciones de cambios</li>
                    <li>✉️ Confirmaciones de registro</li>
                </ul>

                <div class="footer">
                    <p>© 2025 Lista Compra Colaborativa</p>
                    <p>Powered by Resend</p>
                </div>
            </div>
        </body>
        </html>
      `,
      text: `
¡Resend está funcionando correctamente!

Este es un email de prueba enviado desde Lista de Compra Colaborativa usando Resend.

✓ Configuración verificada:
  - API Key configurada correctamente
  - Servicio de email operativo
  - Templates HTML funcionando

El sistema está listo para enviar:
  - Invitaciones a listas compartidas
  - Notificaciones de cambios
  - Confirmaciones de registro

© 2025 Lista Compra Colaborativa
Powered by Resend
      `.trim()
    });

    if (error) {
      console.error('❌ Error al enviar email:', error);
      process.exit(1);
    }

    console.log('✅ Email enviado exitosamente!');
    console.log(`   ID: ${data?.id}\n`);

    console.log('📬 Verifica tu bandeja de entrada en: anthonymoles@hotmail.com\n');
    console.log('🎉 Prueba completada con éxito!\n');

  } catch (error) {
    console.error('❌ Error durante la prueba:', error);
    
    if (error instanceof Error) {
      console.error('\n📋 Detalles del error:');
      console.error(`   Mensaje: ${error.message}`);
      console.error(`   Stack: ${error.stack}\n`);
    }
    
    process.exit(1);
  }
}

// Ejecutar prueba
testResendService().catch(error => {
  console.error('Error fatal:', error);
  process.exit(1);
});
