/**
 * Tests de comportamiento para rateLimitMiddleware.
 * Estos limiters hacen skip en NODE_ENV=test, así que el test cambia el
 * entorno ANTES de importar (import dinámico) y monta una app Express real.
 */

process.env['NODE_ENV'] = 'development';

import express from 'express';
import request from 'supertest';
import type * as RateLimitMiddlewareModule from '../../../../../src/infrastructure/http/middlewares/rateLimitMiddleware';

describe('rateLimitMiddleware (comportamiento con NODE_ENV=development)', () => {
  let rateLimitMiddleware: typeof RateLimitMiddlewareModule;

  beforeAll(async () => {
    rateLimitMiddleware = await import('../../../../../src/infrastructure/http/middlewares/rateLimitMiddleware');
  });

  const buildApp = (limiter: any) => {
    const app = express();
    app.use(limiter);
    app.get('/test', (_req: express.Request, res: express.Response) => res.status(200).json({ ok: true }));
    return app;
  };

  it('authRateLimit: 5ª petición pasa, la 6ª devuelve 429', async () => {
    const app = buildApp(rateLimitMiddleware.authRateLimit);

    for (let i = 0; i < 5; i++) {
      await request(app).get('/test').expect(200);
    }
    const blocked = await request(app).get('/test');
    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toBe('RATE_LIMIT_EXCEEDED');
  });

  it('sensitiveRateLimit: 10 operaciones permitidas y la 11ª bloqueada', async () => {
    const app = buildApp(rateLimitMiddleware.sensitiveRateLimit);

    for (let i = 0; i < 10; i++) {
      await request(app).get('/test').expect(200);
    }
    const blocked = await request(app).get('/test');
    expect(blocked.status).toBe(429);
    expect(blocked.body.retryAfter).toBe(3600);
  });

  it('apiRateLimit: 100 requests permitidas y la 101ª bloqueada', async () => {
    const app = buildApp(rateLimitMiddleware.apiRateLimit);

    for (let i = 0; i < 100; i++) {
      await request(app).get('/test').expect(200);
    }
    const blocked = await request(app).get('/test');
    expect(blocked.status).toBe(429);
    expect(blocked.body.message).toContain('Demasiadas peticiones');
  });

  it('aiRateLimitPerUser: límite por usuario (20/h)', async () => {
    const app = buildApp(rateLimitMiddleware.aiRateLimitPerUser);

    for (let i = 0; i < 20; i++) {
      await request(app).get('/test').expect(200);
    }
    const blocked = await request(app).get('/test');
    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toBe('AI_RATE_LIMIT_EXCEEDED');
  });
});
