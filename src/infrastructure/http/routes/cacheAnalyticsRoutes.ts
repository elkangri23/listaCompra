/**
 * Rutas para Analytics de Cache Redis
 * Expone métricas de performance y eficiencia del cache
 */

import { Router, Request, Response } from 'express';
import { CachedAIService } from '../../external-services/ai/CachedAIService';
import { Logger } from '../../observability/logger/Logger';

const logger = new Logger('CacheAnalyticsRoutes');

export function createCacheAnalyticsRoutes(aiService: CachedAIService): Router {
  const router = Router();

  /**
   * GET /analytics/cache/realtime
   * Métricas en tiempo real del cache (últimos 5 minutos)
   */
  router.get('/analytics/cache/realtime', async (_req: Request, res: Response) => {
    try {
      const analytics = await aiService.getCacheAnalytics();
      
      if (!analytics) {
        return res.status(503).json({
          success: false,
          error: 'Cache analytics no disponible'
        });
      }

      return res.json({
        success: true,
        data: {
          ...analytics,
          timestamp: new Date().toISOString(),
          window: '5 minutes'
        }
      });

    } catch (error) {
      logger.error('Error obteniendo analytics en tiempo real', error as Error);
      return res.status(500).json({
        success: false,
        error: 'Error interno del servidor'
      });
    }
  });

  /**
   * GET /analytics/cache/daily
   * Métricas diarias del cache (últimas 24 horas)
   */
  router.get('/analytics/cache/daily', async (_req: Request, res: Response) => {
    try {
      const analytics = await aiService.getDailyCacheMetrics();
      
      if (!analytics) {
        return res.status(503).json({
          success: false,
          error: 'Cache analytics no disponible'
        });
      }

      return res.json({
        success: true,
        data: {
          ...analytics,
          timestamp: new Date().toISOString(),
          window: '24 hours'
        }
      });

    } catch (error) {
      logger.error('Error obteniendo analytics diarios', error as Error);
      return res.status(500).json({
        success: false,
        error: 'Error interno del servidor'
      });
    }
  });

  /**
   * GET /analytics/cache/optimization
   * Reporte de optimización con recomendaciones
   */
  router.get('/analytics/cache/optimization', async (_req: Request, res: Response) => {
    try {
      const report = await aiService.getCacheOptimizationReport();
      
      if (!report) {
        return res.status(503).json({
          success: false,
          error: 'Cache analytics no disponible'
        });
      }

      return res.json({
        success: true,
        data: {
          ...report,
          timestamp: new Date().toISOString(),
          generated: 'optimization-report'
        }
      });

    } catch (error) {
      logger.error('Error generando reporte de optimización', error as Error);
      return res.status(500).json({
        success: false,
        error: 'Error interno del servidor'
      });
    }
  });

  /**
   * GET /analytics/cache/dashboard
   * Métricas formateadas para dashboard
   */
  router.get('/analytics/cache/dashboard', async (_req: Request, res: Response) => {
    try {
      const dashboardData = await aiService.getCacheMetricsForDashboard();
      
      if (!dashboardData) {
        return res.status(503).json({
          success: false,
          error: 'Cache analytics no disponible'
        });
      }

      return res.json({
        success: true,
        data: {
          ...dashboardData,
          timestamp: new Date().toISOString(),
          status: 'operational'
        }
      });

    } catch (error) {
      logger.error('Error obteniendo datos para dashboard', error as Error);
      return res.status(500).json({
        success: false,
        error: 'Error interno del servidor'
      });
    }
  });

  /**
   * GET /analytics/cache/health
   * Estado de salud del sistema de cache
   */
  router.get('/analytics/cache/health', async (_req: Request, res: Response) => {
    try {
      const [realtime, daily] = await Promise.all([
        aiService.getCacheAnalytics(),
        aiService.getDailyCacheMetrics()
      ]);

      const isHealthy = realtime && daily && realtime.hitRatio > 0.5;
      
      return res.json({
        success: true,
        data: {
          status: isHealthy ? 'healthy' : 'degraded',
          cacheAvailable: !!realtime,
          analyticsAvailable: !!daily,
          currentHitRatio: realtime?.hitRatio || 0,
          dailyOperations: daily?.totalOperations || 0,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.error('Error verificando salud del cache', error as Error);
      return res.status(500).json({
        success: false,
        error: 'Error interno del servidor'
      });
    }
  });

  return router;
}