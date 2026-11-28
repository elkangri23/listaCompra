/**
 * Tests de integración de GET /admin/metrics/overview (fase 7).
 *
 * Monta las rutas reales (createAdminRoutes) con el AdminController real
 * y los repositorios en memoria; el authMiddleware y requireAdmin son
 * reales. Los datos se siembran con fechas relativas a hoy para que las
 * series por día/mes sean deterministas.
 */
import express from 'express';
import request from 'supertest';
import { createAdminRoutes } from '@infrastructure/http/routes/adminRoutes';
import { AdminController } from '@infrastructure/http/controllers/AdminController';
import { ImpersonateUser } from '@application/use-cases/admin/ImpersonateUser';
import { EndImpersonation } from '@application/use-cases/admin/EndImpersonation';
import { GetAdminMetricsOverview } from '@application/use-cases/admin/GetAdminMetricsOverview';
import { createAuthMiddleware } from '@infrastructure/http/middlewares/authMiddleware';
import { requireAdmin } from '@infrastructure/http/middlewares/roleMiddleware';
import { JWTTokenService } from '@infrastructure/external-services/auth/JWTTokenService';
import { InMemoryUsuarioRepository } from '@infrastructure/persistence/in-memory/InMemoryUsuarioRepository';
import { InMemoryListaRepository } from '@infrastructure/persistence/in-memory/InMemoryListaRepository';
import { InMemoryProductoRepository } from '@infrastructure/persistence/in-memory/InMemoryProductoRepository';
import { InMemoryInvitacionRepository } from '@infrastructure/persistence/in-memory/InMemoryInvitacionRepository';
import { InMemoryPermisoRepository } from '@infrastructure/persistence/in-memory/InMemoryPermisoRepository';
import { InMemoryLoginAttemptRepository } from '@infrastructure/persistence/in-memory/InMemoryLoginAttemptRepository';
import { InMemoryBackupRepository } from '@infrastructure/persistence/in-memory/InMemoryBackupRepository';
import { InMemoryAIUsageEventRepository } from '@infrastructure/persistence/in-memory/InMemoryAIUsageEventRepository';
import { InMemoryAdminMetricsRepository } from '@infrastructure/persistence/in-memory/InMemoryAdminMetricsRepository';
import { Usuario, RolUsuario } from '@domain/entities/Usuario';
import { Lista } from '@domain/entities/Lista';
import { Producto } from '@domain/entities/Producto';
import { Permiso } from '@domain/entities/Permiso';
import { PermissionType } from '@domain/value-objects/PermissionType';
import { Email } from '@domain/value-objects/Email';

const ADMIN_ID = '11111111-1111-4111-8111-111111111111';
const LUIS_ID = '22222222-2222-4222-8222-222222222222';
const ANA_ID = '33333333-3333-4333-8333-333333333333';
const VIEJO_ID = '44444444-4444-4444-8444-444444444444';

function daysAgo(n: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  d.setUTCHours(12, 0, 0, 0);
  return d;
}

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function monthKey(d: Date): string {
  return d.toISOString().slice(0, 7);
}

const TEST_PASSWORD = 'Test' + '123456' + '!';

const makeUser = (props: {
  id: string;
  email: string;
  rol?: RolUsuario;
  emailVerificado?: boolean;
  fechaCreacion?: Date;
}): Usuario => {
  const result = Usuario.create({
    id: props.id,
    email: Email.createUnsafe(props.email),
    password: TEST_PASSWORD,
    nombre: 'Test',
    apellidos: 'User',
    rol: props.rol ?? RolUsuario.USUARIO,
    activo: true,
    emailVerificado: props.emailVerificado ?? true,
    ...(props.fechaCreacion ? { fechaCreacion: props.fechaCreacion } : {}),
  });
  if (result.isFailure) {
    throw result.error;
  }
  return result.value;
};

const makeList = (props: {
  id: string;
  propietarioId: string;
  fechaCreacion?: Date;
}): Lista => {
  const result = Lista.create({
    id: props.id,
    nombre: `Lista ${props.id.slice(0, 8)}`,
    propietarioId: props.propietarioId,
    ...(props.fechaCreacion ? { fechaCreacion: props.fechaCreacion } : {}),
  });
  if (result.isFailure) {
    throw result.error;
  }
  return result.value;
};

const makeProduct = (props: {
  id: string;
  listaId: string;
  creadoPorId: string;
  categoriaId?: string;
  fechaCreacion?: Date;
}): Producto => {
  const result = Producto.create({
    id: props.id,
    nombre: `Producto ${props.id.slice(0, 8)}`,
    listaId: props.listaId,
    creadoPorId: props.creadoPorId,
    ...(props.categoriaId ? { categoriaId: props.categoriaId } : {}),
    ...(props.fechaCreacion ? { fechaCreacion: props.fechaCreacion } : {}),
  });
  if (result.isFailure) {
    throw result.error;
  }
  return result.value;
};

