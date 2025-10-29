/**
 * @fileoverview Tests E2E para el flujo completo de registro de usuario
 * Incluye registro, verificación de email, login y acceso a funcionalidades
 */

import request from 'supertest';
import type { Application } from 'express';
import { createServer } from '../../../src/infrastructure/http/server';
import { Container } from '../../../src/composition/container';

describe('E2E: User Registration Flow', () => {
  let app: Application;
  const testUser = {
    email: `test-${Date.now()}@example.com`,
    password: 'TestPassword123!',
    nombre: 'Usuario',
    apellidos: 'Test'
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
  });

  afterAll(async () => {
    // Cleanup de datos de test
  });

  describe('Flujo completo de registro de usuario', () => {
    let authToken: string;

    it('1. Debe registrar un nuevo usuario exitosamente', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(testUser)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Usuario registrado exitosamente');
      expect(response.body.data.user).toHaveProperty('id');
      expect(response.body.data.user.email).toBe(testUser.email);
      expect(response.body.data.user.nombre).toBe(testUser.nombre);
      expect(response.body.data.user.emailVerificado).toBe(false); // Inicialmente no verificado
    });

    it('2. Debe fallar al registrar el mismo email dos veces', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(testUser)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('ya está registrado');
    });

    it('3. Debe hacer login exitosamente con credenciales correctas', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data.user.email).toBe(testUser.email);

      authToken = response.body.data.token;
    });

    it('4. Debe acceder a endpoints protegidos con token válido', async () => {
      const response = await request(app)
        .get('/api/v1/lists')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      // Usuario recién registrado no debería tener listas
      expect(response.body.data.length).toBe(0);
    });

    it('5. Debe rechazar acceso sin token de autenticación', async () => {
      const response = await request(app)
        .get('/api/v1/lists')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('token');
    });

    it('6. Debe rechazar acceso con token inválido', async () => {
      const response = await request(app)
        .get('/api/v1/lists')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Validaciones de datos de entrada', () => {
    it('Debe rechazar registro con email inválido', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          ...testUser,
          email: 'email-invalido'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('email');
    });

    it('Debe rechazar registro con contraseña débil', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          ...testUser,
          email: `weak-${Date.now()}@example.com`,
          password: '123'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('contraseña');
    });

    it('Debe rechazar registro con nombre muy corto', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          ...testUser,
          email: `short-${Date.now()}@example.com`,
          nombre: 'A'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('nombre');
    });
  });

  describe('Casos límite de autenticación', () => {
    it('Debe manejar login con email inexistente', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'inexistente@example.com',
          password: 'cualquier-password'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('credenciales');
    });

    it('Debe manejar login con contraseña incorrecta', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: 'password-incorrecto'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('credenciales');
    });
  });
});