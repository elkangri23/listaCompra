import { Request, Response } from 'express';
import { MetricsCollector } from '../../observability/metrics/MetricsCollector';
import { CachedAIService } from '../../external-services/ai/CachedAIService';

interface AlertInfo {
  type: string;
  severity: 'low' | 'medium' | 'high';
  message: string;
  value: number;
  threshold: number;
  timestamp: string;
}

export class DashboardController {
  constructor(
    private readonly metricsCollector: MetricsCollector,
    private readonly cachedAIService: CachedAIService
  ) {}

  /**
   * GET /dashboard/metrics
   * Obtiene todas las métricas del dashboard
   */
  async getMetrics(_req: Request, res: Response): Promise<Response> {
    try {
      // Collect system and endpoint metrics
      const systemMetrics = this.metricsCollector.getSystemMetrics();
      const endpointMetrics = this.metricsCollector.getAllEndpointMetrics();

      // Get cache analytics with error handling
      let cacheMetrics;
      try {
        cacheMetrics = await this.cachedAIService.getCacheAnalytics();
      } catch (error) {
        cacheMetrics = { error: 'Cache analytics unavailable' };
      }

      return res.json({
        status: 'success',
        data: {
          systemMetrics,
          endpointMetrics,
          cacheMetrics
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      return res.status(500).json({
        status: 'error',
        message: 'Error al obtener métricas del dashboard',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * GET /dashboard/health
   * Obtiene el estado de salud del sistema
   */
  async getHealth(_req: Request, res: Response): Promise<Response> {
    try {
      const systemMetrics = this.metricsCollector.getSystemMetrics();
      
      // Determine API health based on success rate
      const apiHealth = systemMetrics.globalSuccessRate >= 0.9 ? 'healthy' : 
                       systemMetrics.globalSuccessRate >= 0.8 ? 'degraded' : 'unhealthy';

      // Determine cache health
      let cacheHealth = 'healthy';
      try {
        const cacheAnalytics = await this.cachedAIService.getCacheAnalytics();
        if (cacheAnalytics.hitRatio < 0.7) {
          cacheHealth = 'degraded';
        }
      } catch (error) {
        cacheHealth = 'degraded';
      }

      // Overall health
      const overall = apiHealth === 'unhealthy' ? 'unhealthy' :
                     (apiHealth === 'degraded' || cacheHealth === 'degraded') ? 'degraded' : 'healthy';

      return res.json({
        status: 'success',
        data: {
          overall,
          services: {
            api: apiHealth,
            cache: cacheHealth,
            metrics: 'healthy'
          },
          uptime: systemMetrics.uptime,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      return res.status(500).json({
        status: 'error',
        message: 'Error al obtener estado de salud',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * GET /dashboard/alerts
   * Obtiene alertas activas del sistema
   */
  async getAlerts(_req: Request, res: Response): Promise<Response> {
    try {
      const alerts: AlertInfo[] = [];
      
      // Check HTTP metrics
      const systemMetrics = this.metricsCollector.getSystemMetrics();
      
      // Error rate alert
      if (systemMetrics.globalSuccessRate < 0.9) {
        alerts.push({
          type: 'error_rate',
          severity: systemMetrics.globalSuccessRate < 0.8 ? 'high' : 'medium',
          message: `Error rate is high: ${((1 - systemMetrics.globalSuccessRate) * 100).toFixed(1)}%`,
          value: 1 - systemMetrics.globalSuccessRate,
          threshold: 0.1,
          timestamp: new Date().toISOString()
        });
      }

      // Response time alert
      if (systemMetrics.globalAvgResponseTime > 2000) {
        alerts.push({
          type: 'response_time',
          severity: systemMetrics.globalAvgResponseTime > 5000 ? 'high' : 'medium',
          message: `Response time is high: ${systemMetrics.globalAvgResponseTime}ms`,
          value: systemMetrics.globalAvgResponseTime,
          threshold: 2000,
          timestamp: new Date().toISOString()
        });
      }

      // Check cache metrics
      try {
        const cacheAnalytics = await this.cachedAIService.getCacheAnalytics();
        if (cacheAnalytics.hitRatio < 0.7) {
          alerts.push({
            type: 'cache_hit_ratio',
            severity: cacheAnalytics.hitRatio < 0.5 ? 'high' : 'medium',
            message: `Cache hit ratio is low: ${(cacheAnalytics.hitRatio * 100).toFixed(1)}%`,
            value: cacheAnalytics.hitRatio,
            threshold: 0.7,
            timestamp: new Date().toISOString()
          });
        }
      } catch (error) {
        // Cache alerts are not critical
      }

      return res.json({
        status: 'success',
        data: {
          activeAlerts: alerts,
          alertCount: alerts.length,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      return res.status(500).json({
        status: 'error',
        message: 'Error al obtener alertas',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * GET /dashboard/performance
   * Obtiene métricas detalladas de performance
   */
  async getPerformance(_req: Request, res: Response): Promise<Response> {
    try {
      const slowestEndpoints = this.metricsCollector.getSlowestEndpoints(10);
      const errorProneEndpoints = this.metricsCollector.getEndpointsWithMostErrors(10);
      const errorRateStats = this.metricsCollector.getErrorRateStats();

      return res.json({
        status: 'success',
        data: {
          slowestEndpoints,
          errorProneEndpoints,
          errorRateStats,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      return res.status(500).json({
        status: 'error',
        message: 'Error al obtener métricas de performance',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}