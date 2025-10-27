/**
 * Rutas para la gestión de productos
 */

import { Router, RequestHandler } from 'express';
import { ProductController } from '../controllers/ProductController';
import { validationMiddleware } from '../middlewares/validationMiddleware';
import { z } from 'zod';

// Esquemas de validación...
const addProductSchema = z.object({
  body: z.object({
    nombre: z.string()
      .min(1, 'El nombre es requerido')
      .max(200, 'El nombre no puede exceder 200 caracteres'),
    descripcion: z.string()
      .max(1000, 'La descripción no puede exceder 1000 caracteres')
      .optional(),
    cantidad: z.number()
      .int('La cantidad debe ser un número entero')
      .min(1, 'La cantidad mínima es 1')
      .max(999999, 'La cantidad máxima es 999,999')
      .optional(),
    unidad: z.string()
      .max(20, 'La unidad no puede exceder 20 caracteres')
      .optional(),
    precio: z.number()
      .min(0, 'El precio no puede ser negativo')
      .max(999999.99, 'El precio máximo es 999,999.99')
      .optional(),
    urgente: z.boolean().optional(),
    categoriaId: z.string().uuid('ID de categoría inválido').optional()
  }),
  params: z.object({
    listaId: z.string().uuid('ID de lista inválido')
  })
});

const updateProductSchema = z.object({
  body: z.object({
    nombre: z.string()
      .min(1, 'El nombre es requerido')
      .max(200, 'El nombre no puede exceder 200 caracteres')
      .optional(),
    descripcion: z.string()
      .max(1000, 'La descripción no puede exceder 1000 caracteres')
      .optional(),
    cantidad: z.number()
      .int('La cantidad debe ser un número entero')
      .min(1, 'La cantidad mínima es 1')
      .max(999999, 'La cantidad máxima es 999,999')
      .optional(),
    unidad: z.string()
      .max(20, 'La unidad no puede exceder 20 caracteres')
      .optional(),
    precio: z.number()
      .min(0, 'El precio no puede ser negativo')
      .max(999999.99, 'El precio máximo es 999,999.99')
      .optional(),
    urgente: z.boolean().optional(),
    categoriaId: z.string().uuid('ID de categoría inválido').optional()
  }),
  params: z.object({
    listaId: z.string().uuid('ID de lista inválido'),
    productId: z.string().uuid('ID de producto inválido')
  })
});

const markAsPurchasedSchema = z.object({
  body: z.object({
    comprado: z.boolean()
  }),
  params: z.object({
    listaId: z.string().uuid('ID de lista inválido'),
    productId: z.string().uuid('ID de producto inválido')
  })
});

const deleteProductSchema = z.object({
  params: z.object({
    listaId: z.string().uuid('ID de lista inválido'),
    productId: z.string().uuid('ID de producto inválido')
  })
});

const getProductsSchema = z.object({
  params: z.object({
    listaId: z.string().uuid('ID de lista inválido')
  }),
  query: z.object({
    comprado: z.enum(['true', 'false']).optional(),
    urgente: z.enum(['true', 'false']).optional(),
    categoriaId: z.string().uuid('ID de categoría inválido').optional(),
    busqueda: z.string().max(200, 'La búsqueda no puede exceder 200 caracteres').optional(),
    page: z.string().regex(/^\d+$/, 'La página debe ser un número').optional(),
    limit: z.string().regex(/^\d+$/, 'El límite debe ser un número').optional()
  }).optional()
});

