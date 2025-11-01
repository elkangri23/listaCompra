import { Router } from 'express';
import { AuditController } from '../controllers/AuditController';
import { container } from '../../../composition/container';
import { authMiddleware } from '../middlewares/authMiddleware';
import { authorize } from '../middlewares/authorizeMiddleware';
import { RolUsuario } from '@prisma/client';

export const auditRoutes = (router: Router) => {
  const auditController = container.resolve<AuditController>('auditController');

  /**
   * @swagger
   * /api/v1/audit/lists/{listId}:
   *   get:
   *     summary: Obtiene el historial de auditoría para una lista específica.
   *     tags: [Auditoría]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: listId
   *         required: true
   *         schema:
   *           type: string
   *         description: ID de la lista.
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
   *         description: Historial de auditoría de la lista.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 status:
   *                   type: string
   *                   example: success
   *                 data:
   *                   $ref: '#/components/schemas/AuditHistoryResponse'
   *       400:
   *         $ref: '#/components/responses/ValidationError'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       500:
   *         $ref: '#/components/responses/InternalServerError'
   */
  router.get('/audit/lists/:listId', authMiddleware, auditController.getListAuditHistory);

  /**
   * @swagger
   * /api/v1/audit/products/{productId}:
   *   get:
   *     summary: Obtiene el historial de auditoría para un producto específico.
   *     tags: [Auditoría]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: productId
   *         required: true
   *         schema:
   *           type: string
   *         description: ID del producto.
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
   *         description: Historial de auditoría del producto.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 status:
   *                   type: string
   *                   example: success
   *                 data:
   *                   $ref: '#/components/schemas/AuditHistoryResponse'
   *       400:
   *         $ref: '#/components/responses/ValidationError'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       500:
   *         $ref: '#/components/responses/InternalServerError'
   */
  router.get('/audit/products/:productId', authMiddleware, auditController.getProductAuditHistory);

  /**
   * @swagger
   * /api/v1/admin/audit:
   *   get:
   *     summary: Obtiene el historial de auditoría global (solo para administradores).
   *     tags: [Auditoría, Admin]
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
   *         name: entityId
   *         schema:
   *           type: string
   *         description: ID de la entidad a filtrar.
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
   *         description: Historial de auditoría global.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 status:
   *                   type: string
   *                   example: success
   *                 data:
   *                   $ref: '#/components/schemas/AuditHistoryResponse'
   *       400:
   *         $ref: '#/components/responses/ValidationError'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       500:
   *         $ref: '#/components/responses/InternalServerError'
   */
  router.get('/admin/audit', authMiddleware, authorize([RolUsuario.ADMIN]), auditController.getGlobalAuditHistory);
};