const buildApp = async (opts: { withBackup?: boolean } = {}) => {
  const usuarioRepository = new InMemoryUsuarioRepository();
  const listaRepository = new InMemoryListaRepository();
  const productoRepository = new InMemoryProductoRepository();
  const invitacionRepository = new InMemoryInvitacionRepository();
  const permisoRepository = new InMemoryPermisoRepository();
  const attemptRepository = new InMemoryLoginAttemptRepository();
  const backupRepository = new InMemoryBackupRepository();
  const aiUsageRepository = new InMemoryAIUsageEventRepository();

  // 4 usuarios: admin y luis verificados hoy, ana sin verificar ayer,
  // viejo verificado hace 40 días (fuera de la ventana de 30 días).
  await usuarioRepository.save(
    makeUser({ id: ADMIN_ID, email: 'admin@ejemplo.com', rol: RolUsuario.ADMIN })
  );
  await usuarioRepository.save(
    makeUser({ id: LUIS_ID, email: 'luis@ejemplo.com' })
  );
  await usuarioRepository.save(
    makeUser({
      id: ANA_ID,
      email: 'ana@ejemplo.com',
      emailVerificado: false,
      fechaCreacion: daysAgo(1),
    })
  );
  await usuarioRepository.save(
    makeUser({ id: VIEJO_ID, email: 'viejo@ejemplo.com', fechaCreacion: daysAgo(40) })
  );

  // 2 listas: luis hoy, admin ayer (compartida con luis por permiso).
  const listaLuis = makeList({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', propietarioId: LUIS_ID });
  const listaAdmin = makeList({
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    propietarioId: ADMIN_ID,
    fechaCreacion: daysAgo(1),
  });
  await listaRepository.save(listaLuis);
  await listaRepository.save(listaAdmin);
  const permiso = Permiso.create(
    'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    LUIS_ID,
    listaAdmin.id,
    PermissionType.lectura()
  );
  if (permiso.isFailure) {
    throw permiso.error;
  }
  await permisoRepository.save(permiso.value);

  // 3 productos: 2 hoy en la lista de luis (1 categorizado), 1 ayer
  // categorizado en la lista de admin.
  await productoRepository.save(
    makeProduct({
      id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      listaId: listaLuis.id,
      creadoPorId: LUIS_ID,
      categoriaId: 'cat-1',
    })
  );
  await productoRepository.save(
    makeProduct({
      id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      listaId: listaLuis.id,
      creadoPorId: LUIS_ID,
    })
  );
  await productoRepository.save(
    makeProduct({
      id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
      listaId: listaAdmin.id,
      creadoPorId: ADMIN_ID,
      categoriaId: 'cat-1',
      fechaCreacion: daysAgo(1),
    })
  );

  // Logins correctos hoy: luis dos veces (mismo email) y admin una.
  await attemptRepository.save({ email: 'luis@ejemplo.com', success: true, reason: null, ipAddress: null, userAgent: null });
  await attemptRepository.save({ email: 'luis@ejemplo.com', success: true, reason: null, ipAddress: null, userAgent: null });
  await attemptRepository.save({ email: 'admin@ejemplo.com', success: true, reason: null, ipAddress: null, userAgent: null });
  await attemptRepository.save({ email: 'intruso@ejemplo.com', success: false, reason: 'WRONG_PASSWORD', ipAddress: null, userAgent: null });

  if (opts.withBackup !== false) {
    await backupRepository.save({
      filename: 'listacompra-2026-11-28.sql.gz',
      sizeBytes: 9203,
      status: 'CREATED',
      source: 'SCHEDULED',
      createdByUserId: null,
      restoreReason: null,
      restoredAt: null,
      restoreRequestedAt: null,
      restoreRequestedByUserId: null,
      failureReason: null,
    });
  }

  await aiUsageRepository.save({
    userId: LUIS_ID,
    provider: 'freellmapi',
    model: 'qwen3.8-27b',
    operation: 'category-suggestions',
    latencyMs: 120,
    success: true,
    cached: true,
  });
  await aiUsageRepository.save({
    userId: null,
    provider: 'freellmapi',
    model: 'qwen3.8-27b',
    operation: 'category-suggestions',
    latencyMs: 200,
    success: false,
    cached: false,
  });

  const metricsRepository = new InMemoryAdminMetricsRepository(
    usuarioRepository,
    listaRepository,
    productoRepository,
    invitacionRepository,
    permisoRepository
  );

  const tokenService = new JWTTokenService();
  const controller = new AdminController(
    new ImpersonateUser(usuarioRepository, tokenService),
    new EndImpersonation(usuarioRepository, tokenService),
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    new GetAdminMetricsOverview(
      metricsRepository,
      attemptRepository,
      backupRepository,
      aiUsageRepository
    )
  );

  const app = express();
  app.use(express.json());
  app.use(
    '/api/v1/admin',
    createAdminRoutes(controller, createAuthMiddleware({ tokenService }), requireAdmin)
  );
  return app;
};

const mintToken = async (userId: string, email: string, role: RolUsuario): Promise<string> => {
  const tokenService = new JWTTokenService();
  const result = await tokenService.generateTokenPair({ userId, email, role });
  if (result.isFailure) {
    throw new Error(`No se pudo emitir el token: ${result.error.message}`);
  }
  return result.value.accessToken;
};

describe('GET /api/v1/admin/metrics/overview', () => {
  it('sin token → 401', async () => {
    const app = await buildApp();
    const response = await request(app).get('/api/v1/admin/metrics/overview');
    expect(response.status).toBe(401);
  });

  it('con USUARIO → 403 ADMIN_ROLE_REQUIRED', async () => {
    const app = await buildApp();
    const token = await mintToken(LUIS_ID, 'luis@ejemplo.com', RolUsuario.USUARIO);
    const response = await request(app)
      .get('/api/v1/admin/metrics/overview')
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(403);
    expect(response.body.code).toBe('ADMIN_ROLE_REQUIRED');
  });

  it('con ADMIN → 200 con la forma exacta del contrato y datos reales', async () => {
    const app = await buildApp();
    const token = await mintToken(ADMIN_ID, 'admin@ejemplo.com', RolUsuario.ADMIN);
    const response = await request(app)
      .get('/api/v1/admin/metrics/overview')
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    const data = response.body.data;

    // Crecimiento: series completas con ceros rellenados.
    expect(data.growth.registrationsByDay).toHaveLength(30);
    expect(data.growth.registrationsByDay[29]).toEqual({
      date: dateKey(daysAgo(0)),
      count: 2,
    });
    expect(data.growth.registrationsByDay[28]).toEqual({
      date: dateKey(daysAgo(1)),
      count: 1,
    });
    expect(data.growth.registrationsByDay[0]?.count).toBe(0);
    expect(data.growth.registrationsByMonth).toHaveLength(12);
    expect(data.growth.registrationsByMonth[11]).toEqual({
      month: monthKey(daysAgo(0)),
      count: 3,
    });
    expect(
      data.growth.registrationsByMonth.find(
        (m: { month: string }) => m.month === monthKey(daysAgo(40))
      )?.count
    ).toBe(1);
    expect(data.growth.listsByDay[29]?.count).toBe(1);
    expect(data.growth.listsByDay[28]?.count).toBe(1);
    expect(data.growth.productsByDay[29]?.count).toBe(2);
    expect(data.growth.productsByDay[28]?.count).toBe(1);
    expect(data.growth.totals).toEqual({
      users: 4,
      verifiedUsers: 3,
      verifiedPct: 75,
      lists: 2,
      products: 3,
      categorizedProducts: 2,
      categorizedPct: 66.7,
    });

    // Embudo: cada tramo subconjunto del anterior.
    expect(data.funnel).toEqual({
      registered: 4,
      verified: 3,
      withList: 2,
      withProduct: 2,
      shared: 1,
    });

    // Actividad: emails distintos con login correcto por día.
    expect(data.activity.activeUsersByDay).toHaveLength(30);
    expect(data.activity.activeUsersByDay[29]).toEqual({
      date: dateKey(daysAgo(0)),
      count: 2,
    });
    expect(data.activity.activeUsersByDay[28]?.count).toBe(0);
    expect(data.activity.retention.available).toBe(false);
    expect(typeof data.activity.retention.reason).toBe('string');
    expect(data.activity.retention.reason.length).toBeGreaterThan(0);

    // Salud de copias: última CREATED de hoy, no stale.
    expect(data.backupHealth.stale).toBe(false);
    expect(data.backupHealth.reason).toBeNull();
    expect(data.backupHealth.lastCreated.filename).toBe(
      'listacompra-2026-11-28.sql.gz'
    );
    expect(data.backupHealth.lastCreated.sizeBytes).toBe(9203);
    expect(data.backupHealth.lastCreated.ageHours).toBe(0);

    // Uso de IA, últimos 7 días.
    expect(data.aiUsage7d.total).toBe(2);
    expect(data.aiUsage7d.success).toBe(1);
    expect(data.aiUsage7d.failed).toBe(1);
    expect(data.aiUsage7d.cached).toBe(1);
    expect(data.aiUsage7d.byDay).toHaveLength(7);
    expect(data.aiUsage7d.byDay[6]).toEqual({
      date: dateKey(daysAgo(0)),
      total: 2,
      success: 1,
    });
  });

  it('sin copias CREATED → backupHealth stale con motivo y resto de datos intacto', async () => {
    const app = await buildApp({ withBackup: false });
    const token = await mintToken(ADMIN_ID, 'admin@ejemplo.com', RolUsuario.ADMIN);
    const response = await request(app)
      .get('/api/v1/admin/metrics/overview')
      .set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body.data.backupHealth).toEqual({
      lastCreated: null,
      stale: true,
      reason: 'No hay ninguna copia de seguridad en estado CREATED registrada.',
    });
    expect(response.body.data.growth.totals.users).toBe(4);
  });
});
