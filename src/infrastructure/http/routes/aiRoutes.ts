/**
 * Rutas para funcionalidades de Inteligencia Artificial
 * Define los endpoints para categorización automática y análisis IA
 */

import { Router } from 'express';
import { createAuthMiddleware } from '../middlewares/authMiddleware';
import { validationMiddleware } from '../middlewares/validationMiddleware';
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

// Función factory para crear las rutas con dependencias
export function createAIRoutes(dependencies: {
  aiController: AIController;
  authMiddleware: ReturnType<typeof createAuthMiddleware>;
}) {
  const router = Router();
  const { aiController, authMiddleware } = dependencies;

  /**
   * POST /api/ai/category-suggestions
   * Obtener sugerencias de categorías para un producto
   */
  router.post('/category-suggestions',
    authMiddleware, // Verificar autenticación
    validationMiddleware(categorySuggestionsSchema), // Validar entrada
    aiController.suggestCategories.bind(aiController)
  );

  /**
   * GET /api/ai/health
   * Health check del servicio de IA
   */
  router.get('/health',
    aiController.healthCheck.bind(aiController)
  );

  /**
   * GET /api/ai/usage
   * Información de uso de la API de IA (solo administradores)
   */
  router.get('/usage',
    authMiddleware, // Verificar autenticación
    aiController.getUsageInfo.bind(aiController)
  );

  return router;
}

export { createAIRoutes as aiRoutes };