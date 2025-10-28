/**
 * Rutas de autenticación
 * Define los endpoints HTTP para autenticación de usuarios
 */

import { Router } from 'express';
import type { AuthController } from '@infrastructure/http/controllers/AuthController';
import { authRateLimit, apiRateLimit } from '../middlewares/rateLimitMiddleware';

export function createAuthRoutes(authController: AuthController): Router {
  const router = Router();

  /**
   * POST /auth/register
   * Registra un nuevo usuario con rate limiting estricto
   */
  router.post('/register', authRateLimit, authController.register);

  /**
   * POST /auth/login
   * Autentica un usuario existente con rate limiting estricto
   */
  router.post('/login', authRateLimit, authController.login);

  /**
   * POST /auth/refresh
   * Renueva un token de acceso con rate limiting moderado
   */
  router.post('/refresh', apiRateLimit, authController.refresh);

  /**
   * POST /auth/logout
   * Invalida los tokens del usuario
   */
  router.post('/logout', authController.logout);

  /**
   * GET /auth/me
   * Obtiene información del usuario autenticado
   * Requiere autenticación
   */
  router.get('/me', authController.me);

  return router;
}