/**
 * Rutas para funcionalidades de administrador
 * Incluye endpoints para impersonación y gestión administrativa
 */

import { Router } from 'express';
import type { AdminController } from '@infrastructure/http/controllers/AdminController';
import type { AuditController } from '@infrastructure/http/controllers/AuditController';
import { validationMiddleware } from '@infrastructure/http/middlewares/validationMiddleware';
import { createAdminRateLimitMiddleware } from '@infrastructure/http/middlewares/adminRateLimitMiddleware';
import { securityTestEndpoint } from '../../security/SecurityTestingService';
import { z } from 'zod';

// Esquemas de validación
// validationMiddleware valida el objeto req completo: los campos van bajo `body`
// (patrón del resto de rutas). Con el esquema plano anterior, safeParse(req)
// nunca veía targetUserId/targetUserEmail y el refine fallaba siempre:
// POST /impersonate devolvía 400 incluso con un cuerpo válido.
const impersonateUserSchema = z.object({
  body: z.object({
    targetUserId: z.string().uuid().optional(),
    targetUserEmail: z.string().email().optional(),
    reason: z.string().min(3).max(500).optional(),
    durationMinutes: z.number().int().min(1).max(480).optional()
  }).refine((data) => data.targetUserId || data.targetUserEmail, {
    message: 'Debe especificar targetUserId o targetUserEmail'
  })
});

const endImpersonationSchema = z.object({
  body: z.object({
    sessionId: z.string().uuid().optional(),
    reason: z.string().min(3).max(500).optional()
  })
});

const updateUserStatusSchema = z.object({
  body: z.object({
    activo: z.boolean()
  })
});

// Restauración de copia (fase 6): la validación de negocio (confirmación
// exactamente "RESTAURAR", motivo no vacío) vive en el caso de uso
// RequestRestore; aquí solo se exige que vengan los dos campos como
// cadenas, para que el 400 del caso de uso tenga su mensaje exacto.
const requestRestoreSchema = z.object({
  body: z.object({
    confirmacion: z.string(),
    motivo: z.string()
  })
});

