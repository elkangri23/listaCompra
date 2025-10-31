/**
 * Rutas de Recomendaciones de Productos
 * CU-33: Recomendaciones Contextuales Automáticas
 * 
 * @swagger
 * tags:
 *   name: Recommendations
 *   description: API de recomendaciones contextuales de productos con IA
 */

import { Router } from 'express';
import { Container } from '../../../composition/container';

const router = Router();
const container = Container.getInstance();
const recommendationsController = container.recommendationsController;
const authMiddleware = container.authMiddleware;

/**
 * @swagger
 * /api/recommendations/context-examples:
 *   get:
 *     summary: Obtener ejemplos de contextos para recomendaciones
 *     description: Devuelve ejemplos de contextos que pueden ser utilizados para mejorar la calidad de las recomendaciones generadas por IA
 *     tags: [Recommendations]
 *     responses:
 *       200:
 *         description: Lista de ejemplos de contexto
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
 *                     examples:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           context:
 *                             type: string
 *                             example: "Cena romántica para dos"
 *                           description:
 *                             type: string
 *                             example: "Recomendará productos premium y complementarios para una cena especial"
 *                           expectedProducts:
 *                             type: array
 *                             items:
 *                               type: string
 *                             example: ["vino", "velas", "postre", "queso", "pan artesanal"]
 *                     tips:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["Sé específico con el contexto para mejores resultados"]
 *       500:
 *         description: Error del servidor
 */
router.get(
  '/context-examples',
  (req, res) => recommendationsController.getContextExamples(req, res)
);

/**
 * @swagger
 * /api/recommendations/{listId}:
 *   get:
 *     summary: Obtener recomendaciones para una lista
 *     description: Genera sugerencias inteligentes de productos complementarios basándose en el contenido actual de la lista del usuario utilizando IA
 *     tags: [Recommendations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: listId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la lista de compras
 *       - in: query
 *         name: maxRecommendations
 *         schema:
 *           type: integer
 *           minimum: 5
 *           maximum: 50
 *           default: 10
 *         description: Número máximo de recomendaciones a generar
 *       - in: query
 *         name: creativityLevel
 *         schema:
 *           type: string
 *           enum: [conservative, balanced, creative]
 *           default: balanced
 *         description: |
 *           Nivel de creatividad de las sugerencias:
 *           - conservative: Solo productos muy relacionados
 *           - balanced: Mix de relacionados y exploración (recomendado)
 *           - creative: Incluye sugerencias más innovadoras
 *       - in: query
 *         name: categoryId
 *         schema:
 *           type: string
 *         description: Filtrar recomendaciones por categoría específica
 *       - in: query
 *         name: storeId
 *         schema:
 *           type: string
 *         description: Filtrar recomendaciones por tienda específica
 *       - in: query
 *         name: context
 *         schema:
 *           type: string
 *         description: Contexto adicional para mejorar recomendaciones (ej. "Cena romántica", "Desayuno saludable")
 *       - in: query
 *         name: includeUserHistory
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Incluir productos frecuentemente comprados por el usuario en el pasado
 *       - in: query
 *         name: excludeExisting
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Excluir productos que ya están en la lista actual
 *     responses:
 *       200:
 *         description: Recomendaciones generadas exitosamente
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
 *                     listId:
 *                       type: string
 *                       example: "uuid-lista-123"
 *                     recommendations:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           name:
 *                             type: string
 *                             example: "Salsa de tomate"
 *                           reason:
 *                             type: string
 *                             example: "Complementa bien con la pasta que agregaste"
 *                           confidenceScore:
 *                             type: number
 *                             example: 85
 *                             description: "Score de confianza (0-100)"
 *                           suggestedCategory:
 *                             type: object
 *                             properties:
 *                               id:
 *                                 type: string
 *                               name:
 *                                 type: string
 *                           estimatedPrice:
 *                             type: number
 *                             example: 2.5
 *                           suggestedQuantity:
 *                             type: number
 *                             example: 1
 *                           suggestedUnit:
 *                             type: string
 *                             example: "unidades"
 *                           relatedProducts:
 *                             type: array
 *                             items:
 *                               type: string
 *                             example: ["Pasta"]
 *                           tags:
 *                             type: array
 *                             items:
 *                               type: string
 *                             example: ["italiano", "básico"]
 *                           fromUserHistory:
 *                             type: boolean
 *                             example: false
 *                           recommendationType:
 *                             type: string
 *                             enum: [complement, frequently_together, category_match, user_preference]
 *                             example: "complement"
 *                     detectedContext:
 *                       type: string
 *                       example: "Comida italiana casual"
 *                     productsInList:
 *                       type: number
 *                       example: 5
 *                     metadata:
 *                       type: object
 *                       properties:
 *                         processingTime:
 *                           type: number
 *                           example: 1250
 *                           description: "Tiempo de procesamiento en milisegundos"
 *                         aiUsed:
 *                           type: boolean
 *                           example: true
 *                         algorithmVersion:
 *                           type: string
 *                           example: "1.0.0"
 *                         averageConfidence:
 *                           type: number
 *                           example: 82.5
 *                 _meta:
 *                   type: object
 *                   properties:
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                     processingTime:
 *                       type: number
 *       400:
 *         description: Error de validación o lista vacía
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "La lista está vacía. Añade al menos un producto para obtener recomendaciones."
 *       403:
 *         description: Sin permisos para acceder a la lista
 *       404:
 *         description: Lista no encontrada
 *       401:
 *         description: No autenticado
 *       500:
 *         description: Error del servidor
 */
router.get(
  '/:listId',
  authMiddleware,
  (req, res) => recommendationsController.getListRecommendations(req, res)
);

/**
 * @swagger
 * /api/recommendations/{listId}/for-product/{productId}:
 *   get:
 *     summary: Obtener recomendaciones basadas en un producto específico
 *     description: Genera sugerencias de productos complementarios enfocadas en un producto particular de la lista utilizando IA
 *     tags: [Recommendations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: listId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID de la lista de compras
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID del producto base para recomendaciones
 *       - in: query
 *         name: maxRecommendations
 *         schema:
 *           type: integer
 *           minimum: 5
 *           maximum: 50
 *           default: 10
 *         description: Número máximo de recomendaciones a generar
 *       - in: query
 *         name: creativityLevel
 *         schema:
 *           type: string
 *           enum: [conservative, balanced, creative]
 *           default: balanced
 *         description: Nivel de creatividad de las sugerencias
 *       - in: query
 *         name: categoryId
 *         schema:
 *           type: string
 *         description: Filtrar recomendaciones por categoría específica
 *       - in: query
 *         name: storeId
 *         schema:
 *           type: string
 *         description: Filtrar recomendaciones por tienda específica
 *       - in: query
 *         name: context
 *         schema:
 *           type: string
 *         description: Contexto adicional para las recomendaciones
 *       - in: query
 *         name: includeUserHistory
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Incluir historial del usuario
 *       - in: query
 *         name: excludeExisting
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Excluir productos ya en la lista
 *     responses:
 *       200:
 *         description: Recomendaciones generadas exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RecommendationsResponse'
 *       400:
 *         description: Error de validación
 *       403:
 *         description: Sin permisos
 *       404:
 *         description: Lista o producto no encontrado
 *       401:
 *         description: No autenticado
 *       500:
 *         description: Error del servidor
 */
router.get(
  '/:listId/for-product/:productId',
  authMiddleware,
  (req, res) => recommendationsController.getProductSpecificRecommendations(req, res)
);

export default router;
