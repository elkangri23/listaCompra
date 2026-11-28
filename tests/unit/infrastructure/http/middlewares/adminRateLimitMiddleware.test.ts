/**
 * Test básico para verificar el funcionamiento del rate limiting administrativo
 */

import express from 'express';
import request from 'supertest';
import { createAdminRateLimitMiddleware, getRateLimitInfo } from '../../../../../src/infrastructure/http/middlewares/adminRateLimitMiddleware';

describe('Admin Rate Limit Middleware', () => {
  describe('createAdminRateLimitMiddleware', () => {
    it('debería crear el middleware sin errores', () => {
      const middleware = createAdminRateLimitMiddleware();
      expect(middleware).toBeDefined();
      expect(typeof middleware).toBe('function');
    });
  });

  describe('getRateLimitInfo', () => {
    it('debería retornar información correcta de los límites', () => {
      const info = getRateLimitInfo();
      
      expect(info).toBeDefined();
      expect(info.general).toBeDefined();
      expect(info.impersonation).toBeDefined();
      expect(info.audit).toBeDefined();

      // Verificar límites generales
      expect(info.general.maxRequests).toBe(10);
      expect(info.general.windowMs).toBe(15 * 60 * 1000); // 15 minutos

      // Verificar límites de impersonación
      expect(info.impersonation.maxRequests).toBe(5);
      expect(info.impersonation.windowMs).toBe(60 * 60 * 1000); // 1 hora

      // Verificar límites de auditoría
      expect(info.audit.maxRequests).toBe(20);
      expect(info.audit.windowMs).toBe(5 * 60 * 1000); // 5 minutos
    });

    it('debería incluir descripciones para cada tipo de límite', () => {
      const info = getRateLimitInfo();
      
      expect(info.general.description).toContain('General admin');
      expect(info.impersonation.description).toContain('impersonation');
      expect(info.audit.description).toContain('Audit');
    });

    it('debería incluir el presupuesto propio de lecturas (60/15 min)', () => {
      const info = getRateLimitInfo();

      expect(info.read).toBeDefined();
      expect(info.read.maxRequests).toBe(60);
      expect(info.read.windowMs).toBe(15 * 60 * 1000); // 15 minutos
      expect(info.read.description).toContain('Admin read');
    });
  });

  /**
   * Tests conductuales con supertest: el limitador se salta en NODE_ENV=test,
   * así que estos tests lo activan poniendo NODE_ENV=development durante su
   * ejecución y lo restauran después. Cada test usa un userId distinto porque
   * los limitadores son singletons de módulo y comparten el store en memoria.
   */
  describe('Presupuestos separados de lectura y escritura (2026-11-28)', () => {
    const previousNodeEnv = process.env['NODE_ENV'];
    let userCounter = 0;

    const buildApp = (userId: string) => {
      const app = express();
      app.use(express.json());
      app.use((req, _res, next) => {
        (req as any).user = { id: userId };
        next();
      });
      const limiter = createAdminRateLimitMiddleware();
      app.get('/admin/backups', limiter, (_req, res) => res.status(200).json({ ok: true }));
      app.post('/admin/backups', limiter, (_req, res) => res.status(201).json({ ok: true }));
      app.get('/admin/audit-logs', limiter, (_req, res) => res.status(200).json({ ok: true }));
      app.post('/admin/impersonate', limiter, (_req, res) => res.status(200).json({ ok: true }));
      return app;
    };

    const freshUser = () => `rate-limit-test-user-${++userCounter}`;

    beforeEach(() => {
      process.env['NODE_ENV'] = 'development';
    });

    afterEach(() => {
      process.env['NODE_ENV'] = previousNodeEnv;
    });

    it('uso normal del panel: 30 lecturas seguidas no reciben 429', async () => {
      // Simula una sesión de panel: Seguridad (15) + Copias (7,5) + navegación.
      // Con el presupuesto único antiguo (10/15 min) la 11ª ya era 429.
      const app = buildApp(freshUser());

      for (let i = 0; i < 30; i++) {
        const res = await request(app).get('/admin/backups');
        expect(res.status).toBe(200);
      }
    });

    it('las escrituras siguen limitadas a 10/15 min', async () => {
      const app = buildApp(freshUser());

      for (let i = 0; i < 10; i++) {
        const res = await request(app).post('/admin/backups');
        expect(res.status).toBe(201);
      }

      const blocked = await request(app).post('/admin/backups');
      expect(blocked.status).toBe(429);
      expect(blocked.body.type).toBe('admin_rate_limit');
    });

    it('las lecturas no consumen el presupuesto de escrituras', async () => {
      const app = buildApp(freshUser());

      for (let i = 0; i < 30; i++) {
        const res = await request(app).get('/admin/backups');
        expect(res.status).toBe(200);
      }

      for (let i = 0; i < 10; i++) {
        const res = await request(app).post('/admin/backups');
        expect(res.status).toBe(201);
      }

      const blocked = await request(app).post('/admin/backups');
      expect(blocked.status).toBe(429);
    });

    it('las lecturas tienen su propio tope de 60/15 min', async () => {
      const app = buildApp(freshUser());

      for (let i = 0; i < 60; i++) {
        const res = await request(app).get('/admin/backups');
        expect(res.status).toBe(200);
      }

      const blocked = await request(app).get('/admin/backups');
      expect(blocked.status).toBe(429);
      expect(blocked.body.type).toBe('admin_read_rate_limit');
    });

    it('el enrutado por criticidad sigue intacto (auditoría 20/5 min, impersonación 5/h)', async () => {
      const app = buildApp(freshUser());

      for (let i = 0; i < 20; i++) {
        const res = await request(app).get('/admin/audit-logs');
        expect(res.status).toBe(200);
      }
      const auditBlocked = await request(app).get('/admin/audit-logs');
      expect(auditBlocked.status).toBe(429);
      expect(auditBlocked.body.type).toBe('audit_rate_limit');

      for (let i = 0; i < 5; i++) {
        const res = await request(app).post('/admin/impersonate');
        expect(res.status).toBe(200);
      }
      const impersonationBlocked = await request(app).post('/admin/impersonate');
      expect(impersonationBlocked.status).toBe(429);
      expect(impersonationBlocked.body.type).toBe('impersonation_rate_limit');
    });
  });
});
