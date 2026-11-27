/**
 * Middleware de Express para recolección automática de métricas
 * Se aplica a todas las rutas para trackear performance
 */

import type { Request, Response, NextFunction } from 'express';
import { MetricsCollector } from './MetricsCollector';

// Instancia singleton del collector
const metricsCollector = new MetricsCollector();

export interface RequestWithMetrics extends Request {
  startTime?: number;
}

/**
 * Crea un middleware que registra las métricas en el collector dado.
 * Debe ser LA MISMA instancia que lee DashboardController (la del
 * container): si cada uno usa una instancia distinta, el dashboard
 * siempre ve cero peticiones.
 */
export const createMetricsMiddleware = (collector: MetricsCollector) => (req: RequestWithMetrics, res: Response, next: NextFunction): void => {
  // Marcar inicio de request
  req.startTime = Date.now();

  // Capturar el final de la response
  const originalSend = res.send;
  res.send = function(body: any) {
    if (req.startTime) {
      const responseTime = Date.now() - req.startTime;
      
      // Recopilar métricas
      collector.recordRequest(
        req.method,
        req.path || req.url,
        responseTime,
        res.statusCode
      );
    }
    
    return originalSend.call(this, body);
  };

  next();
};

/**
 * Middleware con el singleton del módulo (para los handlers de /metrics y
 * para tests). En producción se monta el creado con
 * createMetricsMiddleware y el collector del container.
 */
export const metricsMiddleware = createMetricsMiddleware(metricsCollector);

/**
 * Endpoint para exponer métricas en formato JSON
 */
export const getMetricsHandler = (_req: Request, res: Response): void => {
  try {
    const systemMetrics = metricsCollector.getSystemMetrics();
    const endpointMetrics = metricsCollector.getAllEndpointMetrics();
    const slowestEndpoints = metricsCollector.getSlowestEndpoints(5);
    const errorStats = metricsCollector.getErrorRateStats().slice(0, 5);

    res.json({
      timestamp: new Date().toISOString(),
      system: systemMetrics,
      endpoints: endpointMetrics,
      slowest: slowestEndpoints,
      errors: errorStats
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve metrics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Endpoint para métricas de un endpoint específico
 */
export const getEndpointMetricsHandler = (req: Request, res: Response): void => {
  try {
    const { method, path } = req.params;
    
    if (!method || !path) {
      res.status(400).json({
        error: 'Missing required parameters',
        required: ['method', 'path']
      });
      return;
    }

    const metrics = metricsCollector.getEndpointMetrics(method, decodeURIComponent(path));
    
    if (!metrics) {
      res.status(404).json({
        error: 'Endpoint metrics not found',
        method,
        path: decodeURIComponent(path)
      });
      return;
    }

    res.json({
      timestamp: new Date().toISOString(),
      metrics
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve endpoint metrics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Endpoint para resetear métricas
 */
export const resetMetricsHandler = (req: Request, res: Response): void => {
  try {
    const { endpoint } = req.query;
    
    if (endpoint && typeof endpoint === 'string') {
      const [method, path] = endpoint.split(':');
      if (method && path) {
        metricsCollector.resetEndpoint(method, path);
        res.json({
          message: `Metrics reset for ${method}:${path}`,
          timestamp: new Date().toISOString()
        });
      } else {
        res.status(400).json({
          error: 'Invalid endpoint format',
          expected: 'method:path (e.g., GET:/api/users)'
        });
      }
    } else {
      metricsCollector.reset();
      res.json({
        message: 'All metrics reset',
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    res.status(500).json({
      error: 'Failed to reset metrics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Función para obtener instancia del collector (para testing)
 */
export const getMetricsCollector = (): MetricsCollector => {
  return metricsCollector;
};

/**
 * Función para crear un nuevo collector (para testing)
 */
export const createMetricsCollector = (): MetricsCollector => {
  return new MetricsCollector();
};