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
      aiController: container.aiController,
      authMiddleware: container.authMiddleware,
      listController: container.listController,
      productController: container.productController,
      categoryController: container.categoryController,
      auditController: container.auditController
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
      expect(response.body.error).toBe('VALIDATION_ERROR');
      expect(response.body.message).toContain('Ya existe un usuario registrado');
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
      expect(response.body.data.tokens).toHaveProperty('accessToken');
      expect(response.body.data.tokens).toHaveProperty('refreshToken');
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data.user.email).toBe(testUser.email);

      authToken = response.body.data.tokens.accessToken;
    });

    it('4. Debe acceder a endpoints protegidos con token válido', async () => {
      const response = await request(app)
        .get('/api/v1/lists')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      const data = response.body.data;
      if (Array.isArray(data)) {
        expect(data.length).toBe(0);
      } else {
        expect(Array.isArray(data.items)).toBe(true);
        expect(data.items.length).toBe(0);
        expect(data.total).toBeDefined();
      }
    });

    it('5. Debe rechazar acceso sin token de autenticación', async () => {
      const response = await request(app)
        .get('/api/v1/lists')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Token de autorización requerido');
    });

    it('6. Debe rechazar acceso con token inválido', async () => {
      const response = await request(app)
        .get('/api/v1/lists')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('UNAUTHORIZED');
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
      expect(response.body.error).toBe('VALIDATION_ERROR');
      expect(response.body.message.toLowerCase()).toContain('email');
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
      expect(response.body.error).toBe('VALIDATION_ERROR');
      expect(response.body.message.toLowerCase()).toContain('contraseña');
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
      expect(response.body.error).toBe('VALIDATION_ERROR');
      expect(response.body.message.toLowerCase()).toContain('nombre');
    });
  });

  describe('Casos límite de autenticación', () => {
    it('Debe manejar login con email inexistente', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'inexistente@example.com',
          password: 'FakePass123!'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('UNAUTHORIZED');
      expect(response.body.message).toContain('Credenciales inválidas');
    });

    it('Debe manejar login con contraseña incorrecta', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: 'WrongPass123!'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('UNAUTHORIZED');
      expect(response.body.message).toContain('Credenciales inválidas');
    });
  });
});
