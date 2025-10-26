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
      authController: container.authController
    });
  });

  afterAll(async () => {
    await container.disconnect();
  });

  describe('GET /api/v1/dev/events', () => {
    test('should return empty events initially', async () => {
      const response = await request(app)
        .get('/api/v1/dev/events')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          events: [],
          stats: {
            totalEvents: 0,
            lastEvent: null
          },
          message: 'Eventos del MockEventPublisher'
        }
      });
    });
  });

  describe('POST /api/v1/dev/events/test', () => {
    test('should publish a test event', async () => {
      const response = await request(app)
        .post('/api/v1/dev/events/test')
        .send({
          exchange: 'test_exchange',
          routingKey: 'test.key',
          message: { test: 'data' }
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Evento de prueba publicado correctamente',
        data: {
          exchange: 'test_exchange',
          routingKey: 'test.key',
          message: { test: 'data' }
        }
      });
    });

    test('should show published event in events list', async () => {
      const response = await request(app)
        .get('/api/v1/dev/events')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.events).toHaveLength(1);
      expect(response.body.data.stats.totalEvents).toBe(1);
    });
  });

  describe('DELETE /api/v1/dev/events', () => {
    test('should clear all events', async () => {
      const response = await request(app)
        .delete('/api/v1/dev/events')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Eventos limpiados correctamente'
      });
    });

    test('should have empty events after clearing', async () => {
      const response = await request(app)
        .get('/api/v1/dev/events')
        .expect(200);

      expect(response.body.data.events).toHaveLength(0);
      expect(response.body.data.stats.totalEvents).toBe(0);
    });
  });
});