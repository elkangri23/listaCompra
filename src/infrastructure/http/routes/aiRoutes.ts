/**
 * Rutas para funcionalidades de Inteligencia Artificial
 * Define los endpoints para categorización automática y análisis IA
 */

import { Router, RequestHandler } from 'express';
import { validationMiddleware } from '../middlewares/validationMiddleware';
import { aiRateLimitPerUser, aiRateLimitStrict } from '../middlewares/rateLimitMiddleware';
import { requireAdmin } from '../middlewares/roleMiddleware';
import { AIController } from '../controllers/AIController';
import { z } from 'zod';

// Schema de validación para sugerencias de categorías
const categorySuggestionsSchema = z.object({
  body: z.object({
    productName: z.string()
      .trim()
      .min(1, 'El nombre del producto es requerido')
      .max(100, 'El nombre del producto no puede exceder 100 caracteres'),
    storeName: z.string()
      .trim()
      .max(50, 'El nombre de la tienda no puede exceder 50 caracteres')
      .optional(),
    existingCategories: z.array(z.string().trim())
      .max(20, 'No se pueden enviar más de 20 categorías existentes')
      .optional(),
    language: z.enum(['es', 'en'])
      .default('es')
      .optional()
  })
});

// Schema de validación para categorización masiva (CU-29)
const bulkCategorizationSchema = z.object({
  body: z.object({
    products: z.array(z.object({
      nombre: z.string()
        .trim()
        .min(1, 'El nombre del producto no puede estar vacío')
        .max(100, 'El nombre del producto no puede exceder 100 caracteres'),
      descripcion: z.string()
        .trim()
        .max(500, 'La descripción no puede exceder 500 caracteres')
        .optional()
    }))
      .min(1, 'Se requiere al menos 1 producto')
      .max(50, 'Máximo 50 productos por batch'),
    tiendaId: z.string()
      .trim()
      .uuid('tiendaId debe ser un UUID válido')
      .optional(),
    enrichWithExistingCategories: z.boolean()
      .optional()
  })
});