export function createAdminRoutes(
  adminController: AdminController,
  authMiddleware: any,
  adminMiddleware: any,
  // Opcional para no romper los montajes de tests que solo usan AdminController:
  // sin él, la ruta /audit-logs no se registra.
  auditController?: AuditController
): Router {
  const router = Router();
  
  // Aplicar rate limiting específico para endpoints administrativos
  const adminRateLimitMiddleware = createAdminRateLimitMiddleware();

  /**
   * @swagger
   * /api/v1/admin/impersonate:
   *   post:
   *     summary: Iniciar impersonación de usuario
   *     description: Permite a un administrador actuar como otro usuario del sistema
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               targetUserId:
   *                 type: string
   *                 format: uuid
   *                 description: ID del usuario a impersonar
   *               targetUserEmail:
   *                 type: string
   *                 format: email
   *                 description: Email del usuario a impersonar (alternativo al ID)
   *               reason:
   *                 type: string
   *                 minLength: 3
   *                 maxLength: 500
   *                 description: Razón de la impersonación para auditoría
   *               durationMinutes:
   *                 type: integer
   *                 minimum: 1
   *                 maximum: 480
   *                 description: Duración en minutos (default 60, máximo 8 horas)
   *             required:
   *               - targetUserId OR targetUserEmail
   *           examples:
   *             byId:
   *               summary: Impersonar por ID de usuario
   *               value:
   *                 targetUserId: "123e4567-e89b-12d3-a456-426614174000"
   *                 reason: "Soporte técnico - resolver problema de lista"
   *                 durationMinutes: 30
   *             byEmail:
   *               summary: Impersonar por email
   *               value:
   *                 targetUserEmail: "usuario@ejemplo.com"
   *                 reason: "Investigación de bug reportado"
   *                 durationMinutes: 60
   *     responses:
   *       200:
   *         description: Impersonación iniciada exitosamente
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 message:
   *                   type: string
   *                 data:
   *                   type: object
   *                   properties:
   *                     impersonationToken:
   *                       type: string
   *                       description: Token JWT para usar durante la impersonación
   *                     impersonatedUser:
   *                       type: object
   *                       properties:
   *                         id:
   *                           type: string
   *                         email:
   *                           type: string
   *                         nombre:
   *                           type: string
   *                         apellidos:
   *                           type: string
   *                     adminUser:
   *                       type: object
   *                       properties:
   *                         id:
   *                           type: string
   *                         email:
   *                           type: string
   *                         nombre:
   *                           type: string
   *                     expiresAt:
   *                       type: string
   *                       format: date-time
   *                     startedAt:
   *                       type: string
   *                       format: date-time
   *       400:
   *         description: Datos de entrada inválidos
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       401:
   *         description: Token no válido o expirado
   *       403:
   *         description: Solo administradores pueden impersonar usuarios
   *       404:
   *         description: Usuario objetivo no encontrado
   *       500:
   *         description: Error interno del servidor
   */
  router.post(
    '/impersonate',
    authMiddleware,
    adminMiddleware,
    adminRateLimitMiddleware,
    validationMiddleware(impersonateUserSchema),
    (req: any, res: any) => adminController.impersonateUser(req, res)
  );

  /**
   * @swagger
   * /api/v1/admin/impersonate:
   *   delete:
   *     summary: Finalizar impersonación
   *     description: Termina la sesión de impersonación actual y restaura el contexto del administrador
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: false
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               sessionId:
   *                 type: string
   *                 format: uuid
   *                 description: ID de la sesión (opcional)
   *               reason:
   *                 type: string
   *                 minLength: 3
   *                 maxLength: 500
   *                 description: Razón para finalizar
   *           example:
   *             reason: "Tarea de soporte completada"
   *     responses:
   *       200:
   *         description: Impersonación finalizada exitosamente
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 message:
   *                   type: string
   *                 data:
   *                   type: object
   *                   properties:
   *                     terminatedSession:
   *                       type: object
   *                       properties:
   *                         sessionId:
   *                           type: string
   *                         adminId:
   *                           type: string
   *                         targetUserId:
   *                           type: string
   *                         startedAt:
   *                           type: string
   *                           format: date-time
   *                         endedAt:
   *                           type: string
   *                           format: date-time
   *                         duration:
   *                           type: string
   *                           description: Duración en formato legible
   *                     adminToken:
   *                       type: string
   *                       description: Nuevo token para el administrador
   *       400:
   *         description: No hay sesión de impersonación activa
   *       401:
   *         description: Token de impersonación inválido o expirado
   *       500:
   *         description: Error interno del servidor
   */
  router.delete(
    '/impersonate',
    authMiddleware,
    adminRateLimitMiddleware,
    // Nota: No validamos rol aquí porque el token debe ser de impersonación
    validationMiddleware(endImpersonationSchema),
    (req: any, res: any) => adminController.endImpersonation(req, res)
  );

  /**
   * @swagger
   * /api/v1/admin/impersonate/status:
   *   get:
   *     summary: Obtener estado de impersonación
   *     description: Verifica si hay una sesión de impersonación activa
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Estado de impersonación obtenido
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   type: object
   *                   properties:
   *                     isImpersonating:
   *                       type: boolean
   *                     currentUser:
   *                       type: object
   *                       properties:
   *                         id:
   *                           type: string
   *                         email:
   *                           type: string
   *                         nombre:
   *                           type: string
   *                         rol:
   *                           type: string
   *                     adminUser:
   *                       type: object
   *                       nullable: true
   *                       properties:
   *                         id:
   *                           type: string
   *                         email:
   *                           type: string
   *       401:
   *         description: Token no válido
   *       500:
   *         description: Error interno del servidor
   */
  router.get(
    '/impersonate/status',
    authMiddleware,
    adminRateLimitMiddleware,
    (req: any, res: any) => adminController.getImpersonationStatus(req, res)
  );

  /**
   * @swagger
   * /api/v1/admin/audit/impersonations:
   *   get:
   *     summary: Obtener historial de impersonaciones
   *     description: Lista el historial de impersonaciones realizadas (funcionalidad futura)
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           minimum: 1
   *           default: 1
   *         description: Número de página
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           minimum: 1
   *           maximum: 100
   *           default: 20
   *         description: Elementos por página
   *       - in: query
   *         name: adminId
   *         schema:
   *           type: string
   *           format: uuid
   *         description: Filtrar por ID de administrador
   *       - in: query
   *         name: targetUserId
   *         schema:
   *           type: string
   *           format: uuid
   *         description: Filtrar por ID de usuario impersonado
   *     responses:
   *       200:
   *         description: Historial de impersonaciones
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 message:
   *                   type: string
   *                 data:
   *                   type: object
   *                   properties:
   *                     impersonations:
   *                       type: array
   *                       items:
   *                         type: object
   *                     total:
   *                       type: integer
   *                     note:
   *                       type: string
   *       401:
   *         description: Token no válido
   *       403:
   *         description: Acceso denegado, se requiere rol de administrador
   *       500:
   *         description: Error interno del servidor
   */
  router.get(
    '/audit/impersonations',
    authMiddleware,
    adminMiddleware,
    adminRateLimitMiddleware,
    (req: any, res: any) => adminController.getImpersonationAuditLog(req, res)
  );

  /**
   * @swagger
   * /api/v1/admin/security/test:
   *   get:
   *     summary: Ejecutar tests de seguridad automáticos
   *     description: Ejecuta una suite completa de tests de seguridad y devuelve un reporte con score y recomendaciones
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Reporte de seguridad generado exitosamente
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 securityScore:
   *                   type: number
   *                   minimum: 0
   *                   maximum: 100
   *                 totalTests:
   *                   type: number
   *                 passedTests:
   *                   type: number
   *                 failedTests:
   *                   type: number
   *                 summary:
   *                   type: object
   *                   properties:
   *                     critical:
   *                       type: number
   *                     high:
   *                       type: number
   *                     medium:
   *                       type: number
   *                     low:
   *                       type: number
   *                 report:
   *                   type: string
   *                 results:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       testName:
   *                         type: string
   *                       passed:
   *                         type: boolean
   *                       details:
   *                         type: string
   *                       severity:
   *                         type: string
   *                         enum: [LOW, MEDIUM, HIGH, CRITICAL]
   *                       recommendation:
   *                         type: string
   *                 timestamp:
   *                   type: string
   *                   format: date-time
   *       401:
   *         description: Token no válido
   *       403:
   *         description: Acceso denegado, se requiere rol de administrador
   *       500:
   *         description: Error interno del servidor
   */
  router.get(
    '/security/test',
    authMiddleware,
    adminMiddleware,
    adminRateLimitMiddleware,
    securityTestEndpoint
  );

  /**
   * @swagger
   * /api/v1/admin/users:
   *   get:
   *     summary: Listar usuarios
   *     description: Lista los usuarios del sistema con búsqueda por nombre o correo y paginación. Incluye conteos reales de listas creadas y productos agregados por cada usuario.
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: q
   *         schema:
   *           type: string
   *         description: Búsqueda por nombre, apellidos o email
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           minimum: 1
   *           default: 1
   *         description: Número de página
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           minimum: 1
   *           maximum: 100
   *           default: 20
   *         description: Elementos por página
   *     responses:
   *       200:
   *         description: Listado de usuarios
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   type: object
   *                   properties:
   *                     usuarios:
   *                       type: array
   *                       items:
   *                         type: object
   *                         properties:
   *                           id:
   *                             type: string
   *                           nombre:
   *                             type: string
   *                           email:
   *                             type: string
   *                           rol:
   *                             type: string
   *                             enum: [USUARIO, ADMIN]
   *                           activo:
   *                             type: boolean
   *                           emailVerificado:
   *                             type: boolean
   *                           fechaCreacion:
   *                             type: string
   *                             format: date-time
   *                           fechaActualizacion:
   *                             type: string
   *                             format: date-time
   *                           listasCreadas:
   *                             type: integer
   *                           productosAgregados:
   *                             type: integer
   *                     total:
   *                       type: integer
   *                     page:
   *                       type: integer
   *                     limit:
   *                       type: integer
   *                     totalPages:
   *                       type: integer
   *       401:
   *         description: Token no válido o expirado
   *       403:
   *         description: Acceso denegado, se requiere rol de administrador
   *       500:
   *         description: Error interno del servidor
   */
  router.get(
    '/users',
    authMiddleware,
    adminMiddleware,
    adminRateLimitMiddleware,
    (req: any, res: any) => adminController.getAdminUsers(req, res)
  );

  /**
   * @swagger
   * /api/v1/admin/users/{id}/status:
   *   patch:
   *     summary: Activar o desactivar un usuario
   *     description: Activa o desactiva la cuenta de un usuario. Un administrador no puede desactivar su propia cuenta.
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: ID del usuario
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               activo:
   *                 type: boolean
   *                 description: Nuevo estado de la cuenta
   *             required:
   *               - activo
   *           example:
   *             activo: false
   *     responses:
   *       200:
   *         description: Estado del usuario actualizado
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 message:
   *                   type: string
   *                 data:
   *                   type: object
   *                   properties:
   *                     usuario:
   *                       type: object
   *                       properties:
   *                         id:
   *                           type: string
   *                         nombre:
   *                           type: string
   *                         email:
   *                           type: string
   *                         rol:
   *                           type: string
   *                         activo:
   *                           type: boolean
   *                         emailVerificado:
   *                           type: boolean
   *                         fechaCreacion:
   *                           type: string
   *                           format: date-time
   *                         fechaActualizacion:
   *                           type: string
   *                           format: date-time
   *       400:
   *         description: Datos inválidos, auto-desactivación o el usuario ya está en ese estado
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   *       401:
   *         description: Token no válido o expirado
   *       403:
   *         description: Acceso denegado, se requiere rol de administrador
   *       404:
   *         description: Usuario no encontrado
   *       500:
   *         description: Error interno del servidor
   */
  router.patch(
    '/users/:id/status',
    authMiddleware,
    adminMiddleware,
    adminRateLimitMiddleware,
    validationMiddleware(updateUserStatusSchema),
    (req: any, res: any) => adminController.updateUserStatus(req, res)
  );

  /**
   * @swagger
   * /api/v1/admin/security/overview:
   *   get:
   *     summary: Resumen de seguridad (panel de administración)
   *     description: Cuentas con 2FA (n de m), intentos fallidos en las últimas 24 h, estado de Turnstile y cuentas en periodo de gracia GDPR. Todo con datos reales; una sección que no se puede calcular llega como null con el motivo en `unavailable`, nunca inventada.
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Resumen de seguridad
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   type: object
   *                   properties:
   *                     twoFactor:
   *                       type: object
   *                       nullable: true
   *                       properties:
   *                         enabled:
   *                           type: integer
   *                         total:
   *                           type: integer
   *                     failedLoginsLast24h:
   *                       type: integer
   *                       nullable: true
   *                     turnstile:
   *                       type: object
   *                       properties:
   *                         enabled:
   *                           type: boolean
   *                     gracePeriod:
   *                       type: object
   *                       nullable: true
   *                       properties:
   *                         count:
   *                           type: integer
   *                         accounts:
   *                           type: array
   *                           items:
   *                             type: object
   *                             properties:
   *                               email:
   *                                 type: string
   *                               eliminacionSolicitadaEn:
   *                                 type: string
   *                                 format: date-time
   *                               daysLeft:
   *                                 type: integer
   *                     unavailable:
   *                       type: object
   *                       properties:
   *                         twoFactor:
   *                           type: string
   *                         failedLogins:
   *                           type: string
   *                         gracePeriod:
   *                           type: string
   *       401:
   *         description: Token no válido o expirado
   *       403:
   *         description: Acceso denegado, se requiere rol de administrador
   *       500:
   *         description: Error interno del servidor
   */
  router.get(
    '/security/overview',
    authMiddleware,
    adminMiddleware,
    adminRateLimitMiddleware,
    (req: any, res: any) => adminController.getSecurityOverview(req, res)
  );

  /**
   * @swagger
   * /api/v1/admin/security/login-attempts:
   *   get:
   *     summary: Intentos de inicio de sesión (panel de administración)
   *     description: Lista paginada de los intentos de login registrados (correctos y fallidos), ordenados por fecha descendente. Filtros por email, resultado y rango de fechas.
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: email
   *         schema:
   *           type: string
   *         description: Filtrar por email (insensible a mayúsculas)
   *       - in: query
   *         name: success
   *         schema:
   *           type: boolean
   *         description: true para correctos, false para fallidos
   *       - in: query
   *         name: startDate
   *         schema:
   *           type: string
   *           format: date-time
   *         description: Fecha de inicio para filtrar
   *       - in: query
   *         name: endDate
   *         schema:
   *           type: string
   *           format: date-time
   *         description: Fecha de fin para filtrar
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           minimum: 1
   *           default: 1
   *         description: Número de página
   *       - in: query
   *         name: pageSize
   *         schema:
   *           type: integer
   *           minimum: 1
   *           maximum: 100
   *           default: 20
   *         description: Elementos por página
   *     responses:
   *       200:
   *         description: Listado de intentos de inicio de sesión
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   type: object
   *                   properties:
   *                     attempts:
   *                       type: array
   *                       items:
   *                         type: object
   *                         properties:
   *                           id:
   *                             type: string
   *                           email:
   *                             type: string
   *                           success:
   *                             type: boolean
   *                           reason:
   *                             type: string
   *                             nullable: true
   *                             enum: [WRONG_PASSWORD, USER_NOT_FOUND, UNVERIFIED_EMAIL, INACTIVE_ACCOUNT, MFA_FAILED]
   *                           ipAddress:
   *                             type: string
   *                             nullable: true
   *                           userAgent:
   *                             type: string
   *                             nullable: true
   *                           createdAt:
   *                             type: string
   *                             format: date-time
   *                     total:
   *                       type: integer
   *                     page:
   *                       type: integer
   *                     pageSize:
   *                       type: integer
   *                     totalPages:
   *                       type: integer
   *       401:
   *         description: Token no válido o expirado
   *       403:
   *         description: Acceso denegado, se requiere rol de administrador
   *       500:
   *         description: Error interno del servidor
   */
  router.get(
    '/security/login-attempts',
    authMiddleware,
    adminMiddleware,
    adminRateLimitMiddleware,
    (req: any, res: any) => adminController.getLoginAttempts(req, res)
  );

  /**
   * @swagger
   * /api/v1/admin/security/alerts:
   *   get:
   *     summary: Alertas de seguridad calculadas (panel de administración)
   *     description: Alertas generadas con datos reales, no una lista fija. Reglas: más de 5 intentos fallidos para el mismo email en 1 hora (alta); un administrador sin 2FA (media); una cuenta en periodo de gracia a menos de 7 días de su eliminación definitiva (media). Sin datos que las disparen, la lista es vacía.
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           minimum: 1
   *           default: 1
   *         description: Número de página
   *       - in: query
   *         name: pageSize
   *         schema:
   *           type: integer
   *           minimum: 1
   *           maximum: 100
   *           default: 20
   *         description: Elementos por página
   *     responses:
   *       200:
   *         description: Alertas de seguridad
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   type: object
   *                   properties:
   *                     alerts:
   *                       type: array
   *                       items:
   *                         type: object
   *                         properties:
   *                           id:
   *                             type: string
   *                           type:
   *                             type: string
   *                             enum: [BRUTE_FORCE_EMAIL, ADMIN_WITHOUT_2FA, GRACE_PERIOD_ENDING]
   *                           severity:
   *                             type: string
   *                             enum: [high, medium, low]
   *                           message:
   *                             type: string
   *                           createdAt:
   *                             type: string
   *                             format: date-time
   *                           relatedEmail:
   *                             type: string
   *                     total:
   *                       type: integer
   *                     page:
   *                       type: integer
   *                     pageSize:
   *                       type: integer
   *                     totalPages:
   *                       type: integer
   *       401:
   *         description: Token no válido o expirado
   *       403:
   *         description: Acceso denegado, se requiere rol de administrador
   *       500:
   *         description: Error interno del servidor
   */
  router.get(
    '/security/alerts',
    authMiddleware,
    adminMiddleware,
    adminRateLimitMiddleware,
    (req: any, res: any) => adminController.getSecurityAlerts(req, res)
  );

  /**
   * @swagger
   * /api/v1/admin/backups:
   *   get:
   *     summary: Listar copias de seguridad
   *     description: Lista las copias de seguridad reales de la base de datos, ordenadas por fecha descendente, paginadas. Solo administradores.
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           minimum: 1
   *           default: 1
   *         description: Número de página
   *       - in: query
   *         name: pageSize
   *         schema:
   *           type: integer
   *           minimum: 1
   *           maximum: 100
   *           default: 20
   *         description: Elementos por página
   *     responses:
   *       200:
   *         description: Listado de copias de seguridad
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   type: object
   *                   properties:
   *                     backups:
   *                       type: array
   *                       items:
   *                         type: object
   *                         properties:
   *                           id:
   *                             type: string
   *                           filename:
   *                             type: string
   *                           sizeBytes:
   *                             type: integer
   *                           status:
   *                             type: string
   *                             enum: [PENDING, CREATED, FAILED, RESTORING, RESTORED, RESTORE_FAILED]
   *                           source:
   *                             type: string
   *                             enum: [SCHEDULED, MANUAL]
   *                           createdAt:
   *                             type: string
   *                             format: date-time
   *                           createdByUserId:
   *                             type: string
   *                             nullable: true
   *                           restoreReason:
   *                             type: string
   *                             nullable: true
   *                           restoredAt:
   *                             type: string
   *                             format: date-time
   *                             nullable: true
   *                           failureReason:
   *                             type: string
   *                             nullable: true
   *                     total:
   *                       type: integer
   *                     page:
   *                       type: integer
   *                     pageSize:
   *                       type: integer
   *                     totalPages:
   *                       type: integer
   *       401:
   *         description: Token no válido o expirado
   *       403:
   *         description: Acceso denegado, se requiere rol de administrador
   *       500:
   *         description: Error interno del servidor
   */
  router.get(
    '/backups',
    authMiddleware,
    adminMiddleware,
    adminRateLimitMiddleware,
    (req: any, res: any) => adminController.getBackups(req, res)
  );

  /**
   * @swagger
   * /api/v1/admin/backups:
   *   post:
   *     summary: Solicitar una copia de seguridad manual
   *     description: Registra una solicitud de copia de seguridad (status PENDING, source MANUAL). NO hace el dump: el watcher del host (backup-watcher.sh, cada 5 min) recoge la solicitud y ejecuta backup-prod.sh. Si ya hay una PENDING, devuelve 409.
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       201:
   *         description: Solicitud de copia registrada
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   type: object
   *                   properties:
   *                     backup:
   *                       type: object
   *                       properties:
   *                         id:
   *                           type: string
   *                         filename:
   *                           type: string
   *                         sizeBytes:
   *                           type: integer
   *                         status:
   *                           type: string
   *                           enum: [PENDING]
   *                         source:
   *                           type: string
   *                           enum: [MANUAL]
   *                         createdAt:
   *                           type: string
   *                           format: date-time
   *                         createdByUserId:
   *                           type: string
   *       401:
   *         description: Token no válido o expirado
   *       403:
   *         description: Acceso denegado, se requiere rol de administrador
   *       409:
   *         description: Ya hay una copia de seguridad pendiente de procesar
   *       500:
   *         description: Error interno del servidor
   */
  router.post(
    '/backups',
    authMiddleware,
    adminMiddleware,
    adminRateLimitMiddleware,
    (req: any, res: any) => adminController.requestBackup(req, res)
  );

  /**
   * @swagger
   * /api/v1/admin/backups/{id}/download:
   *   get:
   *     summary: Descargar el fichero de una copia de seguridad
   *     description: Descarga el .sql.gz de la copia desde el volumen /backups (solo lectura). Si la copia no existe o el fichero no está en disco, devuelve 404.
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: ID de la copia
   *     responses:
   *       200:
   *         description: Fichero .sql.gz de la copia
   *         content:
   *           application/gzip:
   *             schema:
   *               type: string
   *               format: binary
   *       401:
   *         description: Token no válido o expirado
   *       403:
   *         description: Acceso denegado, se requiere rol de administrador
   *       404:
   *         description: Copia no encontrada o fichero no disponible en disco
   *       500:
   *         description: Error interno del servidor
   */
  router.get(
    '/backups/:id/download',
    authMiddleware,
    adminMiddleware,
    adminRateLimitMiddleware,
    (req: any, res: any) => adminController.downloadBackup(req, res)
  );

  /**
   * @swagger
   * /api/v1/admin/backups/{id}/restore:
   *   post:
   *     summary: Solicitar la restauración de una copia de seguridad
   *     description: Registra una solicitud de restauración (status RESTORING). NO restaura nada directamente: el watcher del host delega en restore-prod.sh, que primero ensaya en una base aislada y solo si el ensayo pasa crea una copia pre-restore, para la API y restaura. Requiere confirmacion exactamente "RESTAURAR" y un motivo no vacío.
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: ID de la copia
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               confirmacion:
   *                 type: string
   *                 example: RESTAURAR
   *                 description: Palabra de confirmación, exactamente "RESTAURAR"
   *               motivo:
   *                 type: string
   *                 description: Motivo no vacío de la restauración
   *             required:
   *               - confirmacion
   *               - motivo
   *     responses:
   *       202:
   *         description: Solicitud de restauración registrada
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 data:
   *                   type: object
   *                   properties:
   *                     backup:
   *                       type: object
   *                       properties:
   *                         id:
   *                           type: string
   *                         status:
   *                           type: string
   *                           enum: [RESTORING]
   *                         restoreReason:
   *                           type: string
   *       400:
   *         description: Confirmación distinta de "RESTAURAR", motivo vacío, o copia PENDING/FAILED
   *       401:
   *         description: Token no válido o expirado
   *       403:
   *         description: Acceso denegado, se requiere rol de administrador
   *       404:
   *         description: Copia no encontrada
   *       409:
   *         description: Ya hay una restauración solicitada o en curso
   *       500:
   *         description: Error interno del servidor
   */
  router.post(
    '/backups/:id/restore',
    authMiddleware,
    adminMiddleware,
    adminRateLimitMiddleware,
    validationMiddleware(requestRestoreSchema),
    (req: any, res: any) => adminController.requestRestore(req, res)
  );

  /**
   * @swagger
   * /api/v1/admin/audit-logs:

   *   get:
   *     summary: Vista global de auditoría (panel de administración)
   *     description: Lista los cambios registrados en audit_entries, paginados y con filtros. Solo administradores. Mismos datos que /admin/audit con el sobre {success, data} del resto de /admin/*.
   *     tags: [Admin]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           default: 1
   *         description: Número de página.
   *       - in: query
   *         name: pageSize
   *         schema:
   *           type: integer
   *           default: 10
   *         description: Tamaño de página.
   *       - in: query
   *         name: entityType
   *         schema:
   *           type: string
   *           enum: [Lista, Producto]
   *         description: Tipo de entidad a filtrar.
   *       - in: query
   *         name: changeType
   *         schema:
   *           type: string
   *           enum: [CREATE, UPDATE, DELETE]
   *         description: Tipo de cambio a filtrar.
   *       - in: query
   *         name: changedByUserId
   *         schema:
   *           type: string
   *         description: ID del usuario que realizó el cambio.
   *       - in: query
   *         name: startDate
   *         schema:
   *           type: string
   *           format: date-time
   *         description: Fecha de inicio para filtrar.
   *       - in: query
   *         name: endDate
   *         schema:
   *           type: string
   *           format: date-time
   *         description: Fecha de fin para filtrar.
   *     responses:
   *       200:
   *         description: Historial global de auditoría.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   $ref: '#/components/schemas/AuditHistoryResponse'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         description: Acceso denegado, se requiere rol de administrador
   *       500:
   *         $ref: '#/components/responses/InternalServerError'
   */
  if (auditController) {
    router.get(
      '/audit-logs',
      authMiddleware,
      adminMiddleware,
      adminRateLimitMiddleware,
      (req: any, res: any) => auditController.getAdminAuditLogs(req, res)
    );
  }

  return router;
}
