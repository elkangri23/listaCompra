/**
 * Controlador para funcionalidades de Inteligencia Artificial
 * Maneja endpoints relacionados con categorización automática y análisis IA
 */

import type { Response } from 'express';
import type { AuthenticatedRequest } from '../types/express';
import type { GetCategorySuggestionsUseCase } from '../../../application/use-cases/ai/GetCategorySuggestions';
import type { BulkCategorizeProducts } from '../../../application/use-cases/ai/BulkCategorizeProducts';
import type {
  AnalyzePurchaseHabitsUseCase
} from '../../../application/use-cases/ai/AnalyzePurchaseHabits';
import {
  validateAnalyzePurchaseHabitsDto,
  TIME_RANGE_PRESETS
} from '../../../application/dto/ai/AnalyzePurchaseHabitsDto';
import type { GetCategorySuggestionsDto } from '../../../application/dto/ai/AIDto';
import { 
  BulkCategorizeProductsDtoFactory 
} from '../../../application/dto/ai/BulkCategorizeProductsDto';
import { ValidationError } from '../../../application/errors/ValidationError';
import { Logger } from '../../observability/logger/Logger';

export class AIController {
  private readonly logger = new Logger('AIController');

  constructor(
    private readonly getCategorySuggestionsUseCase?: GetCategorySuggestionsUseCase,
    private readonly bulkCategorizeProductsUseCase?: BulkCategorizeProducts,
    private readonly analyzePurchaseHabitsUseCase?: AnalyzePurchaseHabitsUseCase
  ) {}

