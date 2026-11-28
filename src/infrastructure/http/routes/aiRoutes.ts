/**
 * Rutas para funcionalidades de Inteligencia Artificial
 * Define los endpoints para categorización automática y análisis IA
 */

import type { RequestHandler } from 'express';
import { Router } from 'express';
import { validationMiddleware } from '../middlewares/validationMiddleware';
import { aiStandardAdvancedRateLimit, aiPremiumAdvancedRateLimit } from '../middlewares/advancedRateLimitMiddleware';
import { requireAdmin } from '../middlewares/roleMiddleware';
import type { AIController } from '../controllers/AIController';
import type { AIConfigController } from '../controllers/AIConfigController';
import { z } from 'zod';

// Schema de validación para actualizar la configuración IA (admin)
const adminConfigSchema = z.object({
  body: z.object({
    provider: z.enum(['perplexity', 'openai', 'openrouter', 'claude', 'azure-openai'])
      .optional(),
    apiUrl: z.string().trim().url('La URL del API debe ser válida')
      .max(200, 'La URL no puede exceder 200 caracteres')
      .optional(),
    model: z.string().trim().min(1, 'El modelo es requerido')
      .max(100, 'El modelo no puede exceder 100 caracteres')
      .optional(),
    apiKey: z.string().trim().min(32, 'La API key debe tener al menos 32 caracteres')
      .max(500, 'La API key no puede exceder 500 caracteres')
      .optional(),
    temperature: z.number().min(0, 'La temperatura debe estar entre 0 y 1')
      .max(1, 'La temperatura debe estar entre 0 y 1')
      .optional(),
    maxTokens: z.number().int().min(1, 'maxTokens debe estar entre 1 y 4000')
      .max(4000, 'maxTokens debe estar entre 1 y 4000')
      .optional(),
  }),
});

