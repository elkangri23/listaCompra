/**
 * Rutas del Dashboard de Monitoreo
 * Expone métricas unificadas del sistema
 */

import { Router, type RequestHandler } from 'express';
import { DashboardController } from '../controllers/DashboardController';

interface DashboardRouteDependencies {
  dashboardController: DashboardController;
  authMiddleware?: RequestHandler;
}

export function createDashboardRoutes({
  dashboardController,
  authMiddleware
}: DashboardRouteDependencies): Router {
  const router = Router();

  /**
   * GET /dashboard/metrics
   * Métricas principales del dashboard
   */
  router.get('/metrics', (req, res) => 
    dashboardController.getMetrics(req, res)
  );

  /**
   * GET /dashboard/health
   * Estado de salud general del sistema
   */
  router.get('/health', (req, res) => 
    dashboardController.getHealth(req, res)
  );

  /**
   * GET /dashboard/alerts
   * Alertas y warnings del sistema
   */
  router.get('/alerts', (req, res) => 
    dashboardController.getAlerts(req, res)
  );

  /**
   * GET /dashboard/performance
   * Métricas de performance detalladas
   */
  router.get('/performance', (req, res) =>
    dashboardController.getPerformance(req, res)
  );

  /**
   * GET /dashboard/analytics
   * Métricas colaborativas y patrones de consumo (requiere auth)
   */
  router.get(
    '/analytics',
    ...(authMiddleware ? [authMiddleware] : []),
    (req, res) => dashboardController.getCollaborativeAnalytics(req, res)
  );

  /**
   * GET /dashboard/summary
   * Resumen rápido para widgets
   */
  router.get('/summary', async (_req, res) => {
    try {
      return res.json({
        success: true,
        data: {
          status: 'operational',
          services: 4,
          uptime: Math.round(process.uptime()),
          requests: 0, // Se completará con métricas reales
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      return res.status(500).json({
        success: false,
        error: 'Error interno del servidor'
      });
    }
  });

  return router;
}