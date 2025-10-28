/**
 * Punto de entrada principal de la aplicación
 * Lista de Compra Colaborativa
 */

import dotenv from 'dotenv';

// Cargar variables de entorno lo antes posible
dotenv.config();

import { createServer } from './infrastructure/http/server';
import { Container } from './composition/container';

async function bootstrap(): Promise<void> {
  try {
    console.log('🚀 Iniciando Lista de Compra Colaborativa...');
    
    // Validar variables de entorno críticas
    const requiredEnvVars = [
      'NODE_ENV', 
      'DATABASE_URL',
      'JWT_SECRET'
    ];
    
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      throw new Error(`Variables de entorno faltantes: ${missingVars.join(', ')}`);
    }

    // Validar JWT_SECRET específicamente
    const jwtSecret = process.env['JWT_SECRET'];
    if (jwtSecret && jwtSecret.length < 32) {
      throw new Error('JWT_SECRET debe tener al menos 32 caracteres para seguridad');
    }

    // Validar NODE_ENV
    const validEnvironments = ['development', 'production', 'test'];
    if (!validEnvironments.includes(process.env['NODE_ENV']!)) {
      throw new Error(`NODE_ENV debe ser uno de: ${validEnvironments.join(', ')}`);
    }

    // Inicializar contenedor de dependencias
    const container = Container.getInstance();
    
    // Conectar a la base de datos
    await container.connect();

    // Inicializar RabbitMQ si está habilitado
    await container.initializeRabbitMQ();

    // Verificar conexión
    const isHealthy = await container.healthCheck();
    if (!isHealthy) {
      throw new Error('Health check de base de datos falló');
    }

    // Crear y configurar el servidor
    const app = await createServer({
      authController: container.authController,
      invitationController: container.invitationController,
      authMiddleware: container.authMiddleware,
    });
    const port = process.env['PORT'] || 3000;

    // Iniciar el servidor
    const server = app.listen(port, () => {
      console.log(`✅ Servidor ejecutándose en puerto ${port}`);
      console.log(`🌐 URL: http://localhost:${port}`);
      console.log(`🌍 Entorno: ${process.env['NODE_ENV']}`);
      console.log(`📚 Health Check: http://localhost:${port}/health`);
      console.log(`🔐 Auth API: http://localhost:${port}/api/v1/auth`);
    });

    // Manejo graceful de cierre
    const gracefulShutdown = async (signal: string): Promise<void> => {
      console.log(`\n⚠️  Recibida señal ${signal}. Cerrando servidor elegantemente...`);
      
      server.close(async () => {
        console.log('✅ Servidor HTTP cerrado');
        
        try {
          await container.close();
          console.log('✅ Base de datos desconectada');
          console.log('✅ Aplicación cerrada exitosamente');
          process.exit(0);
        } catch (error) {
          console.error('❌ Error al cerrar aplicación:', error);
          process.exit(1);
        }
      });
    };

    // Escuchar señales de cierre
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Manejo de errores no capturados
    process.on('unhandledRejection', (reason, promise) => {
      console.error('❌ Unhandled Rejection en:', promise, 'reason:', reason);
      process.exit(1);
    });

    process.on('uncaughtException', (error) => {
      console.error('❌ Uncaught Exception:', error);
      process.exit(1);
    });

  } catch (error) {
    console.error('❌ Error al iniciar aplicación:', error);
    process.exit(1);
  }
}

// Iniciar aplicación
bootstrap();