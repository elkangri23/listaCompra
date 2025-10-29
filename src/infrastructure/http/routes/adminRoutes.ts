/**
 * Rutas para funcionalidades de administrador
 * Incluye endpoints para impersonación y gestión administrativa
 */

import { Router } from 'express';
import { AdminController } from '@infrastructure/http/controllers/AdminController';
import { validationMiddleware } from '@infrastructure/http/middlewares/validationMiddleware';
import { createAdminRateLimitMiddleware } from '@infrastructure/http/middlewares/adminRateLimitMiddleware';
import { z } from 'zod';

// Esquemas de validación
const impersonateUserSchema = z.object({
  targetUserId: z.string().uuid().optional(),
  targetUserEmail: z.string().email().optional(),
  reason: z.string().min(3).max(500).optional(),
  durationMinutes: z.number().int().min(1).max(480).optional()
}).refine((data) => data.targetUserId || data.targetUserEmail, {
  message: "Debe especificar targetUserId o targetUserEmail"
});

const endImpersonationSchema = z.object({
  sessionId: z.string().uuid().optional(),
  reason: z.string().min(3).max(500).optional()
});

export function createAdminRoutes(
  adminController: AdminController,
  authMiddleware: any,
  adminMiddleware: any
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

  return router;
}