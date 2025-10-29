import { Router } from 'express';
import { CacheIntegrityController } from '../controllers/CacheIntegrityController';
import { authMiddleware } from '../middlewares/authMiddleware';
import { roleMiddleware } from '../middlewares/roleMiddleware';
import { rateLimitMiddleware } from '../middlewares/rateLimitMiddleware';

/**
 * Rutas para monitoreo y gestión de integridad de cache
 * Requiere privilegios de administrador
 */
export function createCacheIntegrityRoutes(
  integrityController: CacheIntegrityController
): Router {
  const router = Router();

  // Middleware común: autenticación + rol admin + rate limiting
  const adminOnly = [
    authMiddleware,
    roleMiddleware(['admin']),
    rateLimitMiddleware({
      windowMs: 5 * 60 * 1000, // 5 minutos
      max: 20, // 20 requests por ventana
      message: 'Demasiadas solicitudes a endpoints de integridad'
    })
  ];

  /**
   * @swagger
   * /api/v1/admin/cache/integrity/scan:
   *   get:
   *     summary: Escanea integridad de datos en cache
   *     tags: [Admin, Cache Integrity]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: pattern
   *         schema:
   *           type: string
   *           default: "*"
   *         description: Patrón para filtrar claves
   *       - in: query
   *         name: dataType
   *         schema:
   *           type: string
   *           enum: [ai_suggestion, user_session, blueprint_metadata, category_cache, product_analytics]
   *         description: Tipo de datos a validar
   *     responses:
   *       200:
   *         description: Escaneo completado exitosamente
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 scan:
   *                   type: object
   *                   properties:
   *                     timestamp:
   *                       type: string
   *                       format: date-time
   *                     pattern:
   *                       type: string
   *                     dataType:
   *                       type: string
   *                     results:
   *                       type: array
   *                       items:
   *                         type: object
   *                         properties:
   *                           key:
   *                             type: string
   *                           dataType:
   *                             type: string
   *                           isValid:
   *                             type: boolean
   *                           corruptionLevel:
   *                             type: string
   *                             enum: [NONE, MINOR, SEVERE, CRITICAL]
   *                           details:
   *                             type: string
   *                 statistics:
   *                   type: object
   *                   properties:
   *                     total:
   *                       type: number
   *                     valid:
   *                       type: number
   *                     corrupted:
   *                       type: number
   *                     byCorruptionLevel:
   *                       type: object
   *                     byDataType:
   *                       type: object
   *                 recommendations:
   *                   type: array
   *                   items:
   *                     type: string
   *       401:
   *         description: No autorizado
   *       403:
   *         description: Acceso denegado - Solo administradores
   *       429:
   *         description: Demasiadas solicitudes
   *       500:
   *         description: Error interno del servidor
   */
  router.get('/scan', adminOnly, integrityController.scanIntegrity);

  /**
   * @swagger
   * /api/v1/admin/cache/integrity/validate:
   *   post:
   *     summary: Valida integridad de una clave específica
   *     tags: [Admin, Cache Integrity]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - key
   *               - dataType
   *             properties:
   *               key:
   *                 type: string
   *                 description: Clave a validar
   *               dataType:
   *                 type: string
   *                 enum: [ai_suggestion, user_session, blueprint_metadata, category_cache, product_analytics]
   *                 description: Tipo de datos
   *     responses:
   *       200:
   *         description: Validación completada
   *       400:
   *         description: Parámetros inválidos o clave no encontrada
   *       401:
   *         description: No autorizado
   *       403:
   *         description: Acceso denegado
   *       500:
   *         description: Error interno del servidor
   */
  router.post('/validate', adminOnly, integrityController.validateKey);

  /**
   * @swagger
   * /api/v1/admin/cache/integrity/cleanup:
   *   delete:
   *     summary: Limpia datos corruptos del cache
   *     tags: [Admin, Cache Integrity]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               pattern:
   *                 type: string
   *                 default: "*"
   *                 description: Patrón para filtrar claves
   *               dataType:
   *                 type: string
   *                 enum: [ai_suggestion, user_session, blueprint_metadata, category_cache, product_analytics]
   *                 description: Tipo de datos a limpiar
   *               dryRun:
   *                 type: boolean
   *                 default: true
   *                 description: Si es true, solo simula la limpieza
   *     responses:
   *       200:
   *         description: Limpieza completada o simulada
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 message:
   *                   type: string
   *                 cleaned:
   *                   type: number
   *                 dryRun:
   *                   type: boolean
   *                 cleanedKeys:
   *                   type: array
   *                   items:
   *                     type: string
   *       401:
   *         description: No autorizado
   *       403:
   *         description: Acceso denegado
   *       500:
   *         description: Error interno del servidor
   */
  router.delete('/cleanup', adminOnly, integrityController.cleanupCorrupted);

  /**
   * @swagger
   * /api/v1/admin/cache/integrity/stats:
   *   get:
   *     summary: Obtiene estadísticas de integridad de cache
   *     tags: [Admin, Cache Integrity]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Estadísticas obtenidas exitosamente
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 integrity:
   *                   type: object
   *                   properties:
   *                     total:
   *                       type: number
   *                     valid:
   *                       type: number
   *                     corrupted:
   *                       type: number
   *                     byCorruptionLevel:
   *                       type: object
   *                     byDataType:
   *                       type: object
   *                 cache:
   *                   type: object
   *                   properties:
   *                     totalKeys:
   *                       type: number
   *                     memoryInfo:
   *                       type: object
   *                     timestamp:
   *                       type: string
   *                       format: date-time
   *                 health:
   *                   type: object
   *                   properties:
   *                     status:
   *                       type: string
   *                       enum: [healthy, warning, critical]
   *                     corruptionRate:
   *                       type: number
   *                     recommendation:
   *                       type: string
   *       401:
   *         description: No autorizado
   *       403:
   *         description: Acceso denegado
   *       500:
   *         description: Error interno del servidor
   */
  router.get('/stats', adminOnly, integrityController.getIntegrityStats);

  /**
   * @swagger
   * /api/v1/admin/cache/integrity/repair:
   *   post:
   *     summary: Repara integridad de claves específicas
   *     tags: [Admin, Cache Integrity]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - keys
   *               - dataType
   *             properties:
   *               keys:
   *                 type: array
   *                 items:
   *                   type: string
   *                 description: Array de claves a reparar
   *               dataType:
   *                 type: string
   *                 enum: [ai_suggestion, user_session, blueprint_metadata, category_cache, product_analytics]
   *                 description: Tipo de datos
   *     responses:
   *       200:
   *         description: Reparación completada
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                 repair:
   *                   type: object
   *                   properties:
   *                     requested:
   *                       type: number
   *                     repaired:
   *                       type: number
   *                     failed:
   *                       type: number
   *                     repairedKeys:
   *                       type: array
   *                       items:
   *                         type: string
   *                     failedKeys:
   *                       type: array
   *                       items:
   *                         type: object
   *                         properties:
   *                           key:
   *                             type: string
   *                           error:
   *                             type: string
   *       400:
   *         description: Parámetros inválidos
   *       401:
   *         description: No autorizado
   *       403:
   *         description: Acceso denegado
   *       500:
   *         description: Error interno del servidor
   */
  router.post('/repair', adminOnly, integrityController.repairIntegrity);

  return router;
}