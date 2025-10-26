/**
 * Configuración y bootstrap del servidor HTTP
 */

import express, { type Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

export async function createServer(): Promise<Application> {
  const app = express();

  // Middlewares de seguridad
  app.use(helmet());
  
  // CORS
  app.use(cors({
    origin: process.env['CORS_ORIGIN']?.split(',') || ['http://localhost:3000'],
    credentials: true,
  }));

  // Logging
  if (process.env['NODE_ENV'] !== 'test') {
    app.use(morgan('combined'));
  }

  // Parsers
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Health check
  app.get('/health', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: process.env['NODE_ENV'],
    });
  });

  // Ruta básica
  app.get('/', (_req, res) => {
    res.json({
      message: '🛒 Lista de Compra Colaborativa API',
      version: '1.0.0',
      documentation: '/api-docs',
    });
  });

  // TODO: Agregar rutas de la aplicación
  // app.use('/api/v1', routes);

  // Manejo de rutas no encontradas
  app.use('*', (_req, res) => {
    res.status(404).json({
      error: 'Ruta no encontrada',
      message: 'La ruta solicitada no existe en este servidor',
    });
  });

  // TODO: Agregar middleware de manejo de errores
  // app.use(errorMiddleware);

  return app;
}