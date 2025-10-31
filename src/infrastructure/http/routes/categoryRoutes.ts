/**
 * Rutas HTTP para la gestión de categorías
 * Define todos los endpoints REST para categorías
 */

import { Router } from 'express';
import type { CategoryController } from '@infrastructure/http/controllers/CategoryController';

export const createCategoryRoutes = (categoryController: CategoryController): Router => {
  const router = Router();

  /**
   * POST /api/categories
   * Crear una nueva categoría
   * Body: { nombre, descripcion?, color?, icono?, tiendaId? }
   */
  router.post('/', categoryController.create.bind(categoryController));

  /**
   * GET /api/categories
   * Obtener categorías con filtros opcionales
   * Query: ?tiendaId=string&activas=boolean&includeInactive=boolean
   */
  router.get('/', categoryController.getByStore.bind(categoryController));

  /**
   * PUT /api/categories/:id
   * Actualizar una categoría existente
   * Params: { id }
   * Body: { nombre?, descripcion?, color?, icono?, activa? }
   */
  router.put('/:id', categoryController.update.bind(categoryController));

  /**
   * DELETE /api/categories/:id
   * Eliminar una categoría
   * Params: { id }
   */
  router.delete('/:id', categoryController.delete.bind(categoryController));

  /**
   * PATCH /api/categories/:id/toggle-status
   * Cambiar el estado activo/inactivo de una categoría
   * Params: { id }
   * Body: { activa: boolean }
   */
  router.patch('/:id/toggle-status', categoryController.toggleStatus.bind(categoryController));

  /**
   * PUT /api/categories/:id/move-to-store
   * Mover una categoría a otra tienda
   * Params: { id }
   * Body: { tiendaId: string }
   */
  router.put('/:id/move-to-store', categoryController.moveToStore.bind(categoryController));

  return router;
};