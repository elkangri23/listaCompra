/**
 * Tests de integración de los endpoints de gestión de usuarios del panel
 * de administración (fase 2): GET /admin/users y PATCH /admin/users/:id/status.
 *
 * Monta las rutas reales (createAdminRoutes) con el AdminController real y
 * los repositorios en memoria; el authMiddleware y requireAdmin son reales.
 */
import express from 'express';
import request from 'supertest';
import { createAdminRoutes } from '@infrastructure/http/routes/adminRoutes';
import { AdminController } from '@infrastructure/http/controllers/AdminController';
import { ImpersonateUser } from '@application/use-cases/admin/ImpersonateUser';
import { EndImpersonation } from '@application/use-cases/admin/EndImpersonation';
import { GetAdminUsers } from '@application/use-cases/admin/GetAdminUsers';
import { UpdateUserStatus } from '@application/use-cases/admin/UpdateUserStatus';
import { createAuthMiddleware } from '@infrastructure/http/middlewares/authMiddleware';
import { requireAdmin } from '@infrastructure/http/middlewares/roleMiddleware';
import { JWTTokenService } from '@infrastructure/external-services/auth/JWTTokenService';
import { InMemoryUsuarioRepository } from '@infrastructure/persistence/in-memory/InMemoryUsuarioRepository';
import { InMemoryListaRepository } from '@infrastructure/persistence/in-memory/InMemoryListaRepository';
import { InMemoryProductoRepository } from '@infrastructure/persistence/in-memory/InMemoryProductoRepository';
import { Usuario, RolUsuario } from '@domain/entities/Usuario';
import { Lista } from '@domain/entities/Lista';
import { Producto } from '@domain/entities/Producto';
import { Email } from '@domain/value-objects/Email';

const ADMIN_ID = '11111111-1111-4111-8111-111111111111';
const LUIS_ID = '22222222-2222-4222-8222-222222222222';
const MARIA_ID = '33333333-3333-4333-8333-333333333333';

const makeUser = (props: {
  id: string;
  nombre: string;
  apellidos: string;
  email: string;
  rol?: RolUsuario;
  activo?: boolean;
}): Usuario => {
  const result = Usuario.create({
    id: props.id,
    email: Email.createUnsafe(props.email),
    password: 'hash-de-prueba-largo',
    nombre: props.nombre,
    apellidos: props.apellidos,
    rol: props.rol ?? RolUsuario.USUARIO,
    activo: props.activo ?? true,
    emailVerificado: true
  });
  if (result.isFailure) {
    throw result.error;
  }
  return result.value;
};

const makeLista = (props: { id: string; nombre: string; propietarioId: string }): Lista => {
  const result = Lista.create(props);
  if (result.isFailure) {
    throw result.error;
  }
  return result.value;
};

const makeProducto = (props: { id: string; nombre: string; listaId: string; creadoPorId: string }): Producto => {
  const result = Producto.create(props);
  if (result.isFailure) {
    throw result.error;
  }
  return result.value;
};

