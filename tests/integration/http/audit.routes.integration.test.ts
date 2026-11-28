/**
 * Integration tests de las rutas de auditoría (audit.routes.ts)
 * Requiere PostgreSQL levantado (docker-compose up -d).
 *
 * Harness: app real (createServer + container), usuario ADMIN real en BD
 * creado vía Prisma y login por API para obtener el JWT.
 */

import request from 'supertest';
import type { Application } from 'express';
import { Password } from '../../../src/domain/value-objects/Password';
import { RolUsuario } from '../../../src/domain/entities/Usuario';

const ADMIN_EMAIL = 'audit-admin@test.local';
const ADMIN_PASSWORD = 'Admin123!';

describe('Audit Routes Integration Test', () => {
  let app: Application;
  let prisma: any;
  let token: string;
  let userToken: string;
  let adminUserId: string;

  beforeAll(async () => {
    // Este test necesita el container con repositorios Prisma REALES:
    // en NODE_ENV=test el container usa in-memory y el login no vería la BD.
    // Se importa dinámicamente después de fijar NODE_ENV (los imports estáticos
    // se hoistean antes de que podamos cambiar la variable).
    process.env['NODE_ENV'] = 'development';
    const { Container } = await import('../../../src/composition/container');
    const { createServer } = await import('../../../src/infrastructure/http/server');

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
    } as any);

    prisma = container.prisma;

    // Crear usuario ADMIN real en BD
    const hashResult = await container.passwordHasher.hash(Password.createUnsafe(ADMIN_PASSWORD));
    if (hashResult.isFailure) {
      throw new Error('No se pudo hashear la contraseña de test');
    }
    const passwordHash = hashResult.value;
    adminUserId = 'audit-admin-user-' + Date.now();
    await prisma.usuario.upsert({
      where: { email: ADMIN_EMAIL },
      update: {
        password: passwordHash,
        rol: 'ADMIN',
        activo: true,
        emailVerificado: true
      },
      create: {
        id: adminUserId,
        email: ADMIN_EMAIL,
        password: passwordHash,
        nombre: 'Audit',
        rol: 'ADMIN',
        activo: true,
        emailVerificado: true
      }
    });

    // Login real para obtener el JWT
    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });

    token = loginResponse.body.data?.tokens?.accessToken
      ?? loginResponse.body.data?.accessToken
      ?? loginResponse.body.accessToken;
    expect(token).toBeTruthy();

    // Token USUARIO (sin pasar por BD: requireAdmin solo mira el rol del JWT)
    const userPair = await container.tokenService.generateTokenPair({
      userId: '33333333-3333-4333-8333-333333333333',
      email: 'audit-usuario@test.local',
      role: RolUsuario.USUARIO,
    });
    if (userPair.isFailure) {
      throw new Error('No se pudo emitir el token USUARIO de test');
    }
    userToken = userPair.value.accessToken;
  }, 60000);

  afterAll(async () => {
    // Limpieza del usuario de prueba
    try {
      await prisma.usuario.deleteMany({ where: { email: ADMIN_EMAIL } });
    } catch {
      // noop
    } finally {
      await prisma.$disconnect();
      process.env['NODE_ENV'] = 'test';
    }
  });

  beforeEach(async () => {
    await prisma.auditEntry.deleteMany({});
  });

  it('should get audit history for a list', async () => {
    await prisma.auditEntry.create({
      data: {
        entityType: 'Lista',
        entityId: 'list-1',
        changeType: 'CREATE',
      },
    });

    const response = await request(app)
      .get('/api/v1/audit/lists/list-1')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.entries.length).toBe(1);
    expect(response.body.data.entries[0].entityId).toBe('list-1');
  });

  it('should get audit history for a product', async () => {
    await prisma.auditEntry.create({
      data: {
        entityType: 'Producto',
        entityId: 'prod-1',
        changeType: 'UPDATE',
      },
    });

    const response = await request(app)
      .get('/api/v1/audit/products/prod-1')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.entries.length).toBe(1);
    expect(response.body.data.entries[0].entityId).toBe('prod-1');
  });

  it('should get global audit history for admin', async () => {
    await prisma.auditEntry.createMany({
      data: [
        { entityType: 'Lista', entityId: '1', changeType: 'CREATE' },
        { entityType: 'Producto', entityId: '2', changeType: 'DELETE' },
      ],
    });

    const response = await request(app)
      .get('/api/v1/admin/audit')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.total).toBe(2);
  });

  it('should reject global audit history without authentication', async () => {
    const response = await request(app)
      .get('/api/v1/admin/audit');

    expect(response.status).toBe(401);
  });

  describe('GET /api/v1/admin/audit-logs (fase 4, panel admin)', () => {
    it('ADMIN lista con sobre {success, data} y entradas reales', async () => {
      await prisma.auditEntry.createMany({
        data: [
          { entityType: 'Lista', entityId: 'l1', changeType: 'UPDATE', changedByUserId: adminUserId },
          { entityType: 'Producto', entityId: 'p1', changeType: 'UPDATE', changedByUserId: adminUserId },
        ],
      });

      const response = await request(app)
        .get('/api/v1/admin/audit-logs')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.total).toBe(2);
      expect(response.body.data.entries).toHaveLength(2);
      expect(response.body.data.entries[0].entityType).toBeDefined();
      expect(response.body.data.page).toBe(1);
      expect(response.body.data.pageSize).toBe(10);
    });

    it('filtra por entityType', async () => {
      await prisma.auditEntry.createMany({
        data: [
          { entityType: 'Lista', entityId: 'l1', changeType: 'UPDATE' },
          { entityType: 'Producto', entityId: 'p1', changeType: 'UPDATE' },
          { entityType: 'Producto', entityId: 'p2', changeType: 'CREATE' },
        ],
      });

      const response = await request(app)
        .get('/api/v1/admin/audit-logs?entityType=Producto')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.total).toBe(2);
      expect(response.body.data.entries.every((e: any) => e.entityType === 'Producto')).toBe(true);
    });

    it('filtra por changeType y por changedByUserId', async () => {
      await prisma.auditEntry.createMany({
        data: [
          { entityType: 'Lista', entityId: 'l1', changeType: 'CREATE', changedByUserId: adminUserId },
          { entityType: 'Lista', entityId: 'l2', changeType: 'UPDATE', changedByUserId: adminUserId },
          { entityType: 'Lista', entityId: 'l3', changeType: 'UPDATE', changedByUserId: 'otro-usuario' },
        ],
      });

      const byType = await request(app)
        .get('/api/v1/admin/audit-logs?changeType=CREATE')
        .set('Authorization', `Bearer ${token}`);
      expect(byType.body.data.total).toBe(1);
      expect(byType.body.data.entries[0].entityId).toBe('l1');

      const byUser = await request(app)
        .get(`/api/v1/admin/audit-logs?changedByUserId=${adminUserId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(byUser.body.data.total).toBe(2);
    });

    it('filtra por fechas', async () => {
      await prisma.auditEntry.createMany({
        data: [
          { entityType: 'Lista', entityId: 'l-vieja', changeType: 'UPDATE', timestamp: new Date('2025-01-15T10:00:00Z') },
          { entityType: 'Lista', entityId: 'l-nueva', changeType: 'UPDATE', timestamp: new Date('2025-06-15T10:00:00Z') },
        ],
      });

      const response = await request(app)
        .get('/api/v1/admin/audit-logs?startDate=2025-06-01T00:00:00Z&endDate=2025-12-31T23:59:59Z')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.total).toBe(1);
      expect(response.body.data.entries[0].entityId).toBe('l-nueva');
    });

    it('pagina: page 2 de 12 con pageSize 5', async () => {
      await prisma.auditEntry.createMany({
        data: Array.from({ length: 12 }, (_, i) => ({
          entityType: 'Producto',
          entityId: `p-${i}`,
          changeType: 'UPDATE' as const,
        })),
      });

      const response = await request(app)
        .get('/api/v1/admin/audit-logs?page=2&pageSize=5')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.total).toBe(12);
      expect(response.body.data.entries).toHaveLength(5);
      expect(response.body.data.page).toBe(2);
      expect(response.body.data.pageSize).toBe(5);
      expect(response.body.data.totalPages).toBe(3);
    });

    it('lista vacía → total 0 sin error', async () => {
      const response = await request(app)
        .get('/api/v1/admin/audit-logs')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.total).toBe(0);
      expect(response.body.data.entries).toEqual([]);
      expect(response.body.data.totalPages).toBe(0);
    });

    it('USUARIO → 403 ADMIN_ROLE_REQUIRED', async () => {
      const response = await request(app)
        .get('/api/v1/admin/audit-logs')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(403);
      expect(response.body.code).toBe('ADMIN_ROLE_REQUIRED');
    });

    it('sin token → 401', async () => {
      const response = await request(app).get('/api/v1/admin/audit-logs');

      expect(response.status).toBe(401);
    });
  });
});
