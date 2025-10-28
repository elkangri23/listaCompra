/**
 * Tests básicos de autenticación para diagnosticar problemas
 */

import request from 'supertest';
import { Application } from 'express';
import { Container } from '../../../src/composition/container';
import { createServer } from '../../../src/infrastructure/http/server';

describe('Auth Diagnostics', () => {
  let app: Application;
  let container: Container;

  beforeAll(async () => {
    container = Container.getInstance();
    await container.connect();
    
    app = await createServer({
      authController: container.authController,
      invitationController: container.invitationController,
      authMiddleware: container.authMiddleware
    });
  });

  afterAll(async () => {
    try {
      await container.disconnect();
    } catch (error) {
      console.warn('Error al cerrar conexión:', error);
    }
  });

  describe('User Registration', () => {
    it('should register a new user successfully', async () => {
      const uniqueEmail = `test-${Date.now()}@diagnostic.com`;
      
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: uniqueEmail,
          password: 'Password123!',
          nombre: 'Test Diagnostic User'
        });

      console.log('Register response:', JSON.stringify(response.body, null, 2));
      
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe(uniqueEmail);
    });

    it('should fail with duplicate email', async () => {
      const duplicateEmail = 'duplicate@test.com';
      
      // Primer registro
      await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: duplicateEmail,
          password: 'Password123!',
          nombre: 'First User'
        });

      // Segundo registro con mismo email
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: duplicateEmail,
          password: 'Password123!',
          nombre: 'Second User'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('User Login', () => {
    const testUser = {
      email: `login-test-${Date.now()}@diagnostic.com`,
      password: 'Password123!',
      nombre: 'Login Test User'
    };

    beforeAll(async () => {
      // Registrar usuario para login
      const registerResponse = await request(app)
        .post('/api/v1/auth/register')
        .send(testUser);
      
      console.log('Setup register status:', registerResponse.status);
      if (registerResponse.status !== 201) {
        console.log('Setup register error:', registerResponse.body);
      }
    });

    it('should login with correct credentials', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password
        });

      console.log('Login response status:', response.status);
      console.log('Login response body:', JSON.stringify(response.body, null, 2));

      // Si falla, no arrojar error inmediatamente para ver más información
      if (response.status !== 200) {
        console.log('LOGIN FAILED - Expected 200, got:', response.status);
        console.log('Error details:', response.body);
      }

      expect(response.status).toBe(200);
      if (response.status === 200) {
        expect(response.body.success).toBe(true);
        expect(response.body.data.user.email).toBe(testUser.email);
        expect(response.body.data.tokens).toBeDefined();
        expect(response.body.data.tokens.accessToken).toBeDefined();
      }
    });

    it('should fail with wrong password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUser.email,
          password: 'WrongPassword123!'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should fail with non-existent email', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@test.com',
          password: 'Password123!'
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Protected Endpoint Test', () => {
    let authToken: string;
    const protectedTestUser = {
      email: `protected-test-${Date.now()}@diagnostic.com`,
      password: 'Password123!',
      nombre: 'Protected Test User'
    };

    beforeAll(async () => {
      // Registrar y hacer login
      await request(app)
        .post('/api/v1/auth/register')
        .send(protectedTestUser);

      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: protectedTestUser.email,
          password: protectedTestUser.password
        });

      authToken = loginResponse.body.data.tokens.accessToken;
      console.log('Auth token obtained:', authToken ? 'YES' : 'NO');
    });

    it('should access protected endpoint with valid token', async () => {
      // Usar cualquier endpoint protegido para test
      const response = await request(app)
        .get('/api/v1/invitations/123e4567-e89b-12d3-a456-426614174000/list')
        .set('Authorization', `Bearer ${authToken}`);

      console.log('Protected endpoint status:', response.status);
      console.log('Protected endpoint response:', JSON.stringify(response.body, null, 2));

      // No debería ser 401 (unauthorized)
      expect(response.status).not.toBe(401);
    });

    it('should reject access without token', async () => {
      const response = await request(app)
        .get('/api/v1/invitations/123e4567-e89b-12d3-a456-426614174000/list');

      expect(response.status).toBe(401);
    });
  });
});