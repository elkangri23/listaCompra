/**
 * Rutas de autenticación
 * Define los endpoints HTTP para autenticación de usuarios
 */

import { Router } from 'express';
import type { AuthController } from '@infrastructure/http/controllers/AuthController';

export function createAuthRoutes(authController: AuthController): Router {
  const router = Router();

  /**
   * POST /auth/register
   * Registra un nuevo usuario
   */
  router.post('/register', authController.register);

  /**
   * POST /auth/login
   * Autentica un usuario existente
   */
  router.post('/login', authController.login);

  /**
   * POST /auth/refresh
   * Renueva un token de acceso
   */
  router.post('/refresh', authController.refresh);

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