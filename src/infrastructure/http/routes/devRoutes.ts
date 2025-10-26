import { Router } from 'express';
import { DevController } from '../controllers/DevController';

const router = Router();
const devController = new DevController();

// Solo disponible en modo development y test
const isDevelopmentOrTest = process.env['NODE_ENV'] === 'development' || process.env['NODE_ENV'] === 'test';

if (isDevelopmentOrTest) {
  
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

  console.log('🔧 Rutas de desarrollo habilitadas en /api/v1/dev');
} else {
  // En producción, devolver 404 para todas las rutas de dev
  router.all('*', (_req, res) => {
    res.status(404).json({
      success: false,
      message: 'Los endpoints de desarrollo no están disponibles en producción'
    });
  });
}

export { router as devRoutes };