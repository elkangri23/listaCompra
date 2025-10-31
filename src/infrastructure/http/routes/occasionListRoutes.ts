/**
 * Rutas para funcionalidades de listas inteligentes por ocasión
 * Implementa CU-32: Listas Inteligentes por Ocasión
 */

import { Router } from 'express';
import { OccasionListController, OccasionListSchemas } from '../controllers/OccasionListController';

/**
 * Configura las rutas para listas por ocasión
 */
export function setupOccasionListRoutes(
  controller: OccasionListController
): Router {
  const router = Router();

  /**
   * @swagger
   * /api/occasion-lists/occasions:
   *   get:
   *     summary: Obtener ocasiones predefinidas
   *     description: Obtiene la lista de ocasiones predefinidas disponibles para generar listas automáticamente
   *     tags: [Occasion Lists]
   *     responses:
   *       200:
   *         description: Ocasiones obtenidas exitosamente
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/PredefinedOccasionsResponse'
   *             example:
   *               success: true
   *               data:
   *                 occasions: ["Barbacoa familiar", "Cena romántica", "Cumpleaños infantil"]
   *                 total: 20
   *               message: "Ocasiones predefinidas obtenidas exitosamente"
   *       500:
   *         description: Error interno del servidor
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/ErrorResponse'
   */
  router.get('/occasions', controller.getPredefinedOccasions);

  /**
   * @swagger
   * /api/occasion-lists/generate:
   *   post:
   *     summary: Generar lista inteligente por ocasión
   *     description: Utiliza IA para generar una lista de compras completa basada en una ocasión específica (CU-32)
   *     tags: [Occasion Lists]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateOccasionListRequest'
   *           examples:
   *             barbacoa:
   *               summary: Barbacoa familiar
   *               value:
   *                 occasion: "Barbacoa familiar"
   *                 numberOfPeople: 6
   *                 maxBudget: 80
   *                 dietaryRestrictions: []
   *                 additionalPreferences: "Preferimos productos frescos y locales"
   *             cena_romantica:
   *               summary: Cena romántica
   *               value:
   *                 occasion: "Cena romántica"
   *                 numberOfPeople: 2
   *                 maxBudget: 50
   *                 dietaryRestrictions: ["vegetariano"]
   *                 customListName: "Cena especial"
   *             cumpleanos:
   *               summary: Cumpleaños infantil
   *               value:
   *                 occasion: "Cumpleaños infantil"
   *                 numberOfPeople: 12
   *                 maxBudget: 100
   *                 additionalPreferences: "Incluir dulces y bebidas sin cafeína"
   *     responses:
   *       201:
   *         description: Lista generada exitosamente
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/OccasionListResponse'
   *             example:
   *               success: true
   *               data:
   *                 listId: "123e4567-e89b-12d3-a456-426614174000"
   *                 listName: "Barbacoa familiar (6 personas)"
   *                 occasionDescription: "Lista para Barbacoa familiar con 6 personas"
   *                 products:
   *                   - name: "Carne para asar"
   *                     quantity: 2
   *                     unit: "kg"
   *                     category: "Carnes"
   *                     estimatedPrice: 18.50
   *                     priority: 1
   *                     aiReason: "Esencial para barbacoa de 6 personas"
   *                     alternatives: ["Pollo", "Cerdo", "Pescado"]
   *                 summary:
   *                   totalProducts: 15
   *                   estimatedCost: 67.80
   *                   categoriesIncluded: ["Carnes", "Verduras", "Bebidas"]
   *                   restrictionsApplied: []
   *                 processingTime: 2350
   *                 aiConfidence: 87
   *               message: "Lista 'Barbacoa familiar (6 personas)' generada exitosamente con 15 productos"
   *       400:
   *         description: Datos de entrada inválidos
   *       401:
   *         description: No autorizado - Token requerido
   *       404:
   *         description: Recurso no encontrado (ej. tienda)
   *       429:
   *         description: Demasiadas solicitudes - Rate limit excedido
   *       500:
   *         description: Error interno del servidor
   */
  router.post('/generate', controller.generateOccasionList);

  /**
   * @swagger
   * /api/occasion-lists/preview:
   *   post:
   *     summary: Vista previa de lista por ocasión
   *     description: Genera una vista previa de productos sin crear la lista real (funcionalidad en desarrollo)
   *     tags: [Occasion Lists]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateOccasionListRequest'
   *           example:
   *             occasion: "Picnic en el parque"
   *             numberOfPeople: 4
   *             maxBudget: 30
   *             dietaryRestrictions: ["sin lactosa"]
   *     responses:
   *       200:
   *         description: Vista previa generada exitosamente
   *       400:
   *         description: Datos de entrada inválidos
   *       401:
   *         description: No autorizado
   *       500:
   *         description: Error interno del servidor
   */
  router.post('/preview', controller.previewOccasionList);

  return router;
}

/**
 * Schemas para Swagger/OpenAPI
 * Se exportan desde el controlador para mantener consistencia
 */
export { OccasionListSchemas };