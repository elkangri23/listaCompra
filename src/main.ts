/**
 * Punto de entrada principal de la aplicación
 * Lista de Compra Colaborativa
 */

import dotenv from 'dotenv';

// Cargar variables de entorno lo antes posible
dotenv.config();

import { createServer } from './infrastructure/http/server';

async function bootstrap(): Promise<void> {
  try {
    console.log('🚀 Iniciando Lista de Compra Colaborativa...');
    
    // Validar variables de entorno críticas
    const requiredEnvVars = ['NODE_ENV', 'PORT', 'DATABASE_URL'];
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      throw new Error(`Variables de entorno faltantes: ${missingVars.join(', ')}`);
    }

    // Crear y configurar el servidor
    const app = await createServer();
    const port = process.env['PORT'] || 3000;

    // Iniciar el servidor
    const server = app.listen(port, () => {
      console.log(`✅ Servidor ejecutándose en puerto ${port}`);
      console.log(`🌍 Entorno: ${process.env['NODE_ENV']}`);
      console.log(`📚 Documentación: http://localhost:${port}/api-docs`);
    });

    // Manejo graceful de cierre
    const gracefulShutdown = (): void => {
      console.log('🛑 Cerrando servidor...');
      server.close(() => {
        console.log('✅ Servidor cerrado correctamente');
        process.exit(0);
      });
    };

    // Escuchar señales de cierre
    process.on('SIGINT', gracefulShutdown);
    process.on('SIGTERM', gracefulShutdown);

  } catch (error) {
    console.error('❌ Error al iniciar la aplicación:', error);
    process.exit(1);
  }
}

// Iniciar la aplicación
bootstrap();