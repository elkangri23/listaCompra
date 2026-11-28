/**
 * Tests de integración de los endpoints de copias del panel de
 * administración (fase 6): GET /admin/backups, POST /admin/backups,
 * GET /admin/backups/:id/download y POST /admin/backups/:id/restore.
 *
 * Monta las rutas reales (createAdminRoutes) con el AdminController real
 * y los repositorios en memoria; el authMiddleware y requireAdmin son
 * reales y los JWTs son reales. El almacén de ficheros es el real
 * (LocalBackupFileStore) sobre un directorio temporal con un .sql.gz.
 */

import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

import express from 'express';
import request from 'supertest';
import { createAdminRoutes } from '@infrastructure/http/routes/adminRoutes';
import { AdminController } from '@infrastructure/http/controllers/AdminController';
import { ImpersonateUser } from '@application/use-cases/admin/ImpersonateUser';
import { EndImpersonation } from '@application/use-cases/admin/EndImpersonation';
import { GetBackups } from '@application/use-cases/admin/GetBackups';
import { RequestBackup } from '@application/use-cases/admin/RequestBackup';
import { DownloadBackup } from '@application/use-cases/admin/DownloadBackup';
import { RequestRestore } from '@application/use-cases/admin/RequestRestore';
import { createAuthMiddleware } from '@infrastructure/http/middlewares/authMiddleware';
import { requireAdmin } from '@infrastructure/http/middlewares/roleMiddleware';
import { JWTTokenService } from '@infrastructure/external-services/auth/JWTTokenService';
import { InMemoryUsuarioRepository } from '@infrastructure/persistence/in-memory/InMemoryUsuarioRepository';
import { InMemoryBackupRepository } from '@infrastructure/persistence/in-memory/InMemoryBackupRepository';
import { LocalBackupFileStore } from '@infrastructure/external-services/backup/LocalBackupFileStore';
import { Usuario, RolUsuario } from '@domain/entities/Usuario';
import { Email } from '@domain/value-objects/Email';
import type {
  BackupStatus,
  NewBackup,
} from '@application/ports/repositories/IBackupRepository';

const ADMIN_ID = '11111111-1111-4111-8111-111111111111';
const LUIS_ID = '22222222-2222-4222-8222-222222222222';

const makeUser = (props: { id: string; email: string; rol?: RolUsuario }): Usuario => {
  const result = Usuario.create({
    id: props.id,
    email: Email.createUnsafe(props.email),
    password: 'hashed-password-very-long',
    nombre: 'Test',
    apellidos: 'User',
    rol: props.rol ?? RolUsuario.USUARIO,
    activo: true,
    emailVerificado: true,
  });
  if (result.isFailure) {
    throw result.error;
  }
  return result.value;
};

const GZ_CONTENT = gzipSync('-- dump de prueba --\nSELECT 1;\n');

const buildApp = async (seed?: (repo: InMemoryBackupRepository) => Promise<void>) => {
  const usuarioRepository = new InMemoryUsuarioRepository();
  const backupRepository = new InMemoryBackupRepository();
  const backupDir = await mkdtemp(join(tmpdir(), 'backups-'));
  await writeFile(join(backupDir, 'listacompra-20261128-040000.sql.gz'), GZ_CONTENT);

  await usuarioRepository.save(makeUser({ id: ADMIN_ID, email: 'admin@ejemplo.com', rol: RolUsuario.ADMIN }));
  await usuarioRepository.save(makeUser({ id: LUIS_ID, email: 'luis@ejemplo.com' }));
  if (seed) {
    await seed(backupRepository);
  }

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
    new GetBackups(backupRepository),
    new RequestBackup(backupRepository),
    new DownloadBackup(backupRepository, new LocalBackupFileStore(backupDir)),
    new RequestRestore(backupRepository)
  );

  const app = express();
  app.use(express.json());
  app.use(
    '/api/v1/admin',
    createAdminRoutes(controller, createAuthMiddleware({ tokenService }), requireAdmin)
  );
  return { app, backupRepository };
};

