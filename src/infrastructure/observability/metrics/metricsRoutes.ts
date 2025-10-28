/**
 * Rutas para exposición de métricas y monitoreo
 * GET /metrics - Métricas generales del sistema
 * GET /metrics/endpoint/:method/:path - Métricas de endpoint específico  
 * DELETE /metrics - Reset de métricas
 */

import { Router } from 'express';
import { 
  getMetricsHandler, 
  getEndpointMetricsHandler, 
  resetMetricsHandler 
} from './MetricsMiddleware';

const router = Router();

// GET /metrics - Métricas generales del sistema
router.get('/', getMetricsHandler);

// GET /metrics/endpoint/:method/:path - Métricas de endpoint específico
router.get('/endpoint/:method/:path(*)', getEndpointMetricsHandler);

// DELETE /metrics - Reset de métricas (con query parameter opcional)
router.delete('/', resetMetricsHandler);

// GET /metrics/health - Health check del sistema de métricas
router.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    service: 'metrics',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

export { router as metricsRoutes };