  /**
   * GET /api/v1/ai/purchase-habits/:userId (CU-30)
   * Analiza los hábitos de compra del usuario autenticado.
   * Query: ?timeRange=30d|90d|365d|all
   */
  async analyzePurchaseHabits(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const requesterId = req.user?.userId ?? req.user?.id ?? '';
      const requesterRol = req.user?.rol ?? req.user?.role;

      this.logger.http('Solicitud de análisis de hábitos de compra', {
        requesterId,
        targetUserId: req.params['userId'],
        timeRange: req.query['timeRange']
      });

      if (!requesterId) {
        res.status(401).json({ success: false, error: 'Usuario no autenticado' });
        return;
      }

      if (!this.analyzePurchaseHabitsUseCase) {
        res.status(503).json({
          success: false,
          error: 'Servicio de análisis de hábitos no disponible',
          code: 'HABITS_SERVICE_UNAVAILABLE'
        });
        return;
      }

      // Validación de entrada (userId UUID + preset de rango temporal)
      let dto;
      try {
        dto = validateAnalyzePurchaseHabitsDto({
          userId: req.params['userId'],
          timeRange: req.query['timeRange'] ?? '90d'
        });
      } catch (validationError) {
        res.status(400).json({
          success: false,
          error: validationError instanceof Error ? validationError.message : 'Parámetros inválidos',
          code: 'VALIDATION_ERROR',
          allowedTimeRanges: TIME_RANGE_PRESETS
        });
        return;
      }

      const result = await this.analyzePurchaseHabitsUseCase.execute(dto, requesterId, requesterRol);

      if (result.isFailure) {
        const error = result.error;
        const status = error.constructor.name === 'NotFoundError' ? 404
          : error.constructor.name === 'UnauthorizedError' ? 403
            : error.constructor.name === 'ValidationError' ? 400
              : 500;
        this.logger.error('Error en análisis de hábitos', {
          requesterId,
          targetUserId: dto.userId,
          error: error.message
        });
        res.status(status).json({
          success: false,
          error: error.message,
          code: 'HABITS_ANALYSIS_ERROR'
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: result.value,
        message: 'Análisis de hábitos generado exitosamente'
      });

    } catch (error) {
      this.logger.error('Error inesperado en análisis de hábitos', error as Error, {
        userId: req.user?.userId
      });
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        code: 'INTERNAL_SERVER_ERROR'
      });
    }
  }

  /**
   * Endpoint para obtener sugerencias de categorías para un producto
   * POST /api/ai/category-suggestions
   */
  async suggestCategories(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      this.logger.http('Solicitud de sugerencias de categorías', {
        body: req.body,
        userId: req.user?.userId
      });

      // Verificar que el use case esté disponible
      if (!this.getCategorySuggestionsUseCase) {
        res.status(503).json({
          success: false,
          error: {
            code: 'FEATURE_NOT_AVAILABLE',
            message: 'Sugerencias de categorías no disponibles'
          }
        });
        return;
      }

      // Validar entrada
      const input: GetCategorySuggestionsDto = {
        productName: req.body.productName,
        storeName: req.body.storeName,
        existingCategories: req.body.existingCategories,
        ...(req.user?.userId && { userId: req.user.userId })
      };

      // Validaciones básicas
      if (!input.productName || input.productName.trim().length === 0) {
        res.status(400).json({
          success: false,
          error: 'El nombre del producto es requerido',
          code: 'INVALID_PRODUCT_NAME'
        });
        return;
      }

      if (input.productName.length > 100) {
        res.status(400).json({
          success: false,
          error: 'El nombre del producto no puede exceder 100 caracteres',
          code: 'PRODUCT_NAME_TOO_LONG'
        });
        return;
      }

      // Ejecutar caso de uso
      const result = await this.getCategorySuggestionsUseCase.execute(input);

      if (result.isFailure) {
        const error = result.error;
        
        if (error instanceof ValidationError) {
          res.status(400).json({
            success: false,
            error: error.message,
            code: 'VALIDATION_ERROR'
          });
          return;
        }

        // Error interno del servidor
        this.logger.error('Error interno en sugerencias de categorías', error, {
          productName: input.productName,
          userId: req.user?.userId
        });

        res.status(500).json({
          success: false,
          error: 'Error interno del servidor',
          code: 'INTERNAL_SERVER_ERROR'
        });
        return;
      }

      const suggestions = result.value;

      this.logger.http('Sugerencias de categorías generadas exitosamente', {
        productName: input.productName,
        suggestionsCount: suggestions.suggestions.length,
        userId: req.user?.userId
      });

      res.status(200).json({
        success: true,
        data: {
          productName: suggestions.productName,
          suggestions: suggestions.suggestions.map((s: any) => ({
            category: s.category,
            confidence: s.confidence,
            reasoning: s.reasoning
          })),
          cached: suggestions.cached,
          requestId: suggestions.requestId,
          timestamp: suggestions.timestamp,
          personalized: suggestions.personalized,
          examplesUsed: suggestions.examplesUsed
        }
      });

    } catch (error) {
      this.logger.error('Error inesperado en sugerencias de categorías', error as Error, {
        body: req.body,
        userId: req.user?.userId
      });

      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        code: 'UNEXPECTED_ERROR'
      });
    }
  }

  /**
   * Endpoint para categorización masiva de productos con IA
   * POST /api/v1/ai/bulk-categorize
   * CU-29: Categorización Masiva Inteligente
   */
  async bulkCategorize(req: AuthenticatedRequest, res: Response): Promise<void> {
    const startTime = Date.now();

    try {
      this.logger.http('Solicitud de categorización masiva', {
        productsCount: req.body?.products?.length,
        tiendaId: req.body?.tiendaId,
        userId: req.user?.userId
      });

      // Verificar que el use case esté disponible
      if (!this.bulkCategorizeProductsUseCase) {
        res.status(503).json({
          success: false,
          error: {
            code: 'FEATURE_NOT_AVAILABLE',
            message: 'Categorización masiva no disponible'
          }
        });
        return;
      }

      // Validar y crear DTO
      let dto;
      try {
        dto = BulkCategorizeProductsDtoFactory.fromHttpRequest(req.body);
      } catch (validationError) {
        const errorMessage = validationError instanceof Error 
          ? validationError.message 
          : 'Datos de entrada inválidos';

        this.logger.warn('Validación fallida en categorización masiva', {
          error: errorMessage,
          bodyPreview: JSON.stringify(req.body).substring(0, 200)
        });

        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: errorMessage
          }
        });
        return;
      }

      // Ejecutar caso de uso
      const result = await this.bulkCategorizeProductsUseCase.execute(
        dto,
        req.user!.userId
      );

      if (result.isFailure) {
        this.logger.error('Error en categorización masiva', {
          error: result.error.message,
          userId: req.user?.userId,
          productsCount: dto.products.length
        });

        // Determinar código de error apropiado
        const statusCode = result.error.message.includes('no encontrado') ? 404 : 500;

        res.status(statusCode).json({
          success: false,
          error: {
            code: statusCode === 404 ? 'NOT_FOUND' : 'PROCESSING_ERROR',
            message: result.error.message
          }
        });
        return;
      }

      // Respuesta exitosa
      const processingTime = Date.now() - startTime;
      const { categorizedProducts, batchStats } = result.value;

      // Determinar código de estado
      // 207 Multi-Status si hay fallos parciales, 200 si todo OK
      const statusCode = batchStats.failed > 0 ? 207 : 200;

      this.logger.info('Categorización masiva completada', {
        statusCode,
        successful: batchStats.successful,
        failed: batchStats.failed,
        fromCache: batchStats.fromCache,
        fromAI: batchStats.fromAI,
        averageConfidence: batchStats.averageConfidence,
        totalProcessingTime: processingTime
      });

      res.status(statusCode).json({
        success: true,
        data: {
          categorizedProducts,
          batchStats: {
            ...batchStats,
            totalProcessingTimeMs: processingTime
          }
        }
      });

    } catch (error) {
      const processingTime = Date.now() - startTime;

      this.logger.error('Error fatal en categorización masiva', {
        error: error instanceof Error ? error.message : String(error),
        userId: req.user?.userId,
        processingTime
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Error interno del servidor'
        }
      });
    }
  }

  /**
   * Endpoint para health check del servicio de IA
   * GET /api/ai/health
   */
  async healthCheck(_req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      this.logger.http('Health check del servicio IA');

      // Aquí podríamos verificar la disponibilidad del servicio de IA
      // Por ahora, simplemente respondemos que está disponible
      
      res.status(200).json({
        success: true,
        data: {
          status: 'healthy',
          provider: 'perplexity',
          timestamp: new Date().toISOString(),
          features: {
            categorySuggestions: true,
            purchaseAnalysis: false, // Funcionalidad futura
            productRecommendations: false // Funcionalidad futura
          }
        }
      });

    } catch (error) {
      this.logger.error('Error en health check de IA', error as Error);

      res.status(503).json({
        success: false,
        error: 'Servicio de IA no disponible',
        code: 'SERVICE_UNAVAILABLE'
      });
    }
  }

  /**
   * Endpoint para obtener información de uso de la API de IA
   * GET /api/ai/usage
   */
  async getUsageInfo(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      this.logger.http('Solicitud de información de uso de IA', {
        userId: req.user?.userId
      });

      // Por seguridad, solo usuarios admin pueden ver esta información
      const userRole = req.user?.rol ?? req.user?.role;
      if (!req.user || (typeof userRole !== 'string' || userRole.toUpperCase() !== 'ADMIN')) {
        res.status(403).json({
          success: false,
          error: 'Acceso denegado. Solo administradores pueden ver esta información.',
          code: 'ACCESS_DENIED'
        });
        return;
      }

      // Sin seguimiento real todavía: no se devuelven datos inventados.
      // El seguimiento real llegará con FreeLLMAPI (backlog item 4).
      res.status(503).json({
        success: false,
        error: 'El seguimiento de uso de IA aún no está disponible.',
        code: 'AI_USAGE_NOT_AVAILABLE'
      });

    } catch (error) {
      this.logger.error('Error al obtener información de uso de IA', error as Error, {
        userId: req.user?.userId
      });

      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        code: 'INTERNAL_SERVER_ERROR'
      });
    }
  }
}
