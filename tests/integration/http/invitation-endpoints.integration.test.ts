/**
 * Tests de integración para endpoints de invitaciones
 * Prueba todos los endpoints de compartición de listas
 */

import request from 'supertest';
import { Application } from 'express';
import { Container } from '../../../src/composition/container';
import { createServer } from '../../../src/infrastructure/http/server';

describe('Invitation Endpoints Integration', () => {
  let app: Application;
  let container: Container;
  let authToken: string;
  let userCredentials = {
    email: 'test-invitations@test.com',
    password: 'Password123!'
  };
  let listaId: string;
  let userId: string;

  beforeAll(async () => {
    container = Container.getInstance();
    await container.connect();
    
    app = await createServer({
      authController: container.authController,
      invitationController: container.invitationController,
      authMiddleware: container.authMiddleware
    });

    // Registrar usuario de prueba (si no existe) o usar existente
    const registerResponse = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: userCredentials.email,
        password: userCredentials.password,
        nombre: 'Test User Invitations'
      });

    console.log('Register status:', registerResponse.status);
    
    // Si registro exitoso o usuario ya existe, intentar login
    if (registerResponse.status !== 201 && registerResponse.status !== 400) {
      throw new Error(`Registration failed: ${JSON.stringify(registerResponse.body)}`);
    }

    // Intentar login inmediatamente después del registro
    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: userCredentials.email,
        password: userCredentials.password
      });

    console.log('Login status:', loginResponse.status);
    console.log('Login response:', JSON.stringify(loginResponse.body, null, 2));

    if (loginResponse.status !== 200 || !loginResponse.body.data) {
      throw new Error(`Login failed: ${JSON.stringify(loginResponse.body)}`);
    }

    authToken = loginResponse.body.data.tokens.accessToken;
    userId = loginResponse.body.data.user.id;

    // Crear una lista de prueba
    const createListResult = await container.createList.execute(
      {
        nombre: 'Lista de Prueba para Invitaciones',
        descripcion: 'Lista para probar compartición'
      },
      userId // propietarioId como segundo parámetro
    );

    if (createListResult.isSuccess) {
      listaId = createListResult.value.id;
    } else {
      throw new Error('No se pudo crear lista de prueba');
    }
  });

  afterAll(async () => {
    // Limpiar datos de prueba si es necesario
    try {
      await container.disconnect();
    } catch (error) {
      console.warn('Error al cerrar conexión:', error);
    }
  });

  describe('POST /api/v1/invitations/:listaId/share', () => {
    it('should create an invitation to share a list', async () => {
      const response = await request(app)
        .post(`/api/v1/invitations/${listaId}/share`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          tipoPermiso: 'LECTURA',
          duracionHoras: 24
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('hash');
      expect(response.body.data).toHaveProperty('invitacionId');
      expect(response.body.data.tipoPermiso).toBe('LECTURA');
    });

    it('should fail without authentication', async () => {
      const response = await request(app)
        .post(`/api/v1/invitations/${listaId}/share`)
        .send({
          tipoPermiso: 'LECTURA'
        });

      expect(response.status).toBe(401);
    });

    it('should fail with invalid permission type', async () => {
      const response = await request(app)
        .post(`/api/v1/invitations/${listaId}/share`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          tipoPermiso: 'INVALID'
        });

      expect(response.status).toBe(400);
    });

    it('should fail with invalid listaId format', async () => {
      const response = await request(app)
        .post('/api/v1/invitations/invalid-uuid/share')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          tipoPermiso: 'LECTURA'
        });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/v1/invitations/:hash/access', () => {
    let invitationHash: string;

    beforeAll(async () => {
      // Crear invitación para las pruebas
      const shareResponse = await request(app)
        .post(`/api/v1/invitations/${listaId}/share`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          tipoPermiso: 'ESCRITURA',
          duracionHoras: 48
        });

      invitationHash = shareResponse.body.data.hash;
    });

    it('should access a shared list with valid hash', async () => {
      // Registrar segundo usuario para probar acceso
      const secondUserCredentials = {
        email: 'second-user@test.com',
        password: 'Password123!'
      };

      await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: secondUserCredentials.email,
          password: secondUserCredentials.password,
          nombre: 'Second Test User'
        });

      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send(secondUserCredentials);

      const secondUserToken = loginResponse.body.data.tokens.accessToken;

      const response = await request(app)
        .get(`/api/v1/invitations/${invitationHash}/access`)
        .set('Authorization', `Bearer ${secondUserToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('lista');
      expect(response.body.data).toHaveProperty('permiso');
      expect(response.body.data.permiso.tipo).toBe('ESCRITURA');
    });

    it('should fail with invalid hash', async () => {
      const response = await request(app)
        .get('/api/v1/invitations/invalid-hash/access')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });

    it('should fail without authentication', async () => {
      const response = await request(app)
        .get(`/api/v1/invitations/${invitationHash}/access`);

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/v1/invitations/:listaId/list', () => {
    it('should get all invitations for a list', async () => {
      const response = await request(app)
        .get(`/api/v1/invitations/${listaId}/list`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('should fail for non-existent list', async () => {
      const fakeListId = '123e4567-e89b-12d3-a456-426614174000';
      const response = await request(app)
        .get(`/api/v1/invitations/${fakeListId}/list`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });

    it('should fail without authentication', async () => {
      const response = await request(app)
        .get(`/api/v1/invitations/${listaId}/list`);

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/v1/invitations/:listaId/permissions', () => {
    it('should get all permissions for a list', async () => {
      const response = await request(app)
        .get(`/api/v1/invitations/${listaId}/permissions`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should fail without authentication', async () => {
      const response = await request(app)
        .get(`/api/v1/invitations/${listaId}/permissions`);

      expect(response.status).toBe(401);
    });
  });

  describe('PUT /api/v1/invitations/:listaId/permissions/:targetUsuarioId', () => {
    let targetUserId: string;

    beforeAll(async () => {
      // Crear otro usuario y darle permisos
      const targetUserCredentials = {
        email: 'target-user@test.com',
        password: 'Password123!'
      };

      const registerResponse = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: targetUserCredentials.email,
          password: targetUserCredentials.password,
          nombre: 'Target User'
        });

      targetUserId = registerResponse.body.data.user.id;

      // Darle permisos de lectura primero usando el caso de uso directamente
      await container.shareList.execute({
        listaId,
        usuarioComparteId: userId,
        tipoPermiso: 'LECTURA'
      });
    });

    it('should update permissions for a user', async () => {
      const response = await request(app)
        .put(`/api/v1/invitations/${listaId}/permissions/${targetUserId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          nuevoTipoPermiso: 'ESCRITURA'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.tipo).toBe('ESCRITURA');
    });

    it('should fail with invalid permission type', async () => {
      const response = await request(app)
        .put(`/api/v1/invitations/${listaId}/permissions/${targetUserId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          nuevoTipoPermiso: 'INVALID'
        });

      expect(response.status).toBe(400);
    });

    it('should fail without authentication', async () => {
      const response = await request(app)
        .put(`/api/v1/invitations/${listaId}/permissions/${targetUserId}`)
        .send({
          nuevoTipoPermiso: 'LECTURA'
        });

      expect(response.status).toBe(401);
    });
  });

  describe('DELETE /api/v1/invitations/:listaId/permissions/:targetUsuarioId', () => {
    let targetUserId: string;

    beforeAll(async () => {
      // Crear usuario para eliminar permisos
      const targetUserCredentials = {
        email: 'delete-user@test.com',
        password: 'Password123!'
      };

      const registerResponse = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: targetUserCredentials.email,
          password: targetUserCredentials.password,
          nombre: 'Delete User'
        });

      targetUserId = registerResponse.body.data.user.id;

      // Darle permisos primero
      await container.shareList.execute({
        listaId,
        usuarioComparteId: userId,
        tipoPermiso: 'LECTURA'
      });
    });

    it('should remove permissions for a user', async () => {
      const response = await request(app)
        .delete(`/api/v1/invitations/${listaId}/permissions/${targetUserId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should fail without authentication', async () => {
      const response = await request(app)
        .delete(`/api/v1/invitations/${listaId}/permissions/${targetUserId}`);

      expect(response.status).toBe(401);
    });
  });

  describe('DELETE /api/v1/invitations/:invitacionId', () => {
    let invitacionId: string;

    beforeAll(async () => {
      // Crear invitación para cancelar
      const shareResponse = await request(app)
        .post(`/api/v1/invitations/${listaId}/share`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          tipoPermiso: 'LECTURA',
          duracionHoras: 24
        });

      invitacionId = shareResponse.body.data.invitacionId;
    });

    it('should cancel an invitation', async () => {
      const response = await request(app)
        .delete(`/api/v1/invitations/${invitacionId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should fail with non-existent invitation', async () => {
      const fakeInvitationId = '123e4567-e89b-12d3-a456-426614174000';
      const response = await request(app)
        .delete(`/api/v1/invitations/${fakeInvitationId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
    });

    it('should fail without authentication', async () => {
      const response = await request(app)
        .delete(`/api/v1/invitations/${invitacionId}`);

      expect(response.status).toBe(401);
    });
  });
});