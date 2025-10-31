/**
 * Rutas HTTP para gestión de listas
 */

import { Router } from 'express';
import { ListController } from '@infrastructure/http/controllers/ListController';

export function createListRoutes(
  listController: ListController, 
  authMiddleware: (req: any, res: any, next: any) => Promise<void>
): Router {
  const router = Router();

  // Aplicar middleware de autenticación a todas las rutas de listas
  router.use(authMiddleware);

  /**
   * @swagger
   * /api/lists:
   *   post:
   *     summary: Crear nueva lista
   *     tags: [Listas]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - nombre
   *             properties:
   *               nombre:
   *                 type: string
   *                 description: Nombre de la lista
   *                 maxLength: 100
   *               descripcion:
   *                 type: string
   *                 description: Descripción opcional de la lista
   *                 maxLength: 500
   *     responses:
   *       201:
   *         description: Lista creada exitosamente
   *       400:
   *         description: Error de validación
   *       401:
   *         description: No autenticado
   */
  router.post('/', (req, res) => listController.create(req, res));

  /**
   * @swagger
   * /api/lists:
   *   get:
   *     summary: Obtener listas del usuario
   *     tags: [Listas]
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
   *           default: 10
   *         description: Elementos por página
   *       - in: query
   *         name: activa
   *         schema:
   *           type: boolean
   *         description: Filtrar por estado activo
   *       - in: query
   *         name: tiendaId
   *         schema:
   *           type: string
   *         description: Filtrar por tienda
   *     responses:
   *       200:
   *         description: Listas obtenidas exitosamente
   *       401:
   *         description: No autenticado
   */
  router.get('/', (req, res) => listController.getUserLists(req, res));

  /**
   * @swagger
   * /api/lists/{id}:
   *   get:
   *     summary: Obtener lista por ID
   *     tags: [Listas]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: ID de la lista
   *     responses:
   *       200:
   *         description: Lista obtenida exitosamente
   *       404:
   *         description: Lista no encontrada
   *       401:
   *         description: No autenticado
   */
  router.get('/:id', (req, res) => listController.getById(req, res));

  /**
   * @swagger
   * /api/lists/{id}:
   *   put:
   *     summary: Actualizar lista
   *     tags: [Listas]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: ID de la lista
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               nombre:
   *                 type: string
   *                 description: Nuevo nombre de la lista
   *                 maxLength: 100
   *               descripcion:
   *                 type: string
   *                 description: Nueva descripción de la lista
   *                 maxLength: 500
   *               tiendaId:
   *                 type: string
   *                 description: ID de la tienda asociada
   *     responses:
   *       200:
   *         description: Lista actualizada exitosamente
   *       400:
   *         description: Error de validación
   *       403:
   *         description: Sin permisos para modificar la lista
   *       404:
   *         description: Lista no encontrada
   *       401:
   *         description: No autenticado
   */
  router.put('/:id', (req, res) => listController.update(req, res));

  /**
   * @swagger
   * /api/lists/{id}:
   *   delete:
   *     summary: Eliminar lista
   *     tags: [Listas]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: ID de la lista
   *       - in: query
   *         name: permanente
   *         schema:
   *           type: boolean
   *           default: false
   *         description: Si true, elimina permanentemente la lista
   *     responses:
   *       200:
   *         description: Lista eliminada exitosamente
   *       403:
   *         description: Sin permisos para eliminar la lista
   *       404:
   *         description: Lista no encontrada
   *       401:
   *         description: No autenticado
   */
  router.delete('/:id', (req, res) => listController.delete(req, res));

  return router;
}