// Función factory para crear las rutas con dependencias
export function createAIRoutes(dependencies: {
  aiController: AIController;
  authMiddleware: RequestHandler;
}) {
  const router = Router();
  const { aiController, authMiddleware } = dependencies;

  /**
   * @swagger
   * /api/v1/ai/category-suggestions:
   *   post:
   *     tags: [Inteligencia Artificial]
   *     summary: Obtener sugerencias de categorías
   *     description: |
   *       Utiliza IA (Perplexity API con Llama 3.1 Sonar) para sugerir categorías apropiadas 
   *       para un producto específico. Incluye cache inteligente para optimizar costos.
   *       
   *       **Características:**
   *       - Rate limiting: 10 req/min por usuario
   *       - Cache Redis con TTL de 24h para categorías
   *       - Filtrado automático por confianza >= 0.7
   *       - Normalización Unicode para caracteres especiales
   *     operationId: suggestCategories
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - productName
   *             properties:
   *               productName:
   *                 type: string
   *                 minLength: 1
   *                 maxLength: 100
   *                 description: Nombre del producto para categorizar
   *                 example: Leche entera Puleva 1L
   *               storeName:
   *                 type: string
   *                 maxLength: 50
   *                 description: Nombre de la tienda (opcional, mejora la precisión)
   *                 example: Mercadona
   *               existingCategories:
   *                 type: array
   *                 items:
   *                   type: string
   *                 maxItems: 20
   *                 description: Categorías existentes para contexto (opcional)
   *                 example: ["Lácteos", "Bebidas", "Alimentación"]
   *               language:
   *                 type: string
   *                 enum: [es, en]
   *                 default: es
   *                 description: Idioma para las sugerencias
   *           examples:
   *             producto_basico:
   *               summary: Producto básico
   *               value:
   *                 productName: Leche entera
   *             producto_con_contexto:
   *               summary: Con contexto de tienda
   *               value:
   *                 productName: Pan integral
   *                 storeName: Mercadona
   *                 existingCategories: ["Panadería", "Cereales"]
   *             producto_internacional:
   *               summary: En inglés
   *               value:
   *                 productName: Organic milk
   *                 language: en
   *     responses:
   *       200:
   *         description: Sugerencias generadas exitosamente
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/AIResponse'
   *             examples:
   *               respuesta_exitosa:
   *                 summary: Respuesta típica
   *                 value:
   *                   requestId: req_abc123def456
   *                   productName: Leche entera
   *                   suggestions:
   *                     - categoria: Lácteos
   *                       confianza: 0.95
   *                       razon: Producto lácteo típico
   *                     - categoria: Bebidas
   *                       confianza: 0.80
   *                       razon: Las bebidas lácteas se clasifican como bebidas
   *                   cached: false
   *                   timestamp: 2024-10-29T10:30:00Z
   *               respuesta_cache:
   *                 summary: Respuesta desde cache
   *                 value:
   *                   requestId: req_cached_789
   *                   productName: Pan integral
   *                   suggestions:
   *                     - categoria: Panadería
   *                       confianza: 0.98
   *                       razon: Producto de panadería típico
   *                   cached: true
   *                   timestamp: 2024-10-29T10:30:00Z
   *       400:
   *         $ref: '#/components/responses/ValidationError'
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       429:
   *         description: Rate limit de IA excedido
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *             example:
   *               error: Rate limit de IA excedido. Máximo 10 requests por minuto.
   *               timestamp: 2024-10-29T10:30:00Z
   *       500:
   *         $ref: '#/components/responses/InternalServerError'
   *       503:
   *         description: Servicio de IA no disponible
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *             example:
   *               error: Servicio de IA temporalmente no disponible
   *               timestamp: 2024-10-29T10:30:00Z
   */
  router.post('/category-suggestions',
    aiRateLimitPerUser, // Rate limiting por usuario
    authMiddleware, // Verificar autenticación
    validationMiddleware(categorySuggestionsSchema), // Validar entrada
    aiController.suggestCategories.bind(aiController)
  );

  /**
   * @swagger
   * /api/v1/ai/health:
   *   get:
   *     tags: [Inteligencia Artificial]
   *     summary: Health check del servicio de IA
   *     description: |
   *       Verifica el estado de salud del servicio de IA, incluyendo conectividad 
   *       con Perplexity API y estado del cache Redis.
   *     operationId: aiHealthCheck
   *     security: []
   *     responses:
   *       200:
   *         description: Servicio de IA saludable
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 status:
   *                   type: string
   *                   enum: [healthy, degraded, unhealthy]
   *                   description: Estado general del servicio
   *                 timestamp:
   *                   type: string
   *                   format: date-time
   *                   description: Timestamp del health check
   *                 services:
   *                   type: object
   *                   properties:
   *                     perplexityAPI:
   *                       type: object
   *                       properties:
   *                         status:
   *                           type: string
   *                           enum: [connected, disconnected, error]
   *                         responseTime:
   *                           type: number
   *                           description: Tiempo de respuesta en ms
   *                     redisCache:
   *                       type: object
   *                       properties:
   *                         status:
   *                           type: string
   *                           enum: [connected, disconnected, error]
   *                         hitRatio:
   *                           type: number
   *                           description: Ratio de cache hits
   *                 uptime:
   *                   type: number
   *                   description: Tiempo de actividad en segundos
   *             examples:
   *               servicio_saludable:
   *                 summary: Todo funcionando
   *                 value:
   *                   status: healthy
   *                   timestamp: 2024-10-29T10:30:00Z
   *                   services:
   *                     perplexityAPI:
   *                       status: connected
   *                       responseTime: 245
   *                     redisCache:
   *                       status: connected
   *                       hitRatio: 0.85
   *                   uptime: 3600
   *               servicio_degradado:
   *                 summary: Cache desconectado
   *                 value:
   *                   status: degraded
   *                   timestamp: 2024-10-29T10:30:00Z
   *                   services:
   *                     perplexityAPI:
   *                       status: connected
   *                       responseTime: 180
   *                     redisCache:
   *                       status: disconnected
   *                       hitRatio: 0
   *                   uptime: 1800
   *       503:
   *         description: Servicio de IA no disponible
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 status:
   *                   type: string
   *                   example: unhealthy
   *                 error:
   *                   type: string
   *                   example: No se puede conectar con el servicio de IA
   *                 timestamp:
   *                   type: string
   *                   format: date-time
   */
  router.get('/health',
    aiController.healthCheck.bind(aiController)
  );

  /**
   * @swagger
   * /api/v1/ai/usage:
   *   get:
   *     tags: [Inteligencia Artificial]
   *     summary: Información de uso de la API de IA
   *     description: |
   *       Devuelve estadísticas detalladas de uso de la API de IA, incluyendo 
   *       tokens consumidos, requests realizados y costos estimados.
   *       
   *       **Acceso:** Solo administradores
   *     operationId: getAIUsageInfo
   *     responses:
   *       200:
   *         description: Información de uso obtenida exitosamente
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 period:
   *                   type: object
   *                   properties:
   *                     from:
   *                       type: string
   *                       format: date-time
   *                       description: Inicio del período
   *                     to:
   *                       type: string
   *                       format: date-time
   *                       description: Fin del período
   *                 usage:
   *                   type: object
   *                   properties:
   *                     totalRequests:
   *                       type: number
   *                       description: Total de requests realizados
   *                     successfulRequests:
   *                       type: number
   *                       description: Requests exitosos
   *                     failedRequests:
   *                       type: number
   *                       description: Requests fallidos
   *                     tokensUsed:
   *                       type: number
   *                       description: Tokens consumidos total
   *                     averageTokensPerRequest:
   *                       type: number
   *                       description: Promedio de tokens por request
   *                 costs:
   *                   type: object
   *                   properties:
   *                     estimatedCost:
   *                       type: number
   *                       format: float
   *                       description: Costo estimado en USD
   *                     costPerRequest:
   *                       type: number
   *                       format: float
   *                       description: Costo promedio por request
   *                 cache:
   *                   type: object
   *                   properties:
   *                     hitRatio:
   *                       type: number
   *                       format: float
   *                       description: Ratio de cache hits
   *                     savedRequests:
   *                       type: number
   *                       description: Requests ahorrados por cache
   *                     estimatedSavings:
   *                       type: number
   *                       format: float
   *                       description: Ahorros estimados por cache en USD
   *                 topUsers:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       userId:
   *                         type: string
   *                         format: uuid
   *                       email:
   *                         type: string
   *                       requests:
   *                         type: number
   *                       tokensUsed:
   *                         type: number
   *                   description: Usuarios con mayor uso
   *             example:
   *               period:
   *                 from: 2024-10-22T00:00:00Z
   *                 to: 2024-10-29T23:59:59Z
   *               usage:
   *                 totalRequests: 1250
   *                 successfulRequests: 1180
   *                 failedRequests: 70
   *                 tokensUsed: 45000
   *                 averageTokensPerRequest: 38.1
   *               costs:
   *                 estimatedCost: 2.25
   *                 costPerRequest: 0.0019
   *               cache:
   *                 hitRatio: 0.72
   *                 savedRequests: 900
   *                 estimatedSavings: 1.71
   *               topUsers:
   *                 - userId: 550e8400-e29b-41d4-a716-446655440000
   *                   email: juan@ejemplo.com
   *                   requests: 89
   *                   tokensUsed: 3200
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       429:
   *         $ref: '#/components/responses/RateLimitError'
   *       500:
   *         $ref: '#/components/responses/InternalServerError'
   */

  /**
   * @swagger
   * /api/v1/ai/bulk-categorize:
   *   post:
   *     tags: [Inteligencia Artificial]
   *     summary: Categorización masiva de productos (CU-29)
   *     description: Categoriza múltiples productos en lote con IA
   *     operationId: bulkCategorizeProducts
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - products
   *             properties:
   *               products:
   *                 type: array
   *                 minItems: 1
   *                 maxItems: 50
   *                 items:
   *                   type: object
   *                   required:
   *                     - nombre
   *                   properties:
   *                     nombre:
   *                       type: string
   *                       example: Leche entera Pascual 1L
   *                     descripcion:
   *                       type: string
   *                       example: Leche pasteurizada botella 1L
   *               tiendaId:
   *                 type: string
   *                 format: uuid
   *               enrichWithExistingCategories:
   *                 type: boolean
   *                 default: true
   *     responses:
   *       200:
   *         description: Categorización completada
   *       207:
   *         description: Categorización parcial (algunos productos fallaron)
   *       400:
   *         $ref: '#/components/responses/ValidationError'
   *       429:
   *         description: Rate limit excedido (5 req/hora)
   */
  router.post('/bulk-categorize',
    aiRateLimitStrict, // Rate limiting: 5 req/hora
    authMiddleware, // Verificar autenticación
    validationMiddleware(bulkCategorizationSchema),
    aiController.bulkCategorize.bind(aiController)
  );

  router.get('/usage',
    aiRateLimitStrict, // Rate limiting diario más estricto
    authMiddleware, // Verificar autenticación
    (req, res, next) => requireAdmin(req as any, res, next), // Solo administradores
    aiController.getUsageInfo.bind(aiController)
  );

  return router;
}

export { createAIRoutes as aiRoutes };