export function createProductRoutes(
  productController: ProductController,
  authMiddleware: RequestHandler
): Router {
  const router = Router();

  /**
   * @swagger
   * /lists/{listaId}/products:
   *   post:
   *     summary: Añadir producto a una lista
   *     tags: [Products]
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
   *                 maxLength: 200
   *                 description: Nombre del producto
   *               descripcion:
   *                 type: string
   *                 maxLength: 1000
   *                 description: Descripción del producto
   *               cantidad:
   *                 type: integer
   *                 minimum: 1
   *                 maximum: 999999
   *                 description: Cantidad del producto
   *               unidad:
   *                 type: string
   *                 maxLength: 20
   *                 description: Unidad de medida
   *               precio:
   *                 type: number
   *                 minimum: 0
   *                 maximum: 999999.99
   *                 description: Precio del producto
   *               urgente:
   *                 type: boolean
   *                 description: Indica si el producto es urgente
   *               categoriaId:
   *                 type: string
   *                 format: uuid
   *                 description: ID de la categoría del producto
   *     responses:
   *       201:
   *         description: Producto añadido correctamente
   *       400:
   *         description: Datos inválidos
   *       403:
   *         description: Sin permisos para añadir productos a esta lista
   *       404:
   *         description: Lista no encontrada
   */
  router.post(
    '/:listaId/products',
    authMiddleware,
    validationMiddleware(addProductSchema),
    productController.addProductToList.bind(productController)
  );

  /**
   * @swagger
   * /lists/{listaId}/products/{productId}:
   *   put:
   *     summary: Actualizar un producto
   *     tags: [Products]
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
   *       - in: path
   *         name: productId
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: ID del producto
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               nombre:
   *                 type: string
   *                 maxLength: 200
   *               descripcion:
   *                 type: string
   *                 maxLength: 1000
   *               cantidad:
   *                 type: integer
   *                 minimum: 1
   *                 maximum: 999999
   *               unidad:
   *                 type: string
   *                 maxLength: 20
   *               precio:
   *                 type: number
   *                 minimum: 0
   *                 maximum: 999999.99
   *               urgente:
   *                 type: boolean
   *               categoriaId:
   *                 type: string
   *                 format: uuid
   *     responses:
   *       200:
   *         description: Producto actualizado correctamente
   *       400:
   *         description: Datos inválidos
   *       403:
   *         description: Sin permisos para actualizar este producto
   *       404:
   *         description: Producto no encontrado
   */
  router.put(
    '/:listaId/products/:productId',
    authMiddleware,
    validationMiddleware(updateProductSchema),
    productController.updateProductInList.bind(productController)
  );

  /**
   * @swagger
   * /lists/{listaId}/products/{productId}/purchased:
   *   patch:
   *     summary: Marcar/desmarcar producto como comprado
   *     tags: [Products]
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
   *       - in: path
   *         name: productId
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: ID del producto
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - comprado
   *             properties:
   *               comprado:
   *                 type: boolean
   *                 description: Estado de comprado a establecer
   *     responses:
   *       200:
   *         description: Estado del producto actualizado correctamente
   *       400:
   *         description: Datos inválidos
   *       403:
   *         description: Sin permisos para actualizar este producto
   *       404:
   *         description: Producto no encontrado
   */
  router.patch(
    '/:listaId/products/:productId/purchased',
    authMiddleware,
    validationMiddleware(markAsPurchasedSchema),
    productController.markProductAsPurchased.bind(productController)
  );

  /**
   * @swagger
   * /lists/{listaId}/products/{productId}:
   *   delete:
   *     summary: Eliminar un producto
   *     tags: [Products]
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
   *       - in: path
   *         name: productId
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: ID del producto
   *     responses:
   *       200:
   *         description: Producto eliminado correctamente
   *       403:
   *         description: Sin permisos para eliminar este producto
   *       404:
   *         description: Producto no encontrado
   */
  router.delete(
    '/:listaId/products/:productId',
    authMiddleware,
    validationMiddleware(deleteProductSchema),
    productController.deleteProductFromList.bind(productController)
  );

  /**
   * @swagger
   * /lists/{listaId}/products:
   *   get:
   *     summary: Obtener productos de una lista
   *     tags: [Products]
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
   *       - in: query
   *         name: comprado
   *         schema:
   *           type: string
   *           enum: [true, false]
   *         description: Filtrar por estado de comprado
   *       - in: query
   *         name: urgente
   *         schema:
   *           type: string
   *           enum: [true, false]
   *         description: Filtrar por productos urgentes
   *       - in: query
   *         name: categoriaId
   *         schema:
   *           type: string
   *           format: uuid
   *         description: Filtrar por categoría
   *       - in: query
   *         name: busqueda
   *         schema:
   *           type: string
   *           maxLength: 200
   *         description: Buscar por nombre o descripción
   *       - in: query
   *         name: page
   *         schema:
   *           type: string
   *           pattern: '^\\d+$'
   *         description: Número de página
   *       - in: query
   *         name: limit
   *         schema:
   *           type: string
   *           pattern: '^\\d+$'
   *         description: Elementos por página
   *     responses:
   *       200:
   *         description: Lista de productos obtenida correctamente
   *       400:
   *         description: Parámetros de consulta inválidos
   *       403:
   *         description: Sin permisos para ver los productos de esta lista
   *       404:
   *         description: Lista no encontrada
   */
  router.get(
    '/:listaId/products',
    authMiddleware,
    validationMiddleware(getProductsSchema),
    productController.getProductsFromList.bind(productController)
  );

  return router;
}