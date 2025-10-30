/**
 * Controlador de Recomendaciones de Productos
 * CU-33: Recomendaciones Contextuales Automáticas
 * 
 * Expone endpoints para obtener sugerencias inteligentes de productos
 * basadas en el contenido actual de las listas del usuario.
 */

import { Request, Response } from 'express';
import { GetProductRecommendations } from '../../../application/use-cases/products/GetProductRecommendations';
import { GetProductRecommendationsDto } from '../../../application/dto/products/GetProductRecommendationsDto';
import { Logger } from '../../observability/logger/Logger';

export class RecommendationsController {
  private readonly logger = new Logger('RecommendationsController');

  constructor(
    private readonly getProductRecommendationsUseCase: GetProductRecommendations
  ) {}

  /**
   * Helper para parsear query params de forma segura
   */
  private parseQueryParams(query: any, productId?: string): GetProductRecommendationsDto {
    const dto: Partial<GetProductRecommendationsDto> = {};

    // Campos opcionales numéricos
    if (query['maxRecommendations']) {
      const parsed = parseInt(query['maxRecommendations'] as string, 10);
      if (!isNaN(parsed)) {
        dto.maxRecommendations = parsed;
      }
    }

    // Campos opcionales de texto
    if (query['creativityLevel']) {
      dto.creativityLevel = query['creativityLevel'] as any;
    }
    if (query['categoryId']) {
      dto.categoryId = query['categoryId'] as string;
    }
    if (query['storeId']) {
      dto.storeId = query['storeId'] as string;
    }
    if (query['context']) {
      dto.context = query['context'] as string;
    }

    // Campos opcionales booleanos
    if (query['includeUserHistory'] !== undefined) {
      dto.includeUserHistory = query['includeUserHistory'] === 'true';
    }
    if (query['excludeExisting'] !== undefined) {
      dto.excludeExisting = query['excludeExisting'] !== 'false'; // Por defecto true
    }

    // ProductId si se proporciona
    if (productId) {
      dto.productId = productId;
    }

    return dto as GetProductRecommendationsDto;
  }

  /**
   * GET /api/recommendations/:listId
   * 
   * Obtiene recomendaciones generales para una lista
   * 
   * Query params:
   * - maxRecommendations: número máximo de recomendaciones (5-50)
   * - creativityLevel: "conservative" | "balanced" | "creative"
   * - categoryId: filtrar por categoría específica
   * - storeId: filtrar por tienda específica
   * - context: contexto adicional textual
   * - includeUserHistory: incluir historial de usuario (boolean)
   * - excludeExisting: excluir productos ya en la lista (boolean)
   */
  async getListRecommendations(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();

    try {
      const { listId } = req.params;
      const userId = (req as any).userId; // Del middleware de autenticación

      if (!listId) {
        res.status(400).json({
          success: false,
          error: 'El ID de la lista es requerido'
        });
        return;
      }

      // Construir DTO desde query params
      const dto = this.parseQueryParams(req.query);
      dto.listId = listId;

      this.logger.info('Solicitud de recomendaciones para lista', {
        userId,
        listId,
        params: dto
      });

      // Ejecutar caso de uso
      const result = await this.getProductRecommendationsUseCase.execute(dto, userId);

      if (result.isFailure) {
        const errorMessage = result.error.message;
        this.logger.warn('Error al obtener recomendaciones', {
          userId,
          listId,
          error: errorMessage
        });

        // Determinar código de error apropiado
        if (errorMessage.includes('no encontrada') || errorMessage.includes('no existe')) {
          res.status(404).json({
            success: false,
            error: errorMessage
          });
        } else if (errorMessage.includes('permisos') || errorMessage.includes('acceso')) {
          res.status(403).json({
            success: false,
            error: errorMessage
          });
        } else if (errorMessage.includes('vacía')) {
          res.status(400).json({
            success: false,
            error: errorMessage
          });
        } else {
          res.status(400).json({
            success: false,
            error: errorMessage
          });
        }
        return;
      }

      // Respuesta exitosa
      const processingTime = Date.now() - startTime;
      this.logger.info('Recomendaciones generadas exitosamente', {
        userId,
        listId,
        recommendationsCount: result.value.recommendations.length,
        processingTime
      });

      res.status(200).json({
        success: true,
        data: result.value,
        _meta: {
          timestamp: new Date().toISOString(),
          processingTime
        }
      });

    } catch (error: any) {
      const processingTime = Date.now() - startTime;
      this.logger.error('Error inesperado en getListRecommendations', {
        error: error.message,
        stack: error.stack,
        listId: req.params['listId'],
        processingTime
      });

      res.status(500).json({
        success: false,
        error: 'Error interno del servidor al generar recomendaciones'
      });
    }
  }

