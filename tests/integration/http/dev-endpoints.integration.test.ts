import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { Application } from 'express';
import { Container } from '../../../src/composition/container';
import { createServer } from '../../../src/infrastructure/http/server';

describe('Development Endpoints Integration', () => {
  let app: Application;
  let container: Container;

  beforeAll(async () => {
    container = Container.getInstance();
    await container.connect();
    
    app = await createServer({
      authController: container.authController,
      invitationController: container.invitationController,
      adminController: container.adminController,
      aiController: container.aiController,
      authMiddleware: container.authMiddleware,
      listController: container.listController,
      productController: container.productController,
      categoryController: container.categoryController,
      auditController: container.auditController
    });
  });

  afterAll(async () => {
    await container.disconnect();
  });

  describe('GET /api/v1/dev/events', () => {
    test('should return event system information', async () => {
      const response = await request(app)
        .get('/api/v1/dev/events')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('type');
      expect(response.body.data).toHaveProperty('message');
    });
  });

  describe('POST /api/v1/dev/events/test', () => {
    test('should publish a test event', async () => {
      const response = await request(app)
        .post('/api/v1/dev/events/test')
        .send({
          eventType: 'TestEvent',
          data: { test: 'data' }
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Evento de prueba publicado correctamente'
      });
    });

    test('should verify event system after publishing', async () => {
      const response = await request(app)
        .get('/api/v1/dev/events')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('type');
    });
  });

  describe('DELETE /api/v1/dev/events', () => {
    test('should handle event system reset', async () => {
      const response = await request(app)
        .delete('/api/v1/dev/events')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body).toHaveProperty('message');
    });

    test('should continue working after reset', async () => {
      const response = await request(app)
        .get('/api/v1/dev/events')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('type');
    });
  });
});
