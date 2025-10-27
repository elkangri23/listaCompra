import { Router } from 'express';
import { authMiddleware } from '../middlewares/authMiddleware';
import { validationMiddleware } from '../middlewares/validationMiddleware';
import { z } from 'zod';
import { InvitationController } from '../controllers/InvitationController';

// Schemas de validación para los endpoints de invitaciones
const shareListSchema = z.object({
  tipoPermiso: z.enum(['LECTURA', 'ESCRITURA']),
  duracionHoras: z.number().int().min(1).max(168).optional() // máximo 1 semana
});

const accessSharedListSchema = z.object({
  hash: z.string().min(1, 'Hash requerido')
});

const changePermissionsSchema = z.object({
  nuevoTipoPermiso: z.enum(['LECTURA', 'ESCRITURA'])
});

const removePermissionsSchema = z.object({
  usuarioId: z.string().uuid('ID de usuario debe ser un UUID válido')
});

const listParamsSchema = z.object({
  listaId: z.string().uuid('ID de lista debe ser un UUID válido')
});

const invitationParamsSchema = z.object({
  invitacionId: z.string().uuid('ID de invitación debe ser un UUID válido')
});

const permisoParamsSchema = z.object({
  permisoId: z.string().uuid('ID de permiso debe ser un UUID válido')
});

