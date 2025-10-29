/**
 * @fileoverview Tests E2E para flujo completo de gestión de listas de compra
 * Incluye crear, actualizar, compartir listas y gestión de productos
 */

import request from 'supertest';
import type { Application } from 'express';
import { createServer } from '../../../src/infrastructure/http/server';
import { Container } from '../../../src/composition/container';

describe('E2E: Shopping List Management Flow', () => {
  let app: Application;
  let authToken: string;
  let userId: string;
  let secondUserToken: string;
  let secondUserId: string;

  const testUser = {
    email: `listowner-${Date.now()}@example.com`,
    password: 'TestPassword123!',
    nombre: 'Propietario',
    apellidos: 'Lista'
  };

  const secondUser = {
    email: `collaborator-${Date.now()}@example.com`,
    password: 'TestPassword123!',
    nombre: 'Colaborador',
    apellidos: 'Lista'
  };

  beforeAll(async () => {
    // Crear servidor con dependencias reales
    const container = Container.getInstance();
    const dependencies = {
      authController: container.authController,
      invitationController: container.invitationController,
      adminController: container.adminController,
      authMiddleware: container.authMiddleware
    };
    app = await createServer(dependencies);

    // Registrar usuarios de prueba
    await request(app)
      .post('/api/v1/auth/register')
      .send(testUser);

    await request(app)
      .post('/api/v1/auth/register')
      .send(secondUser);

    // Autenticar usuarios
    const authResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: testUser.email,
        password: testUser.password
      });
    authToken = authResponse.body.data.token;
    userId = authResponse.body.data.user.id;

    const secondAuthResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: secondUser.email,
        password: secondUser.password
      });
    secondUserToken = secondAuthResponse.body.data.token;
    secondUserId = secondAuthResponse.body.data.user.id;
  });

  describe('Gestión básica de listas', () => {
    let listaId: string;

    it('1. Debe crear una nueva lista de compra', async () => {
      const response = await request(app)
        .post('/api/v1/lists')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          nombre: 'Lista de Supermercado',
          descripcion: 'Compras semanales para casa'
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.nombre).toBe('Lista de Supermercado');
      expect(response.body.data.descripcion).toBe('Compras semanales para casa');
      expect(response.body.data.propietarioId).toBe(userId);
      expect(response.body.data.activa).toBe(true);

      listaId = response.body.data.id;
    });

    it('2. Debe obtener todas las listas del usuario', async () => {
      const response = await request(app)
        .get('/api/v1/lists')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data[0].nombre).toBe('Lista de Supermercado');
    });

    it('3. Debe obtener una lista específica por ID', async () => {
      const response = await request(app)
        .get(`/api/v1/lists/${listaId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(listaId);
      expect(response.body.data.nombre).toBe('Lista de Supermercado');
    });

    it('4. Debe actualizar una lista existente', async () => {
      const response = await request(app)
        .put(`/api/v1/lists/${listaId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          nombre: 'Lista de Supermercado Actualizada',
          descripcion: 'Compras semanales para casa - versión 2'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.nombre).toBe('Lista de Supermercado Actualizada');
      expect(response.body.data.descripcion).toBe('Compras semanales para casa - versión 2');
    });

    it('5. Debe rechazar actualización por usuario no propietario', async () => {
      const response = await request(app)
        .put(`/api/v1/lists/${listaId}`)
        .set('Authorization', `Bearer ${secondUserToken}`)
        .send({
          nombre: 'Intento de hackeo'
        })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('permiso');
    });
  });

  describe('Gestión de productos en lista', () => {
    let listaId: string;
    let productoId: string;

    beforeAll(async () => {
      // Crear lista para pruebas de productos
      const listaResponse = await request(app)
        .post('/api/v1/lists')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          nombre: 'Lista para Productos',
          descripcion: 'Lista específica para pruebas de productos'
        });
      listaId = listaResponse.body.data.id;
    });

    it('1. Debe añadir productos a la lista', async () => {
      const response = await request(app)
        .post(`/api/v1/lists/${listaId}/products`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          nombre: 'Leche Entera',
          cantidad: 2,
          precio: 1.50,
          descripcion: 'Leche entera de 1 litro',
          urgente: false
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.nombre).toBe('Leche Entera');
      expect(response.body.data.cantidad).toBe(2);
      expect(response.body.data.precio).toBe(1.50);
      expect(response.body.data.comprado).toBe(false);
      expect(response.body.data.urgente).toBe(false);

      productoId = response.body.data.id;
    });

    it('2. Debe obtener productos de la lista', async () => {
      const response = await request(app)
        .get(`/api/v1/lists/${listaId}/products`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].nombre).toBe('Leche Entera');
    });

    it('3. Debe marcar producto como comprado', async () => {
      const response = await request(app)
        .put(`/api/v1/products/${productoId}/purchased`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          comprado: true,
          precioFinal: 1.45
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.comprado).toBe(true);
      expect(response.body.data.precio).toBe(1.45);
    });

    it('4. Debe marcar producto como urgente', async () => {
      const response = await request(app)
        .put(`/api/v1/products/${productoId}/urgent`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          urgente: true
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.urgente).toBe(true);
    });

    it('5. Debe eliminar producto de la lista', async () => {
      const response = await request(app)
        .delete(`/api/v1/products/${productoId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verificar que el producto ya no existe
      const listResponse = await request(app)
        .get(`/api/v1/lists/${listaId}/products`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(listResponse.body.data.length).toBe(0);
    });
  });

  describe('Colaboración y compartición de listas', () => {
    let listaId: string;
    let invitationHash: string;

    beforeAll(async () => {
      // Crear lista para compartir
      const listaResponse = await request(app)
        .post('/api/v1/lists')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          nombre: 'Lista Compartida',
          descripcion: 'Lista para colaboración'
        });
      listaId = listaResponse.body.data.id;
    });

    it('1. Debe compartir lista con permisos de escritura', async () => {
      const response = await request(app)
        .post(`/api/v1/invitations/${listaId}/share`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          tipoPermiso: 'ESCRITURA',
          duracionHoras: 48
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('hash');
      expect(response.body.data).toHaveProperty('invitacionId');
      expect(response.body.data.tipoPermiso).toBe('ESCRITURA');

      invitationHash = response.body.data.hash;
    });

    it('2. Segundo usuario debe acceder a lista compartida', async () => {
      const response = await request(app)
        .get(`/api/v1/invitations/${invitationHash}/access`)
        .set('Authorization', `Bearer ${secondUserToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.lista.nombre).toBe('Lista Compartida');
      expect(response.body.data.permiso.tipoPermiso).toBe('ESCRITURA');
    });

    it('3. Segundo usuario debe poder añadir productos con permisos de escritura', async () => {
      const response = await request(app)
        .post(`/api/v1/lists/${listaId}/products`)
        .set('Authorization', `Bearer ${secondUserToken}`)
        .send({
          nombre: 'Pan Integral',
          cantidad: 1,
          precio: 2.50
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.nombre).toBe('Pan Integral');
      expect(response.body.data.creadoPorId).toBe(secondUserId);
    });

    it('4. Debe obtener permisos de la lista', async () => {
      const response = await request(app)
        .get(`/api/v1/invitations/${listaId}/permissions`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
      
      const colaboradorPermiso = response.body.data.find(
        (p: any) => p.usuarioId === secondUserId
      );
      expect(colaboradorPermiso).toBeDefined();
      expect(colaboradorPermiso.tipoPermiso).toBe('ESCRITURA');
    });

    it('5. Debe actualizar permisos de colaborador', async () => {
      const response = await request(app)
        .put(`/api/v1/invitations/${listaId}/permissions/${secondUserId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          tipoPermiso: 'LECTURA'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.tipoPermiso).toBe('LECTURA');
    });

    it('6. Segundo usuario NO debe poder añadir productos con permisos de solo lectura', async () => {
      const response = await request(app)
        .post(`/api/v1/lists/${listaId}/products`)
        .set('Authorization', `Bearer ${secondUserToken}`)
        .send({
          nombre: 'Producto No Permitido',
          cantidad: 1,
          precio: 1.00
        })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('permiso');
    });

    it('7. Debe eliminar permisos de colaborador', async () => {
      const response = await request(app)
        .delete(`/api/v1/invitations/${listaId}/permissions/${secondUserId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verificar que segundo usuario ya no puede acceder
      const accessResponse = await request(app)
        .get(`/api/v1/lists/${listaId}`)
        .set('Authorization', `Bearer ${secondUserToken}`)
        .expect(403);

      expect(accessResponse.body.success).toBe(false);
    });
  });

  describe('Casos límite y validaciones', () => {
    it('Debe rechazar creación de lista con nombre vacío', async () => {
      const response = await request(app)
        .post('/api/v1/lists')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          nombre: '',
          descripcion: 'Lista sin nombre'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('nombre');
    });

    it('Debe rechazar acceso a lista inexistente', async () => {
      const response = await request(app)
        .get('/api/v1/lists/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('encontrada');
    });

    it('Debe rechazar producto con cantidad inválida', async () => {
      // Crear lista temporal
      const listaResponse = await request(app)
        .post('/api/v1/lists')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          nombre: 'Lista Temporal',
          descripcion: 'Para prueba de validación'
        });

      const response = await request(app)
        .post(`/api/v1/lists/${listaResponse.body.data.id}/products`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          nombre: 'Producto Inválido',
          cantidad: -1,
          precio: 1.00
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('cantidad');
    });
  });
});