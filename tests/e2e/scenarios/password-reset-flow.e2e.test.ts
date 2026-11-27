/**
 * @fileoverview Tests E2E para el restablecimiento de contraseña por código (item 9c)
 * Registro → solicitar código → código incorrecto → código correcto →
 * login con la contraseña nueva (y no con la vieja).
 * En CI no hay RESEND_API_KEY, así que el envío falla pero la fila del
 * código sí se crea (como en el flujo de verificación, test 3b).
 */

import request from 'supertest';
import type { Application } from 'express';
import { createServer } from '../../../src/infrastructure/http/server';
import { Container } from '../../../src/composition/container';
import { Email } from '../../../src/domain/value-objects/Email';
import { hmacResetCode } from '../../../src/infrastructure/security/password-reset-crypto';
import { InMemoryPasswordResetCodeRepository } from '../../../src/infrastructure/persistence/in-memory/InMemoryPasswordResetCodeRepository';

describe('E2E: Password Reset Flow (item 9c)', () => {
  let app: Application;
  let container: Container;
  const testUser = {
    email: `reset-${Date.now()}@example.com`,
    password: 'TestPass123!',
    nombre: 'Usuario',
    apellidos: 'Reset',
    aceptoTerminos: true,
  };

  beforeAll(async () => {
    container = Container.getInstance();
    const dependencies = {
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
      cachedAIService: container.cachedAIService,
    };
    app = await createServer(dependencies);
  });

  afterAll(async () => {
    // Cleanup de datos de test
  });

  describe('Flujo de restablecimiento de contraseña', () => {
    it('1. Debe registrar un usuario nuevo', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send(testUser)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe(testUser.email);
    });

    it('2. Debe aceptar la solicitud del código (sin revelar si existe)', async () => {
      const response = await request(app)
        .post('/api/v1/auth/forgot-password')
        .send({ email: testUser.email })
        .expect(200);

      expect(response.body.success).toBe(true);
      // En CI no hay clave de Resend: el envío falla pero la fila se crea
      expect(response.body.data).toHaveProperty('emailSent');
    });

    it('3. Debe rechazar un código incorrecto', async () => {
      const response = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({ email: testUser.email, codigo: '111111', nuevaPassword: 'NuevaPass123!' })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Te quedan 4 intentos');
    });

    it('4. Debe restablecer la contraseña con el código correcto', async () => {
      // Costura de test: fijar un código conocido en la fila pendiente
      const emailResult = Email.create(testUser.email);
      if (!emailResult.isSuccess) throw new Error('Failed to create email');
      const userResult = await container.usuarioRepository.findByEmail(emailResult.value);
      if (!userResult.isSuccess || !userResult.value) throw new Error('User not found');
      const repo = container.passwordResetCodeRepository as InMemoryPasswordResetCodeRepository;
      const pendingResult = await repo.findLatestPendingByUsuarioId(userResult.value.id);
      if (!pendingResult.isSuccess || !pendingResult.value) throw new Error('No pending code');
      repo.setCodeHashForTest(pendingResult.value.id, hmacResetCode('482913'));

      const response = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({ email: testUser.email, codigo: '482913', nuevaPassword: 'NuevaPass123!' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.mensaje).toContain('contraseña ha sido cambiada');
    });

    it('5. El código ya usado no debe valer otra vez', async () => {
      const response = await request(app)
        .post('/api/v1/auth/reset-password')
        .send({ email: testUser.email, codigo: '482913', nuevaPassword: 'OtraPass123!' })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('El código no es válido o ha caducado.');
    });

    it('6. El login con la contraseña vieja debe fallar', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: testUser.email, password: testUser.password })
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('7. El login con la contraseña nueva debe llegar (cuenta sin verificar)', async () => {
      // La contraseña es correcta, pero la cuenta sigue sin verificar:
      // el login devuelve 200 con emailNotVerified (item 3), no 401.
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: testUser.email, password: 'NuevaPass123!' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.emailNotVerified).toBe(true);
      expect(response.body.data.tokens).toBeUndefined();
    });
  });
});
