import express from 'express';
import request from 'supertest';
import { createAdminRoutes } from '@infrastructure/http/routes/adminRoutes';

const createStubAdminController = () => ({
  impersonateUser: jest.fn(async (_req, res) => res.status(501).json({ success: false })),
  endImpersonation: jest.fn(async (_req, res) => res.status(501).json({ success: false })),
  getImpersonationStatus: jest.fn(async (_req, res) => res.status(501).json({ success: false })),
  getImpersonationAuditLog: jest.fn(async (_req, res) => res.status(501).json({ success: false }))
});

const noopMiddleware = (_req: express.Request, _res: express.Response, next: express.NextFunction) => next();

describe('GET /api/v1/admin/security/test', () => {
  const originalNodeEnv = process.env['NODE_ENV'];
  const originalDatabaseUrl = process.env['DATABASE_URL'];

  afterEach(() => {
    if (originalNodeEnv === undefined) {
      delete process.env['NODE_ENV'];
    } else {
      process.env['NODE_ENV'] = originalNodeEnv;
    }

    if (originalDatabaseUrl === undefined) {
      delete process.env['DATABASE_URL'];
    } else {
      process.env['DATABASE_URL'] = originalDatabaseUrl;
    }
  });

  const buildApp = () => {
    const app = express();
    app.use(express.json());
    const controller = createStubAdminController();
    app.use('/api/v1/admin', createAdminRoutes(controller as any, noopMiddleware, noopMiddleware));
    return app;
  };

  it('devuelve un reporte exitoso cuando la configuración es segura', async () => {
    process.env['NODE_ENV'] = 'production';
    process.env['DATABASE_URL'] = 'postgresql://user:pass@localhost:5432/db?sslmode=require';

    const app = buildApp();
    const response = await request(app).get('/api/v1/admin/security/test');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.failedTests).toBe(4);
    expect(response.body.results).toHaveLength(4);
    expect(response.body.summary.critical).toBe(4);
    expect(response.body.report).toContain('Overall Security Score');
  });

  it('incluye hallazgos cuando hay configuraciones inseguras', async () => {
    process.env['NODE_ENV'] = 'production';
    process.env['DATABASE_URL'] = 'postgresql://user:pass@localhost:5432/db';

    const app = buildApp();
    const response = await request(app).get('/api/v1/admin/security/test');

    expect(response.status).toBe(200);
    expect(response.body.failedTests).toBeGreaterThan(4);
    expect(response.body.results.length).toBeGreaterThan(4);
    expect(response.body.results[0].passed).toBe(false);
    expect(response.body.summary.high).toBeGreaterThanOrEqual(1);
  });
});
