/**
 * Controlador para funcionalidades de Inteligencia Artificial
 * Maneja endpoints relacionados con categorización automática y análisis IA
 */

import { Response } from 'express';
import { AuthenticatedRequest } from '../types/express';
import { GetCategorySuggestionsUseCase } from '../../../application/use-cases/ai/GetCategorySuggestions';
import { GetCategorySuggestionsDto } from '../../../application/dto/ai/AIDto';
import { ValidationError } from '../../../application/errors/ValidationError';
import { Logger } from '../../observability/logger/Logger';

export class AIController {
  private readonly logger = new Logger('AIController');

  constructor(
    private readonly getCategorySuggestionsUseCase: GetCategorySuggestionsUseCase
  ) {}

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

      // Validar entrada
      const input: GetCategorySuggestionsDto = {
        productName: req.body.productName,
        storeName: req.body.storeName,
        existingCategories: req.body.existingCategories
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
          timestamp: suggestions.timestamp
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
   * Endpoint de health check para el servicio de IA
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
      if (!req.user || req.user.role !== 'admin') {
        res.status(403).json({
          success: false,
          error: 'Acceso denegado. Solo administradores pueden ver esta información.',
          code: 'ACCESS_DENIED'
        });
        return;
      }

      // Aquí podríamos obtener información real del servicio de IA
      // Por ahora, devolvemos información mock
      res.status(200).json({
        success: true,
        data: {
          provider: 'perplexity',
          tokensUsed: 0,
          tokensRemaining: 1000000,
          requestsThisMonth: 0,
          rateLimitRemaining: 10,
          resetTime: new Date(Date.now() + 60000).toISOString(),
          costEstimate: 0
        }
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