const seedCreated = (status: BackupStatus = 'CREATED') => async (repo: InMemoryBackupRepository) => {
  await repo.save({
    filename: 'listacompra-20261128-040000.sql.gz',
    sizeBytes: GZ_CONTENT.length,
    status,
    source: 'SCHEDULED',
    createdByUserId: null,
    restoreReason: null,
    restoredAt: null,
    restoreRequestedAt: null,
    restoreRequestedByUserId: null,
    failureReason: null,
  } satisfies NewBackup);
};

const mintToken = async (userId: string, email: string, role: RolUsuario): Promise<string> => {
  const tokenService = new JWTTokenService();
  const result = await tokenService.generateTokenPair({ userId, email, role });
  if (result.isFailure) {
    throw new Error(`No se pudo emitir el token: ${result.error.message}`);
  }
  return result.value.accessToken;
};

describe('Endpoints de copias del panel admin', () => {
  describe('GET /api/v1/admin/backups', () => {
    it('sin token → 401', async () => {
      const { app } = await buildApp();
      const response = await request(app).get('/api/v1/admin/backups');
      expect(response.status).toBe(401);
    });

    it('con USUARIO → 403 ADMIN_ROLE_REQUIRED', async () => {
      const { app } = await buildApp();
      const token = await mintToken(LUIS_ID, 'luis@ejemplo.com', RolUsuario.USUARIO);
      const response = await request(app)
        .get('/api/v1/admin/backups')
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(403);
      expect(response.body.code).toBe('ADMIN_ROLE_REQUIRED');
    });

    it('con ADMIN y sin copias → 200 con total 0', async () => {
      const { app } = await buildApp();
      const token = await mintToken(ADMIN_ID, 'admin@ejemplo.com', RolUsuario.ADMIN);
      const response = await request(app)
        .get('/api/v1/admin/backups')
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual({ backups: [], total: 0, page: 1, pageSize: 20, totalPages: 1 });
    });

    it('con ADMIN y copias → 200 con los datos y paginación', async () => {
      const { app } = await buildApp(seedCreated());
      const token = await mintToken(ADMIN_ID, 'admin@ejemplo.com', RolUsuario.ADMIN);
      const response = await request(app)
        .get('/api/v1/admin/backups?page=1&pageSize=20')
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(200);
      expect(response.body.data.total).toBe(1);
      const backup = response.body.data.backups[0];
      expect(backup.filename).toBe('listacompra-20261128-040000.sql.gz');
      expect(backup.status).toBe('CREATED');
      expect(backup.source).toBe('SCHEDULED');
      expect(backup.sizeBytes).toBe(GZ_CONTENT.length);
      expect(backup.createdByUserId).toBeNull();
      expect(backup.restoreReason).toBeNull();
      expect(backup.restoredAt).toBeNull();
    });
  });

  describe('POST /api/v1/admin/backups', () => {
    it('sin token → 401', async () => {
      const { app } = await buildApp();
      const response = await request(app).post('/api/v1/admin/backups');
      expect(response.status).toBe(401);
    });

    it('con USUARIO → 403', async () => {
      const { app } = await buildApp();
      const token = await mintToken(LUIS_ID, 'luis@ejemplo.com', RolUsuario.USUARIO);
      const response = await request(app)
        .post('/api/v1/admin/backups')
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(403);
    });

    it('con ADMIN → 201 PENDING MANUAL con el admin como creador', async () => {
      const { app } = await buildApp();
      const token = await mintToken(ADMIN_ID, 'admin@ejemplo.com', RolUsuario.ADMIN);
      const response = await request(app)
        .post('/api/v1/admin/backups')
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      const backup = response.body.data.backup;
      expect(backup.status).toBe('PENDING');
      expect(backup.source).toBe('MANUAL');
      expect(backup.sizeBytes).toBe(0);
      expect(backup.createdByUserId).toBe(ADMIN_ID);
      expect(backup.filename).toMatch(/^manual-.*\.sql\.gz$/);
    });

    it('segunda solicitud con una PENDING → 409', async () => {
      const { app } = await buildApp();
      const token = await mintToken(ADMIN_ID, 'admin@ejemplo.com', RolUsuario.ADMIN);
      const first = await request(app)
        .post('/api/v1/admin/backups')
        .set('Authorization', `Bearer ${token}`);
      expect(first.status).toBe(201);
      const second = await request(app)
        .post('/api/v1/admin/backups')
        .set('Authorization', `Bearer ${token}`);
      expect(second.status).toBe(409);
      expect(second.body.error).toMatch(/pendiente/);
    });
  });

  describe('GET /api/v1/admin/backups/:id/download', () => {
    it('sin token → 401', async () => {
      const { app, backupRepository } = await buildApp(seedCreated());
      const created = (await backupRepository.findMany(1, 1)).backups[0];
      const response = await request(app).get(`/api/v1/admin/backups/${created?.id}/download`);
      expect(response.status).toBe(401);
    });

    it('con USUARIO → 403', async () => {
      const { app, backupRepository } = await buildApp(seedCreated());
      const created = (await backupRepository.findMany(1, 1)).backups[0];
      const token = await mintToken(LUIS_ID, 'luis@ejemplo.com', RolUsuario.USUARIO);
      const response = await request(app)
        .get(`/api/v1/admin/backups/${created?.id}/download`)
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(403);
    });

    it('id inexistente → 404', async () => {
      const { app } = await buildApp();
      const token = await mintToken(ADMIN_ID, 'admin@ejemplo.com', RolUsuario.ADMIN);
      const response = await request(app)
        .get('/api/v1/admin/backups/id-inexistente/download')
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(404);
    });

    it('fichero no en disco → 404', async () => {
      const { app, backupRepository } = await buildApp(async (repo) => {
        await repo.save({
          filename: 'listacompra-20261127-040000.sql.gz',
          sizeBytes: 100,
          status: 'CREATED',
          source: 'SCHEDULED',
          createdByUserId: null,
          restoreReason: null,
          restoredAt: null,
          restoreRequestedAt: null,
          restoreRequestedByUserId: null,
          failureReason: null,
        } satisfies NewBackup);
      });
      const created = (await backupRepository.findMany(1, 1)).backups[0];
      const token = await mintToken(ADMIN_ID, 'admin@ejemplo.com', RolUsuario.ADMIN);
      const response = await request(app)
        .get(`/api/v1/admin/backups/${created?.id}/download`)
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(404);
    });

    it('con ADMIN y fichero en disco → 200 application/gzip con el contenido', async () => {
      const { app, backupRepository } = await buildApp(seedCreated());
      const created = (await backupRepository.findMany(1, 1)).backups[0];
      const token = await mintToken(ADMIN_ID, 'admin@ejemplo.com', RolUsuario.ADMIN);
      const response = await request(app)
        .get(`/api/v1/admin/backups/${created?.id}/download`)
        .set('Authorization', `Bearer ${token}`);
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('application/gzip');
      expect(response.headers['content-disposition']).toContain(
        'attachment; filename="listacompra-20261128-040000.sql.gz"'
      );
      expect(Buffer.compare(response.body, GZ_CONTENT)).toBe(0);
    });
  });

  describe('POST /api/v1/admin/backups/:id/restore', () => {
    it('sin token → 401', async () => {
      const { app, backupRepository } = await buildApp(seedCreated());
      const created = (await backupRepository.findMany(1, 1)).backups[0];
      const response = await request(app)
        .post(`/api/v1/admin/backups/${created?.id}/restore`)
        .send({ confirmacion: 'RESTAURAR', motivo: 'prueba' });
      expect(response.status).toBe(401);
    });

    it('con USUARIO → 403', async () => {
      const { app, backupRepository } = await buildApp(seedCreated());
      const created = (await backupRepository.findMany(1, 1)).backups[0];
      const token = await mintToken(LUIS_ID, 'luis@ejemplo.com', RolUsuario.USUARIO);
      const response = await request(app)
        .post(`/api/v1/admin/backups/${created?.id}/restore`)
        .set('Authorization', `Bearer ${token}`)
        .send({ confirmacion: 'RESTAURAR', motivo: 'prueba' });
      expect(response.status).toBe(403);
    });

    it('id inexistente → 404', async () => {
      const { app } = await buildApp();
      const token = await mintToken(ADMIN_ID, 'admin@ejemplo.com', RolUsuario.ADMIN);
      const response = await request(app)
        .post('/api/v1/admin/backups/id-inexistente/restore')
        .set('Authorization', `Bearer ${token}`)
        .send({ confirmacion: 'RESTAURAR', motivo: 'prueba' });
      expect(response.status).toBe(404);
    });

    it('confirmación incorrecta → 400', async () => {
      const { app, backupRepository } = await buildApp(seedCreated());
      const created = (await backupRepository.findMany(1, 1)).backups[0];
      const token = await mintToken(ADMIN_ID, 'admin@ejemplo.com', RolUsuario.ADMIN);
      const response = await request(app)
        .post(`/api/v1/admin/backups/${created?.id}/restore`)
        .set('Authorization', `Bearer ${token}`)
        .send({ confirmacion: 'restaurar', motivo: 'prueba' });
      expect(response.status).toBe(400);
    });

    it('motivo vacío → 400', async () => {
      const { app, backupRepository } = await buildApp(seedCreated());
      const created = (await backupRepository.findMany(1, 1)).backups[0];
      const token = await mintToken(ADMIN_ID, 'admin@ejemplo.com', RolUsuario.ADMIN);
      const response = await request(app)
        .post(`/api/v1/admin/backups/${created?.id}/restore`)
        .set('Authorization', `Bearer ${token}`)
        .send({ confirmacion: 'RESTAURAR', motivo: '   ' });
      expect(response.status).toBe(400);
    });

    it('copia PENDING → 400', async () => {
      const { app, backupRepository } = await buildApp(seedCreated('PENDING'));
      const created = (await backupRepository.findMany(1, 1)).backups[0];
      const token = await mintToken(ADMIN_ID, 'admin@ejemplo.com', RolUsuario.ADMIN);
      const response = await request(app)
        .post(`/api/v1/admin/backups/${created?.id}/restore`)
        .set('Authorization', `Bearer ${token}`)
        .send({ confirmacion: 'RESTAURAR', motivo: 'prueba' });
      expect(response.status).toBe(400);
    });

    it('con ADMIN → 202 RESTORING con motivo', async () => {
      const { app, backupRepository } = await buildApp(seedCreated());
      const created = (await backupRepository.findMany(1, 1)).backups[0];
      const token = await mintToken(ADMIN_ID, 'admin@ejemplo.com', RolUsuario.ADMIN);
      const response = await request(app)
        .post(`/api/v1/admin/backups/${created?.id}/restore`)
        .set('Authorization', `Bearer ${token}`)
        .send({ confirmacion: 'RESTAURAR', motivo: 'Revertir el despliegue roto' });
      expect(response.status).toBe(202);
      expect(response.body.success).toBe(true);
      expect(response.body.data.backup.status).toBe('RESTORING');
      expect(response.body.data.backup.restoreReason).toBe('Revertir el despliegue roto');
    });

    it('segunda restauración con una RESTORING → 409', async () => {
      const { app, backupRepository } = await buildApp(async (repo) => {
        await seedCreated()(repo);
        await repo.save({
          filename: 'listacompra-20261127-040000.sql.gz',
          sizeBytes: 100,
          status: 'CREATED',
          source: 'SCHEDULED',
          createdByUserId: null,
          restoreReason: null,
          restoredAt: null,
          restoreRequestedAt: null,
          restoreRequestedByUserId: null,
          failureReason: null,
        } satisfies NewBackup);
      });
      const token = await mintToken(ADMIN_ID, 'admin@ejemplo.com', RolUsuario.ADMIN);
      const all = (await backupRepository.findMany(1, 10)).backups;
      const first = await request(app)
        .post(`/api/v1/admin/backups/${all[0]?.id}/restore`)
        .set('Authorization', `Bearer ${token}`)
        .send({ confirmacion: 'RESTAURAR', motivo: 'primera' });
      expect(first.status).toBe(202);
      const second = await request(app)
        .post(`/api/v1/admin/backups/${all[1]?.id}/restore`)
        .set('Authorization', `Bearer ${token}`)
        .send({ confirmacion: 'RESTAURAR', motivo: 'segunda' });
      expect(second.status).toBe(409);
    });
  });
});