const buildApp = async () => {
  const usuarioRepository = new InMemoryUsuarioRepository();
  const listaRepository = new InMemoryListaRepository();
  const productoRepository = new InMemoryProductoRepository();

  await usuarioRepository.save(makeUser({
    id: ADMIN_ID, nombre: 'Admin', apellidos: 'Root',
    email: 'admin@ejemplo.com', rol: RolUsuario.ADMIN
  }));
  await usuarioRepository.save(makeUser({
    id: LUIS_ID, nombre: 'Luis', apellidos: 'Perez',
    email: 'luis@ejemplo.com'
  }));
  await usuarioRepository.save(makeUser({
    id: MARIA_ID, nombre: 'Maria', apellidos: 'Lopez',
    email: 'maria@ejemplo.com', activo: false
  }));

  await listaRepository.save(makeLista({
    id: 'lista-1', nombre: 'Compra semanal', propietarioId: LUIS_ID
  }));
  await productoRepository.save(makeProducto({
    id: 'prod-1', nombre: 'Leche', listaId: 'lista-1', creadoPorId: LUIS_ID
  }));
  await productoRepository.save(makeProducto({
    id: 'prod-2', nombre: 'Pan', listaId: 'lista-1', creadoPorId: LUIS_ID
  }));
  await productoRepository.save(makeProducto({
    id: 'prod-3', nombre: 'Huevos', listaId: 'lista-1', creadoPorId: MARIA_ID
  }));

  const tokenService = new JWTTokenService();
  const controller = new AdminController(
    new ImpersonateUser(usuarioRepository, tokenService),
    new EndImpersonation(usuarioRepository, tokenService),
    undefined,
    new GetAdminUsers(usuarioRepository, listaRepository, productoRepository),
    new UpdateUserStatus(usuarioRepository)
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

describe('Endpoints de gestión de usuarios del panel admin', () => {
  describe('GET /api/v1/admin/users', () => {
    it('sin token → 401', async () => {
      const app = await buildApp();
      const response = await request(app).get('/api/v1/admin/users');

      expect(response.status).toBe(401);
    });

    it('con USUARIO → 403 ADMIN_ROLE_REQUIRED', async () => {
      const app = await buildApp();
      const token = await mintToken(LUIS_ID, 'luis@ejemplo.com', RolUsuario.USUARIO);
      const response = await request(app)
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(403);
      expect(response.body.code).toBe('ADMIN_ROLE_REQUIRED');
    });

    it('con ADMIN lista los usuarios con conteos reales y sin ultimaConexion', async () => {
      const app = await buildApp();
      const token = await mintToken(ADMIN_ID, 'admin@ejemplo.com', RolUsuario.ADMIN);
      const response = await request(app)
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.total).toBe(3);
      expect(response.body.data.page).toBe(1);
      expect(response.body.data.limit).toBe(20);
      expect(response.body.data.totalPages).toBe(1);
      expect(response.body.data.usuarios).toHaveLength(3);

      const luis = response.body.data.usuarios.find((u: any) => u.id === LUIS_ID);
      expect(luis).toMatchObject({
        nombre: 'Luis Perez',
        email: 'luis@ejemplo.com',
        rol: 'USUARIO',
        activo: true,
        emailVerificado: true,
        listasCreadas: 1,
        productosAgregados: 2
      });
      expect(luis).not.toHaveProperty('ultimaConexion');

      const maria = response.body.data.usuarios.find((u: any) => u.id === MARIA_ID);
      expect(maria).toMatchObject({ activo: false, listasCreadas: 0, productosAgregados: 1 });
    });

    it('con q busca por nombre o correo', async () => {
      const app = await buildApp();
      const token = await mintToken(ADMIN_ID, 'admin@ejemplo.com', RolUsuario.ADMIN);

      const byName = await request(app)
        .get('/api/v1/admin/users?q=luis')
        .set('Authorization', `Bearer ${token}`);
      expect(byName.status).toBe(200);
      expect(byName.body.data.total).toBe(1);
      expect(byName.body.data.usuarios[0].id).toBe(LUIS_ID);

      const byEmail = await request(app)
        .get('/api/v1/admin/users?q=maria@ejemplo.com')
        .set('Authorization', `Bearer ${token}`);
      expect(byEmail.status).toBe(200);
      expect(byEmail.body.data.total).toBe(1);
      expect(byEmail.body.data.usuarios[0].id).toBe(MARIA_ID);
    });

    it('pagina con page y limit', async () => {
      const app = await buildApp();
      const token = await mintToken(ADMIN_ID, 'admin@ejemplo.com', RolUsuario.ADMIN);
      const response = await request(app)
        .get('/api/v1/admin/users?page=2&limit=2')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.total).toBe(3);
      expect(response.body.data.page).toBe(2);
      expect(response.body.data.limit).toBe(2);
      expect(response.body.data.totalPages).toBe(2);
      expect(response.body.data.usuarios).toHaveLength(1);
      expect(response.body.data.usuarios[0].id).toBe(MARIA_ID);
    });
  });

  describe('PATCH /api/v1/admin/users/:id/status', () => {
    it('con USUARIO → 403 ADMIN_ROLE_REQUIRED', async () => {
      const app = await buildApp();
      const token = await mintToken(LUIS_ID, 'luis@ejemplo.com', RolUsuario.USUARIO);
      const response = await request(app)
        .patch(`/api/v1/admin/users/${MARIA_ID}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ activo: true });

      expect(response.status).toBe(403);
      expect(response.body.code).toBe('ADMIN_ROLE_REQUIRED');
    });

    it('desactiva y vuelve a activar un usuario', async () => {
      const app = await buildApp();
      const token = await mintToken(ADMIN_ID, 'admin@ejemplo.com', RolUsuario.ADMIN);

      const off = await request(app)
        .patch(`/api/v1/admin/users/${LUIS_ID}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ activo: false });
      expect(off.status).toBe(200);
      expect(off.body.success).toBe(true);
      expect(off.body.data.usuario.activo).toBe(false);

      const on = await request(app)
        .patch(`/api/v1/admin/users/${LUIS_ID}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ activo: true });
      expect(on.status).toBe(200);
      expect(on.body.data.usuario.activo).toBe(true);
    });

    it('desactivar un usuario ya inactivo → 400', async () => {
      const app = await buildApp();
      const token = await mintToken(ADMIN_ID, 'admin@ejemplo.com', RolUsuario.ADMIN);
      const response = await request(app)
        .patch(`/api/v1/admin/users/${MARIA_ID}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ activo: false });

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/ya está inactivo/);
    });

    it('un admin no puede desactivarse a sí mismo → 400', async () => {
      const app = await buildApp();
      const token = await mintToken(ADMIN_ID, 'admin@ejemplo.com', RolUsuario.ADMIN);
      const response = await request(app)
        .patch(`/api/v1/admin/users/${ADMIN_ID}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ activo: false });

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/propia cuenta/);
    });

    it('usuario inexistente → 404', async () => {
      const app = await buildApp();
      const token = await mintToken(ADMIN_ID, 'admin@ejemplo.com', RolUsuario.ADMIN);
      const response = await request(app)
        .patch('/api/v1/admin/users/usuario-inexistente/status')
        .set('Authorization', `Bearer ${token}`)
        .send({ activo: false });

      expect(response.status).toBe(404);
    });

    it('body inválido → 400 VALIDATION_ERROR', async () => {
      const app = await buildApp();
      const token = await mintToken(ADMIN_ID, 'admin@ejemplo.com', RolUsuario.ADMIN);

      const wrongType = await request(app)
        .patch(`/api/v1/admin/users/${LUIS_ID}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ activo: 'si' });
      expect(wrongType.status).toBe(400);
      expect(wrongType.body.code).toBe('VALIDATION_ERROR');

      const missing = await request(app)
        .patch(`/api/v1/admin/users/${LUIS_ID}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({});
      expect(missing.status).toBe(400);
      expect(missing.body.code).toBe('VALIDATION_ERROR');
    });
  });
});