export function createInvitationRoutes(invitationController: InvitationController): Router {
  const router = Router();

  // Todas las rutas requieren autenticación
  router.use(authMiddleware);

  /**
   * @swagger
   * /api/invitations/{listaId}/share:
   *   post:
   *     summary: Compartir una lista con otros usuarios
   *     description: Genera una invitación con hash único para compartir una lista
   *     tags: [Invitations]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: listaId
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: ID de la lista a compartir
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - tipoPermiso
   *             properties:
   *               tipoPermiso:
   *                 type: string
   *                 enum: [LECTURA, ESCRITURA]
   *                 description: Tipo de permiso para la invitación
   *               duracionHoras:
   *                 type: integer
   *                 minimum: 1
   *                 maximum: 168
   *                 description: Duración de la invitación en horas (por defecto 24h)
   *     responses:
   *       201:
   *         description: Invitación creada exitosamente
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   type: object
   *                   properties:
   *                     id:
   *                       type: string
   *                       format: uuid
   *                     hash:
   *                       type: string
   *                     tipoPermiso:
   *                       type: string
   *                       enum: [LECTURA, ESCRITURA]
   *                     expiraEn:
   *                       type: string
   *                       format: date-time
   *                     enlaceAcceso:
   *                       type: string
   *                       description: URL completa para acceder a la invitación
   *       400:
   *         description: Datos de entrada inválidos
   *       401:
   *         description: Token de autenticación requerido
   *       403:
   *         description: Sin permisos para compartir esta lista
   *       404:
   *         description: Lista no encontrada
   */
  router.post(
    '/:listaId/share',
    validationMiddleware(listParamsSchema, 'params'),
    validationMiddleware(shareListSchema, 'body'),
    invitationController.shareList.bind(invitationController)
  );

  /**
   * @swagger
   * /api/invitations/access:
   *   post:
   *     summary: Acceder a una lista compartida
   *     description: Accede a una lista compartida usando el hash de invitación
   *     tags: [Invitations]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - hash
   *             properties:
   *               hash:
   *                 type: string
   *                 description: Hash único de la invitación
   *     responses:
   *       200:
   *         description: Acceso concedido exitosamente
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   type: object
   *                   properties:
   *                     lista:
   *                       type: object
   *                       description: Información de la lista compartida
   *                     permiso:
   *                       type: object
   *                       description: Permisos otorgados al usuario
   *       400:
   *         description: Hash inválido o faltante
   *       401:
   *         description: Token de autenticación requerido
   *       404:
   *         description: Invitación no encontrada o expirada
   */
  router.post(
    '/access',
    validationMiddleware(accessSharedListSchema, 'body'),
    invitationController.accessSharedList.bind(invitationController)
  );

  /**
   * @swagger
   * /api/invitations/permissions/{permisoId}:
   *   put:
   *     summary: Cambiar permisos de un usuario
   *     description: Modifica los permisos de un usuario en una lista compartida
   *     tags: [Invitations]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: permisoId
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: ID del permiso a modificar
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - nuevoTipoPermiso
   *             properties:
   *               nuevoTipoPermiso:
   *                 type: string
   *                 enum: [LECTURA, ESCRITURA]
   *                 description: Nuevo tipo de permiso
   *     responses:
   *       200:
   *         description: Permisos actualizados exitosamente
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   type: object
   *                   description: Información del permiso actualizado
   *       400:
   *         description: Datos de entrada inválidos
   *       401:
   *         description: Token de autenticación requerido
   *       403:
   *         description: Sin permisos para modificar esta lista
   *       404:
   *         description: Permiso no encontrado
   */
  router.put(
    '/permissions/:permisoId',
    validationMiddleware(permisoParamsSchema, 'params'),
    validationMiddleware(changePermissionsSchema, 'body'),
    invitationController.changePermissions.bind(invitationController)
  );

  /**
   * @swagger
   * /api/invitations/permissions/{permisoId}:
   *   delete:
   *     summary: Remover permisos de un usuario
   *     description: Elimina los permisos de un usuario en una lista compartida
   *     tags: [Invitations]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: permisoId
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: ID del permiso a eliminar
   *     responses:
   *       200:
   *         description: Permisos removidos exitosamente
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 message:
   *                   type: string
   *                   example: "Permisos removidos exitosamente"
   *       401:
   *         description: Token de autenticación requerido
   *       403:
   *         description: Sin permisos para modificar esta lista
   *       404:
   *         description: Permiso no encontrado
   */
  router.delete(
    '/permissions/:permisoId',
    validationMiddleware(permisoParamsSchema, 'params'),
    invitationController.removePermissions.bind(invitationController)
  );

  /**
   * @swagger
   * /api/invitations/{invitacionId}/cancel:
   *   delete:
   *     summary: Cancelar una invitación
   *     description: Cancela una invitación pendiente, haciéndola inaccesible
   *     tags: [Invitations]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: invitacionId
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: ID de la invitación a cancelar
   *     responses:
   *       200:
   *         description: Invitación cancelada exitosamente
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 message:
   *                   type: string
   *                   example: "Invitación cancelada exitosamente"
   *       401:
   *         description: Token de autenticación requerido
   *       403:
   *         description: Sin permisos para cancelar esta invitación
   *       404:
   *         description: Invitación no encontrada
   */
  router.delete(
    '/:invitacionId/cancel',
    validationMiddleware(invitationParamsSchema, 'params'),
    invitationController.cancelInvitation.bind(invitationController)
  );

  /**
   * @swagger
   * /api/invitations/{listaId}:
   *   get:
   *     summary: Obtener invitaciones de una lista
   *     description: Recupera todas las invitaciones activas de una lista
   *     tags: [Invitations]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: listaId
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: ID de la lista
   *     responses:
   *       200:
   *         description: Lista de invitaciones recuperada exitosamente
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   type: array
   *                   items:
   *                     type: object
   *                     description: Información de la invitación
   *       401:
   *         description: Token de autenticación requerido
   *       403:
   *         description: Sin permisos para ver esta lista
   *       404:
   *         description: Lista no encontrada
   */
  router.get(
    '/:listaId',
    validationMiddleware(listParamsSchema, 'params'),
    invitationController.getListInvitations.bind(invitationController)
  );

  /**
   * @swagger
   * /api/invitations/{listaId}/permissions:
   *   get:
   *     summary: Obtener permisos de una lista
   *     description: Recupera todos los permisos otorgados en una lista
   *     tags: [Invitations]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: listaId
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: ID de la lista
   *     responses:
   *       200:
   *         description: Lista de permisos recuperada exitosamente
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   type: array
   *                   items:
   *                     type: object
   *                     description: Información del permiso
   *       401:
   *         description: Token de autenticación requerido
   *       403:
   *         description: Sin permisos para ver esta lista
   *       404:
   *         description: Lista no encontrada
   */
  router.get(
    '/:listaId/permissions',
    validationMiddleware(listParamsSchema, 'params'),
    invitationController.getListPermissions.bind(invitationController)
  );

  return router;
}

export default createInvitationRoutes;