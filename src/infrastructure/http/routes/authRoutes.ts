/**
 * Rutas de autenticación
 * Define los endpoints HTTP para autenticación de usuarios
 */

import { Router, type RequestHandler } from 'express';
import type { AuthController } from '@infrastructure/http/controllers/AuthController';
import { authRateLimit, apiRateLimit } from '../middlewares/rateLimitMiddleware';

export function createAuthRoutes(authController: AuthController, authMiddleware?: RequestHandler): Router {
  const router = Router();

  /**
   * @swagger
   * /api/v1/auth/register:
   *   post:
   *     tags: [Autenticación]
   *     summary: Registrar nuevo usuario
   *     description: Registra un nuevo usuario en el sistema con validación de datos y rate limiting estricto
   *     operationId: registerUser
   *     security: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - nombre
   *               - email
   *               - password
   *               - aceptoTerminos
   *             properties:
   *               nombre:
   *                 type: string
   *                 minLength: 2
   *                 maxLength: 50
   *                 description: Nombre del usuario
   *                 example: Juan
   *               apellidos:
   *                 type: string
   *                 maxLength: 100
   *                 description: Apellidos del usuario (opcional)
   *                 example: Pérez García
   *               email:
   *                 type: string
   *                 format: email
   *                 description: Email único del usuario
   *                 example: juan@ejemplo.com
   *               password:
   *                 type: string
   *                 minLength: 8
   *                 description: Contraseña segura (mín. 8 caracteres)
   *                 example: miPassword123
   *               aceptoTerminos:
   *                 type: boolean
   *                 description: Aceptación de los Términos de Servicio (obligatoria)
   *                 example: true
   *               turnstileToken:
   *                 type: string
   *                 description: Token del captcha Turnstile (obligatorio solo cuando el servidor lo tiene configurado)
   *           examples:
   *             usuario_basico:
   *               summary: Usuario básico
   *               value:
   *                 nombre: Juan
   *                 email: juan@ejemplo.com
   *                 password: miPassword123
   *                 aceptoTerminos: true
   *             usuario_completo:
   *               summary: Usuario con apellidos
   *               value:
   *                 nombre: María
   *                 apellidos: García López
   *                 email: maria@ejemplo.com
   *                 password: passwordSeguro456
   *                 aceptoTerminos: true
   *     responses:
   *       201:
   *         description: Usuario creado exitosamente
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/LoginResponse'
   *             example:
   *               token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   *               user:
   *                 id: 550e8400-e29b-41d4-a716-446655440000
   *                 nombre: Juan
   *                 apellidos: Pérez García
   *                 email: juan@ejemplo.com
   *                 rol: USUARIO
   *                 activo: true
   *                 emailVerificado: false
   *                 creadoEn: 2024-10-29T10:30:00Z
   *               expiresIn: 7d
   *       400:
   *         $ref: '#/components/responses/ValidationError'
   *       409:
   *         description: El email ya está registrado
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *             example:
   *               error: El email ya está registrado en el sistema
   *               timestamp: 2024-10-29T10:30:00Z
   *       429:
   *         $ref: '#/components/responses/RateLimitError'
   *       500:
   *         $ref: '#/components/responses/InternalServerError'
   */
  router.post('/register', authRateLimit, authController.register);

  /**
   * @swagger
   * /api/v1/auth/login:
   *   post:
   *     tags: [Autenticación]
   *     summary: Iniciar sesión
   *     description: Autentica un usuario existente y devuelve un token JWT con rate limiting estricto
   *     operationId: loginUser
   *     security: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - email
   *               - password
   *             properties:
   *               email:
   *                 type: string
   *                 format: email
   *                 description: Email del usuario registrado
   *                 example: juan@ejemplo.com
   *               password:
   *                 type: string
   *                 description: Contraseña del usuario
   *                 example: miPassword123
   *           examples:
   *             login_ejemplo:
   *               summary: Login típico
   *               value:
   *                 email: juan@ejemplo.com
   *                 password: miPassword123
   *     responses:
   *       200:
   *         description: Login exitoso
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/LoginResponse'
   *             example:
   *               token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   *               user:
   *                 id: 550e8400-e29b-41d4-a716-446655440000
   *                 nombre: Juan
   *                 apellidos: Pérez García
   *                 email: juan@ejemplo.com
   *                 rol: USUARIO
   *                 activo: true
   *                 emailVerificado: true
   *               expiresIn: 7d
   *       400:
   *         $ref: '#/components/responses/ValidationError'
   *       401:
   *         description: Credenciales inválidas
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *             example:
   *               error: Credenciales inválidas
   *               timestamp: 2024-10-29T10:30:00Z
   *       423:
   *         description: Usuario inactivo
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *             example:
   *               error: Usuario inactivo. Contacta al administrador.
   *               timestamp: 2024-10-29T10:30:00Z
   *       429:
   *         $ref: '#/components/responses/RateLimitError'
   *       500:
   *         $ref: '#/components/responses/InternalServerError'
   */
  router.post('/login', authRateLimit, authController.login);

  /**
   * @swagger
   * /api/v1/auth/verify-email:
   *   post:
   *     tags: [Autenticación]
   *     summary: Verificar el correo con el código
   *     description: Verifica el correo del usuario con el código de 6 dígitos enviado al registrarse (item 3). 5 intentos por código, 15 minutos de vida.
   *     operationId: verifyEmail
   *     security: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - email
   *               - codigo
   *             properties:
   *               email:
   *                 type: string
   *                 format: email
   *                 example: juan@ejemplo.com
   *               codigo:
   *                 type: string
   *                 description: Código de 6 dígitos
   *                 example: '482913'
   *     responses:
   *       200:
   *         description: Correo verificado
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 emailVerificado:
   *                   type: boolean
   *                   example: true
   *                 mensaje:
   *                   type: string
   *                   example: Tu correo ha sido verificado. Ya puedes entrar.
   *       400:
   *         $ref: '#/components/responses/ValidationError'
   *       401:
   *         description: Código no válido o caducado
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *             example:
   *               error: El código no es válido o ha caducado.
   *       429:
   *         $ref: '#/components/responses/RateLimitError'
   *       500:
   *         $ref: '#/components/responses/InternalServerError'
   */
  router.post('/verify-email', authRateLimit, authController.verifyEmail);

  /**
   * @swagger
   * /api/v1/auth/resend-verification-code:
   *   post:
   *     tags: [Autenticación]
   *     summary: Reenviar el código de verificación
   *     description: Genera un código nuevo (invalida el anterior) y lo envía por correo. Respuesta genérica para no revelar si el correo existe. Enfriamiento de 60 s entre reenvíos.
   *     operationId: resendVerificationCode
   *     security: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - email
   *             properties:
   *               email:
   *                 type: string
   *                 format: email
   *                 example: juan@ejemplo.com
   *     responses:
   *       200:
   *         description: Solicitud procesada
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 emailSent:
   *                   type: boolean
   *                   example: true
   *                 mensaje:
   *                   type: string
   *                   example: Te hemos enviado un código de 6 dígitos a tu correo.
   *       400:
   *         $ref: '#/components/responses/ValidationError'
   *       429:
   *         $ref: '#/components/responses/RateLimitError'
   *       500:
   *         $ref: '#/components/responses/InternalServerError'
   */
  router.post('/resend-verification-code', authRateLimit, authController.resendVerificationCode);

  /**
   * @swagger
   * /api/v1/auth/refresh:
   *   post:
   *     tags: [Autenticación]
   *     summary: Renovar token de acceso
   *     description: Renueva un token de acceso usando un refresh token válido
   *     operationId: refreshToken
   *     security: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - refreshToken
   *             properties:
   *               refreshToken:
   *                 type: string
   *                 description: Token de refresh válido
   *                 example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   *     responses:
   *       200:
   *         description: Token renovado exitosamente
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 token:
   *                   type: string
   *                   description: Nuevo token de acceso
   *                 expiresIn:
   *                   type: string
   *                   description: Tiempo de expiración
   *             example:
   *               token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   *               expiresIn: 7d
   *       400:
   *         $ref: '#/components/responses/ValidationError'
   *       401:
   *         description: Refresh token inválido o expirado
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       429:
   *         $ref: '#/components/responses/RateLimitError'
   *       500:
   *         $ref: '#/components/responses/InternalServerError'
   */
  router.post('/refresh', apiRateLimit, authController.refresh);

  /**
   * @swagger
   * /api/v1/auth/logout:
   *   post:
   *     tags: [Autenticación]
   *     summary: Cerrar sesión
   *     description: Invalida los tokens del usuario autenticado
   *     operationId: logoutUser
   *     responses:
   *       200:
   *         description: Logout exitoso
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: Logout exitoso
   *                 timestamp:
   *                   type: string
   *                   format: date-time
   *             example:
   *               message: Logout exitoso
   *               timestamp: 2024-10-29T10:30:00Z
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       500:
   *         $ref: '#/components/responses/InternalServerError'
   */
  router.post('/logout', authController.logout);

  /**
   * @swagger
   * /api/v1/auth/me:
   *   get:
   *     tags: [Autenticación]
   *     summary: Obtener información del usuario autenticado
   *     description: Devuelve la información del usuario actualmente autenticado
   *     operationId: getCurrentUser
   *     responses:
   *       200:
   *         description: Información del usuario
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Usuario'
   *             example:
   *               id: 550e8400-e29b-41d4-a716-446655440000
   *               nombre: Juan
   *               apellidos: Pérez García
   *               email: juan@ejemplo.com
   *               rol: USUARIO
   *               activo: true
   *               emailVerificado: true
   *               creadoEn: 2024-10-29T10:30:00Z
   *               actualizadoEn: 2024-10-29T10:30:00Z
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       500:
   *         $ref: '#/components/responses/InternalServerError'
   */
  /**
   * @swagger
   * /api/v1/auth/me:
   *   delete:
   *     tags: [Autenticación]
   *     summary: Solicitar la eliminación de la cuenta (GDPR)
   *     description: Verifica la contraseña actual, desactiva la cuenta y fija la fecha de solicitud; la purga definitiva llega a los 30 días.
   *     operationId: requestAccountDeletion
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [password]
   *             properties:
   *               password:
   *                 type: string
   *                 description: Contraseña actual de la cuenta
   *     responses:
   *       200:
   *         description: Eliminación solicitada; cuenta desactivada
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 mensaje:
   *                   type: string
   *                 eliminacionSolicitadaEn:
   *                   type: string
   *                   format: date-time
   *                 eliminacionDefinitivaEn:
   *                   type: string
   *                   format: date-time
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       500:
   *         $ref: '#/components/responses/InternalServerError'
   *   get:
   *     tags: [Autenticación]
   *     summary: Exportar mis datos (GDPR)
   *     description: Descarga un JSON con el perfil, las listas con sus productos, las categorías, las tiendas, las plantillas, las colaboraciones y las invitaciones del usuario.
   *     operationId: exportMyData
   *     responses:
   *       200:
   *         description: Archivo JSON con los datos del usuario
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       500:
   *         $ref: '#/components/responses/InternalServerError'
   */
  // GET /me, PATCH /me y PATCH /me/password requieren autenticación (13A).
  // Antes /me no tenía middleware: req.user nunca se rellenaba y siempre daba 401.
  if (authMiddleware) {
    router.get('/me', authMiddleware, authController.me);
    router.patch('/me', authMiddleware, authController.updateMe);
    router.patch('/me/password', authMiddleware, authController.changeMyPassword);
    router.delete('/me', authMiddleware, authController.requestDeletion);
    router.get('/me/export', authMiddleware, authController.exportMyData);
  } else {
    router.get('/me', authController.me);
    router.patch('/me', authController.updateMe);
    router.patch('/me/password', authController.changeMyPassword);
    router.delete('/me', authController.requestDeletion);
    router.get('/me/export', authController.exportMyData);
  }

  return router;
}