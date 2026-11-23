/**
 * Rutas HTTP para la gestión de tiendas
 * Define todos los endpoints REST para tiendas
 */

import { Router } from 'express';
import type { StoreController } from '@infrastructure/http/controllers/StoreController';

export const createStoreRoutes = (storeController: StoreController): Router => {
  const router = Router();

  /**
   * POST /api/v1/stores
   * Crear una nueva tienda
   * Body: { nombre, direccion?, telefono?, sitioWeb? }
   */
  router.post('/', storeController.create.bind(storeController));

  /**
   * GET /api/v1/stores
   * Obtener todas las tiendas con filtros opcionales
   * Query: ?page=number&limit=number&tipo=string&activas=boolean&search=string
   */
  router.get('/', storeController.getAll.bind(storeController));

  /**
   * GET /api/v1/stores/:id
   * Obtener una tienda por ID
   * Params: { id }
   */
  router.get('/:id', storeController.getById.bind(storeController));

  /**
   * PUT /api/v1/stores/:id
   * Actualizar una tienda existente
   * Params: { id }
   * Body: { nombre?, direccion?, telefono?, sitioWeb?, activa? }
   */
  router.put('/:id', storeController.update.bind(storeController));

  /**
   * DELETE /api/v1/stores/:id
   * Eliminar una tienda
   * Params: { id }
   */
  router.delete('/:id', storeController.delete.bind(storeController));

  /**
   * PATCH /api/v1/stores/:id/toggle-status
   * Cambiar el estado activo/inactivo de una tienda
   * Params: { id }
   * Body: { activa: boolean }
   */
  router.patch('/:id/toggle-status', storeController.toggleStatus.bind(storeController));

  /**
   * GET /api/v1/stores/:id/categories
   * Obtener categorías de una tienda específica
   * Params: { id }
   * Redirige a: GET /api/categories?tiendaId=:id
   */
  router.get('/:id/categories', storeController.getCategories.bind(storeController));

  return router;
};