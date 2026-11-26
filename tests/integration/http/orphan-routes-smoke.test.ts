/**
 * Smoke test: rutas previamente huérfanas (blueprints, stores, occasion-lists,
 * cache analytics/integrity) montadas en el servidor y protegidas con auth.
 *
 * Verifica el bug corregido en audit.routes.ts: se exportaba una función que,
 * usada como middleware en app.use('/api/v1', ...), dejaba colgadas TODAS las
 * peticiones /api/v1/* que no matcheaban rutas previas.
 *
 * Entorno: NODE_ENV=test (container usa repos in-memory / stubs).
 */
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { Application } from 'express';
import { Container } from '../../../src/composition/container';
import { createServer } from '../../../src/infrastructure/http/server';

let app: Application;

beforeAll(async () => {
  const container = Container.getInstance();
  app = await createServer({
    authController: container.authController,
    invitationController: container.invitationController,
    adminController: container.adminController,
    aiController: container.aiController,
    authMiddleware: container.authMiddleware,
    listController: container.listController,
    productController: container.productController,
    categoryController: container.categoryController,
    auditController: container.auditController,
    blueprintRepository: container.blueprintRepository,
    listaRepository: container.listaRepository,
    productoRepository: container.productoRepository,
    tokenService: container.tokenService,
    storeController: container.storeController,
    occasionListController: container.occasionListController,
    cacheIntegrityController: container.cacheIntegrityController,
    cachedAIService: container.cachedAIService
  });
});

afterAll(async () => {
  await Container.getInstance().disconnect();
});

describe('Smoke: rutas previamente huérfanas montadas', () => {
  test('GET /api/v1/occasion-lists/occasions es público y responde', async () => {
    const res = await request(app).get('/api/v1/occasion-lists/occasions');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.total).toBeGreaterThan(0);
  });

  test('POST /api/v1/occasion-lists/generate exige auth (401 sin token)', async () => {
    const res = await request(app).post('/api/v1/occasion-lists/generate').send({});
    expect(res.status).toBe(401);
  });

  test('GET /api/v1/stores exige auth (401 sin token)', async () => {
    const res = await request(app).get('/api/v1/stores');
    expect(res.status).toBe(401);
  });

  test('GET /api/v1/blueprints/publicos responde (público)', async () => {
    const res = await request(app).get('/api/v1/blueprints/publicos');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('items');
  });

  test('POST /api/v1/blueprints exige auth (401 sin token)', async () => {
    const res = await request(app).post('/api/v1/blueprints').send({});
    expect(res.status).toBe(401);
  });

  test('GET /api/v1/analytics/cache/realtime exige auth (401 sin token)', async () => {
    const res = await request(app).get('/api/v1/analytics/cache/realtime');
    expect(res.status).toBe(401);
  });

  test('GET /api/v1/admin/cache/integrity/stats exige auth (401 sin token)', async () => {
    const res = await request(app).get('/api/v1/admin/cache/integrity/stats');
    expect(res.status).toBe(401);
  });

  test('GET /api/v1/ai/purchase-habits/:userId exige auth (401 sin token) - CU-30', async () => {
    const res = await request(app).get(`/api/v1/ai/purchase-habits/${'11111111-1111-4111-8111-111111111111'}`);
    expect(res.status).toBe(401);
  });

  test('GET /health sigue respondiendo tras los montajes', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
  });

  test('GET / (raíz) sigue respondiendo tras los montajes', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
  });
});
