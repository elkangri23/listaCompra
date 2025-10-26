/**
 * Configuración y bootstrap del servidor HTTP
 */

import express, { type Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import type { AuthController } from './controllers/AuthController';
import { createAuthRoutes } from './routes/authRoutes';

export interface ServerDependencies {
  authController: AuthController;
}

export async function createServer(dependencies: ServerDependencies): Promise<Application> {
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

  // Rutas de la aplicación
  app.use('/api/v1/auth', createAuthRoutes(dependencies.authController));

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