// Schema de validación para probar la configuración IA (admin)
const testConfigSchema = z.object({
  body: z.object({
    apiKey: z.string().trim().min(32).max(500).optional(),
  }),
});

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
  aiConfigController?: AIConfigController;
  authMiddleware: RequestHandler;
}) {
  const router = Router();
  const { aiController, aiConfigController, authMiddleware } = dependencies;

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
   *       - Personalización: si el usuario autenticado ya categorizó productos
   *         parecidos, la sugerencia sigue su criterio (personalized, examplesUsed)
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
   *                   personalized: true
   *                   examplesUsed: 2
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
    aiStandardAdvancedRateLimit, // Rate limiting por usuario IA estándar
    authMiddleware, // Verificar autenticación
    validationMiddleware(categorySuggestionsSchema), // Validar entrada
    aiController.suggestCategories.bind(aiController)
  );

  /**
   * @swagger
   * /api/v1/ai/purchase-habits/{userId}:
   *   get:
   *     tags: [Inteligencia Artificial]
   *     summary: Análisis de hábitos de compra (CU-30)
   *     description: |
   *       Analiza el historial de compras del usuario (productos comprados en sus
   *       listas) y devuelve insights de IA: frecuencia, estacionalidad,
   *       preferencias y optimización.
   *       Cada usuario solo puede analizar sus propios hábitos (los admins pueden analizar a cualquiera).
   *     operationId: aiPurchaseHabits
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: userId
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: ID del usuario a analizar (debe ser el propio usuario)
   *       - in: query
   *         name: timeRange
   *         required: false
   *         schema:
   *           type: string
   *           enum: [30d, 90d, 365d, all]
   *           default: 90d
   *         description: Rango temporal del análisis
   *     responses:
   *       200:
   *         description: Análisis generado exitosamente
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
   *                     insights:
   *                       type: array
   *                       items:
   *                         type: object
   *                         properties:
   *                           type:
   *                             type: string
   *                             enum: [frequency, seasonal, preference, optimization]
   *                           title:
   *                             type: string
   *                           description:
   *                             type: string
   *                           confidence:
   *                             type: number
   *                             minimum: 0
   *                             maximum: 1
   *                     metadata:
   *                       type: object
   *                       properties:
   *                         period:
   *                           type: object
   *                         productsAnalyzed:
   *                           type: number
   *                         listsAnalyzed:
   *                           type: number
   *                         generatedAt:
   *                           type: string
   *                           format: date-time
   *       400:
   *         description: Parámetros inválidos (userId no UUID, timeRange no soportado)
   *       403:
   *         description: Intento de analizar los hábitos de otro usuario
   *       404:
   *         description: Usuario no encontrado
   *       503:
   *         description: Servicio de análisis no disponible
   */
  router.get('/purchase-habits/:userId',
    aiStandardAdvancedRateLimit, // Rate limiting por usuario IA estándar
    authMiddleware,
    aiController.analyzePurchaseHabits.bind(aiController)
  );

  /**
   * @swagger
   * /api/v1/ai/health:
   *   get:
   *     tags: [Inteligencia Artificial]
   *     summary: Health check del servicio de IA
   *     description: |
   *       Comprueba de verdad el proveedor IA configurado con una
   *       completion mínima (ping, max_tokens 1). El resultado se cachea
   *       en memoria 60 s: las llamadas dentro de ese plazo sirven el
   *       resultado cacheado (campo `cached: true`) sin volver a llamar
   *       al proveedor. Si el proveedor no está configurado o falla, el
   *       estado es `degraded` con un `reason` corto (`NOT_CONFIGURED` o
   *       `PROVIDER_ERROR`). Ruta pública (sin autenticación).
   *     operationId: aiHealthCheck
   *     security: []
   *     responses:
   *       200:
   *         description: Resultado de la comprobación (healthy o degraded)
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
   *                     status:
   *                       type: string
   *                       enum: [healthy, degraded]
   *                       description: Estado general del servicio
   *                     provider:
   *                       type: string
   *                       example: freellmapi
   *                     model:
   *                       type: string
   *                       example: qwen3.8-27b
   *                     latencyMs:
   *                       type: number
   *                       nullable: true
   *                       description: Latencia del ping en ms (null si no se pudo comprobar)
   *                     reason:
   *                       type: string
   *                       enum: [NOT_CONFIGURED, PROVIDER_ERROR]
   *                       description: Motivo del estado degraded (ausente si healthy)
   *                     checkedAt:
   *                       type: string
   *                       format: date-time
   *                       description: Cuándo se hizo la comprobación real
   *                     cached:
   *                       type: boolean
   *                       description: true si el resultado viene de la caché de 60 s
   *             examples:
   *               servicio_saludable:
   *                 summary: Proveedor responde
   *                 value:
   *                   success: true
   *                   data:
   *                     status: healthy
   *                     provider: freellmapi
   *                     model: qwen3.8-27b
   *                     latencyMs: 245
   *                     checkedAt: 2026-11-28T10:30:00Z
   *                     cached: false
   *               servicio_degradado:
   *                 summary: Proveedor no responde
   *                 value:
   *                   success: true
   *                   data:
   *                     status: degraded
   *                     provider: freellmapi
   *                     model: qwen3.8-27b
   *                     latencyMs: null
   *                     reason: PROVIDER_ERROR
   *                     checkedAt: 2026-11-28T10:30:00Z
   *                     cached: false
   *       503:
   *         description: Error interno inesperado en el health check
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
   *                   example: Servicio de IA no disponible
   *                 code:
   *                   type: string
   *                   example: SERVICE_UNAVAILABLE
   */

  router.get('/health',
    aiController.healthCheck.bind(aiController)
  );

  /**
   * @swagger
   * /api/v1/ai/usage:
   *   get:
   *     tags: [Inteligencia Artificial]
   *     summary: Uso real de la API de IA (panel admin, fase 3)
   *     description: |
   *       Agregados reales de uso de IA a partir de la tabla
   *       `ai_usage_events` (un evento por llamada real al modelo):
   *       hoy y últimos 7 días por día. Sin eventos, todo a cero con
   *       `avgLatencyMs: null`, `cachedPercentage: null` y
   *       `hasData: false`; nunca se devuelven valores inventados.
   *
   *       **Acceso:** Solo administradores
   *     operationId: getAIUsageInfo
   *     responses:
   *       200:
   *         description: Agregados reales de uso de IA
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
   *                     provider:
   *                       type: string
   *                       example: freellmapi
   *                     model:
   *                       type: string
   *                       example: qwen3.8-27b
   *                     today:
   *                       type: object
   *                       properties:
   *                         total:
   *                           type: integer
   *                         byOperation:
   *                           type: object
   *                           properties:
   *                             category-suggestions:
   *                               type: integer
   *                             bulk-categorize:
   *                               type: integer
   *                             config-test:
   *                               type: integer
   *                         success:
   *                           type: integer
   *                         failed:
   *                           type: integer
   *                         avgLatencyMs:
   *                           type: integer
   *                           nullable: true
   *                         cached:
   *                           type: integer
   *                         cachedPercentage:
   *                           type: integer
   *                           nullable: true
   *                           description: 0-100, null si total es 0
   *                     last7Days:
   *                       type: array
   *                       description: 7 entradas, de más antiguo a más reciente, incluyendo hoy
   *                       items:
   *                         type: object
   *                         properties:
   *                           date:
   *                             type: string
   *                             example: 2026-11-28
   *                           total:
   *                             type: integer
   *                           success:
   *                             type: integer
   *                           failed:
   *                             type: integer
   *                           byOperation:
   *                             type: object
   *                     hasData:
   *                       type: boolean
   *             example:
   *               success: true
   *               data:
   *                 provider: freellmapi
   *                 model: qwen3.8-27b
   *                 today:
   *                   total: 12
   *                   byOperation:
   *                     category-suggestions: 9
   *                     bulk-categorize: 2
   *                     config-test: 1
   *                   success: 11
   *                   failed: 1
   *                   avgLatencyMs: 842
   *                   cached: 3
   *                   cachedPercentage: 25
   *                 last7Days:
   *                   - date: 2026-11-22
   *                     total: 4
   *                     success: 4
   *                     failed: 0
   *                     byOperation:
   *                       category-suggestions: 4
   *                       bulk-categorize: 0
   *                       config-test: 0
   *                 hasData: true
   *       401:
   *         $ref: '#/components/responses/UnauthorizedError'
   *       403:
   *         $ref: '#/components/responses/ForbiddenError'
   *       429:
   *         $ref: '#/components/responses/RateLimitError'
   *       503:
   *         description: Seguimiento de uso aún no disponible (solo si el caso de uso no está cableado)
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
   *                   example: El seguimiento de uso de IA aún no está disponible.
   *                 code:
   *                   type: string
   *                   example: AI_USAGE_NOT_AVAILABLE
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
    aiPremiumAdvancedRateLimit, // Rate limiting IA premium: operaciones costosas
    authMiddleware, // Verificar autenticación
    validationMiddleware(bulkCategorizationSchema),
    aiController.bulkCategorize.bind(aiController)
  );

  router.get('/usage',
    aiPremiumAdvancedRateLimit, // Rate limiting diario más estricto para bulk ops
    authMiddleware, // Verificar autenticación
    (req, res, next) => requireAdmin(req as any, res, next), // Solo administradores
    aiController.getUsageInfo.bind(aiController)
  );

  //
  // Administración de la configuración IA (CU-31: selección de proveedor LLM)
  // Solo administradores.
  //
  if (aiConfigController) {
    router.get('/admin/config',
      authMiddleware,
      (req, res, next) => requireAdmin(req as any, res, next),
      aiConfigController.getConfig.bind(aiConfigController)
    );

    router.put('/admin/config',
      authMiddleware,
      (req, res, next) => requireAdmin(req as any, res, next),
      validationMiddleware(adminConfigSchema),
      aiConfigController.updateConfig.bind(aiConfigController)
    );

    router.post('/admin/config/test',
      authMiddleware,
      (req, res, next) => requireAdmin(req as any, res, next),
      validationMiddleware(testConfigSchema),
      aiConfigController.testConfig.bind(aiConfigController)
    );
  }

  return router;
}

export { createAIRoutes as aiRoutes };