  /**
   * GET /api/recommendations/:listId/for-product/:productId
   * 
   * Obtiene recomendaciones específicas basadas en un producto de la lista
   * 
   * Query params: (mismos que getListRecommendations)
   */
  async getProductSpecificRecommendations(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();

    try {
      const { listId, productId } = req.params;
      const userId = (req as any).userId; // Del middleware de autenticación

      if (!listId || !productId) {
        res.status(400).json({
          success: false,
          error: 'El ID de la lista y el ID del producto son requeridos'
        });
        return;
      }

      // Construir DTO desde query params
      const dto = this.parseQueryParams(req.query, productId);
      dto.listId = listId;

      this.logger.info('Solicitud de recomendaciones para producto específico', {
        userId,
        listId,
        productId,
        params: dto
      });

      // Ejecutar caso de uso
      const result = await this.getProductRecommendationsUseCase.execute(dto, userId);

      if (result.isFailure) {
        const errorMessage = result.error.message;
        this.logger.warn('Error al obtener recomendaciones específicas', {
          userId,
          listId,
          productId,
          error: errorMessage
        });

        // Determinar código de error apropiado
        if (errorMessage.includes('no encontrada') || errorMessage.includes('no existe')) {
          res.status(404).json({
            success: false,
            error: errorMessage
          });
        } else if (errorMessage.includes('permisos') || errorMessage.includes('acceso')) {
          res.status(403).json({
            success: false,
            error: errorMessage
          });
        } else if (errorMessage.includes('vacía')) {
          res.status(400).json({
            success: false,
            error: errorMessage
          });
        } else {
          res.status(400).json({
            success: false,
            error: errorMessage
          });
        }
        return;
      }

      // Respuesta exitosa
      const processingTime = Date.now() - startTime;
      this.logger.info('Recomendaciones específicas generadas exitosamente', {
        userId,
        listId,
        productId,
        recommendationsCount: result.value.recommendations.length,
        processingTime
      });

      res.status(200).json({
        success: true,
        data: result.value,
        _meta: {
          timestamp: new Date().toISOString(),
          processingTime
        }
      });

    } catch (error: any) {
      const processingTime = Date.now() - startTime;
      this.logger.error('Error inesperado en getProductSpecificRecommendations', {
        error: error.message,
        stack: error.stack,
        listId: req.params['listId'],
        productId: req.params['productId'],
        processingTime
      });

      res.status(500).json({
        success: false,
        error: 'Error interno del servidor al generar recomendaciones'
      });
    }
  }

  /**
   * GET /api/recommendations/context-examples
   * 
   * Devuelve ejemplos de contextos que se pueden proporcionar para mejorar recomendaciones
   * 
   * Este endpoint NO requiere autenticación y es informativo
   */
  async getContextExamples(_req: Request, res: Response): Promise<void> {
    try {
      const examples = [
        {
          context: 'Cena romántica para dos',
          description: 'Recomendará productos premium y complementarios para una cena especial',
          expectedProducts: ['vino', 'velas', 'postre', 'queso', 'pan artesanal']
        },
        {
          context: 'Desayuno saludable',
          description: 'Enfoque en productos nutritivos y balanceados',
          expectedProducts: ['frutas', 'yogurt', 'avena', 'miel', 'frutos secos']
        },
        {
          context: 'Barbacoa familiar',
          description: 'Productos para eventos sociales y comidas al aire libre',
          expectedProducts: ['carbón', 'condimentos', 'bebidas', 'ensaladas', 'hielo']
        },
        {
          context: 'Despensa básica',
          description: 'Productos esenciales y de larga duración',
          expectedProducts: ['arroz', 'pasta', 'aceite', 'sal', 'azúcar', 'conservas']
        },
        {
          context: 'Fitness y deporte',
          description: 'Productos para personas activas y deportistas',
          expectedProducts: ['proteína', 'frutas', 'vegetales', 'agua', 'barritas energéticas']
        }
      ];

      res.status(200).json({
        success: true,
        data: {
          examples,
          tips: [
            'Sé específico con el contexto para mejores resultados',
            'Puedes combinar ocasión + restricción: "Cena vegana para 4"',
            'El nivel de creatividad afecta qué tan innovadoras son las sugerencias'
          ]
        }
      });

    } catch (error: any) {
      this.logger.error('Error en getContextExamples', {
        error: error.message,
        stack: error.stack
      });

      res.status(500).json({
        success: false,
        error: 'Error interno del servidor'
      });
    }
  }
}
