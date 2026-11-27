/**
 * Tests de rutas de dashboard y cache analytics.
 * Supertest con routers aislados (sin servidor completo).
 */

import request from 'supertest';
import express from 'express';
import { createDashboardRoutes } from '../../../../../src/infrastructure/http/routes/dashboardRoutes';
import { createCacheAnalyticsRoutes } from '../../../../../src/infrastructure/http/routes/cacheAnalyticsRoutes';

const makeDashboardController = () => {
  const controller: any = {
    getMetrics: jest.fn(async (_req: any, res: any) => res.json({ success: true, data: { metrics: 1 } })),
    getHealth: jest.fn(async (_req: any, res: any) => res.json({ success: true, data: { status: 'ok' } })),
    getAlerts: jest.fn(async (_req: any, res: any) => res.json({ success: true, data: { alerts: [] } })),
    getPerformance: jest.fn(async (_req: any, res: any) => res.json({ success: true, data: { p95: 100 } })),
    getCollaborativeAnalytics: jest.fn(async (_req: any, res: any) => res.json({ success: true, data: { patterns: 0 } }))
  };
  return controller;
};

describe('dashboardRoutes', () => {
  let app: express.Express;

  beforeEach(() => {
    const controller = makeDashboardController();
    app = express();
    app.use(express.json());
    app.use('/', createDashboardRoutes({ dashboardController: controller }));
  });

  it('GET /metrics delega en el controller', async () => {
    const res = await request(app).get('/metrics');
    expect(res.status).toBe(200);
    expect(res.body.data.metrics).toBe(1);
  });

  it('GET /health /alerts /performance /analytics', async () => {
    expect((await request(app).get('/health')).body.data.status).toBe('ok');
    expect((await request(app).get('/alerts')).body.data.alerts).toEqual([]);
    expect((await request(app).get('/performance')).body.data.p95).toBe(100);
    expect((await request(app).get('/analytics')).body.data.patterns).toBe(0);
  });

  it('GET /summary sin controller devuelve estado operativo', async () => {
    const res = await request(app).get('/summary');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('operational');
    expect(res.body.data.services).toBe(4);
    expect(typeof res.body.data.uptime).toBe('number');
  });

  it('construye con authMiddleware opcional', async () => {
    const middleware = jest.fn((_req: any, _res: any, next: () => void) => next());
    const appAuth = express();
    appAuth.use('/', createDashboardRoutes({
      dashboardController: makeDashboardController(),
      authMiddleware: middleware as any
    }));
    await request(appAuth).get('/analytics');
    expect(middleware).toHaveBeenCalled();
  });
});

describe('cacheAnalyticsRoutes', () => {
  const makeService = () => ({
    getCacheAnalytics: jest.fn().mockResolvedValue({ hitRatio: 0.8, totalOperations: 100 }),
    getDailyCacheMetrics: jest.fn().mockResolvedValue({ totalOperations: 200 }),
    getCacheOptimizationReport: jest.fn().mockResolvedValue({ recommendations: [] }),
    getCacheMetricsForDashboard: jest.fn().mockResolvedValue({ formatted: true })
  });

  let app: express.Express;
  let service: ReturnType<typeof makeService>;

  beforeEach(() => {
    service = makeService();
    app = express();
    app.use('/', createCacheAnalyticsRoutes(service as any));
  });

  it('GET /analytics/cache/realtime', async () => {
    const res = await request(app).get('/analytics/cache/realtime');
    expect(res.status).toBe(200);
    expect(res.body.data.hitRatio).toBe(0.8);
    expect(res.body.data.window).toBe('5 minutes');
  });

  it('GET /analytics/cache/realtime sin datos → 503', async () => {
    service.getCacheAnalytics.mockResolvedValue(null);
    const res = await request(app).get('/analytics/cache/realtime');
    expect(res.status).toBe(503);
  });

  it('GET /analytics/cache/daily y optimization', async () => {
    expect((await request(app).get('/analytics/cache/daily')).body.data.window).toBe('24 hours');
    const opt = await request(app).get('/analytics/cache/optimization');
    expect(opt.status).toBe(200);
    expect(opt.body.data.generated).toBe('optimization-report');
  });

  it('GET /analytics/cache/dashboard y health', async () => {
    expect((await request(app).get('/analytics/cache/dashboard')).body.data.formatted).toBe(true);
    const health = await request(app).get('/analytics/cache/health');
    expect(health.status).toBe(200);
    expect(health.body.data.status).toBe('healthy'); // hitRatio 0.8 > 0.5
  });

  it('health degradado con hitRatio bajo', async () => {
    service.getCacheAnalytics.mockResolvedValue({ hitRatio: 0.2, totalOperations: 10 });
    const res = await request(app).get('/analytics/cache/health');
    expect(res.body.data.status).toBe('degraded');
  });

  it('health tolera valores nulos', async () => {
    service.getCacheAnalytics.mockResolvedValue(null);
    const res = await request(app).get('/analytics/cache/health');
    expect(res.body.data.status).toBe('degraded');
    expect(res.body.data.cacheAvailable).toBe(false);
    expect(res.body.data.currentHitRatio).toBe(0);
  });

  it('500 si el servicio lanza', async () => {
    service.getCacheAnalytics.mockRejectedValue(new Error('redis down'));
    const res = await request(app).get('/analytics/cache/realtime');
    expect(res.status).toBe(500);
  });
});
