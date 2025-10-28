import { Router } from 'express';
import { DevController } from '../controllers/DevController';
import { Logger } from '../../observability/logger/Logger';

const router = Router();
const devController = new DevController();
const logger = new Logger('DevRoutes');

// Verificación estricta de entorno de desarrollo
const nodeEnv = process.env['NODE_ENV'];
const isProduction = nodeEnv === 'production';
const isDevelopment = nodeEnv === 'development';
const isTest = nodeEnv === 'test';

// Solo disponible en desarrollo o test, NUNCA en producción
const isDevEnvironment = (isDevelopment || isTest) && !isProduction;

if (isDevEnvironment) {
  
  /**
   * GET /api/v1/dev/events
   * Obtener información del sistema de eventos
   */
  router.get('/events', devController.getPublishedEvents.bind(devController));

  /**
   * DELETE /api/v1/dev/events
   * Reset del sistema de eventos
   */
  router.delete('/events', devController.clearEvents.bind(devController));

  /**
   * POST /api/v1/dev/events/test
   * Publicar un evento de prueba
   */
  router.post('/events/test', devController.publishTestEvent.bind(devController));

  logger.debug('Rutas de desarrollo habilitadas en /api/v1/dev');
} else {
  // En producción o entorno no reconocido, bloquear TODAS las rutas de dev
  router.all('*', (_req, res) => {
    res.status(404).json({
      success: false,
      error: 'NOT_FOUND',
      message: 'Endpoint no encontrado'
    });
  });
  
  // Log de intento de acceso a rutas de desarrollo en producción
  router.use((_req, _res, next) => {
    logger.security(`Intento de acceso a rutas de desarrollo en entorno: ${nodeEnv}`);
    next();
  });
}

export { router as devRoutes };