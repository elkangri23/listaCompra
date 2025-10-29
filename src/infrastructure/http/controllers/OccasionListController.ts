/**
 * Controlador para las funcionalidades de listas inteligentes por ocasión
 * Implementa CU-32: Listas Inteligentes por Ocasión
 */

import { Request, Response } from 'express';
import { CreateOccasionListUseCase } from '../../../application/use-cases/lists/CreateOccasionList';
import { CreateOccasionListDto, validateCreateOccasionListDto, PREDEFINED_OCCASIONS } from '../../../application/dto/lists/CreateOccasionListDto';
import { Logger } from '../../observability/logger/Logger';
import { ValidationError } from '../../../application/errors/ValidationError';
import { NotFoundError } from '../../../application/errors/NotFoundError';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export class OccasionListController {
  private readonly logger = new Logger('OccasionListController');

  constructor(
    private readonly createOccasionListUseCase: CreateOccasionListUseCase
  ) {}

  /**
   * GET /api/occasion-lists/occasions
   * Obtiene las ocasiones predefinidas disponibles
   */
  public getPredefinedOccasions = async (_req: Request, res: Response): Promise<void> => {
    try {
      this.logger.info('Obteniendo ocasiones predefinidas');
      
      res.status(200).json({
        success: true,
        data: {
          occasions: PREDEFINED_OCCASIONS,
          total: PREDEFINED_OCCASIONS.length
        },
        message: 'Ocasiones predefinidas obtenidas exitosamente'
      });

    } catch (error) {
      this.logger.error('Error obteniendo ocasiones predefinidas', error as Error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Error interno del servidor'
        }
      });
    }
  };

  /**
   * POST /api/occasion-lists/generate
   * Genera una lista inteligente para una ocasión específica
   */
  public generateOccasionList = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const startTime = Date.now();
    
    try {
      // Verificar autenticación
      if (!req.user?.id) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Token de autenticación requerido'
          }
        });
        return;
      }

      const userId = req.user.id;
      const dto: CreateOccasionListDto = req.body;

      this.logger.ai('Generando lista por ocasión', {
        userId,
        occasion: dto.occasion,
        numberOfPeople: dto.numberOfPeople,
        budget: dto.maxBudget,
        restrictions: dto.dietaryRestrictions?.length || 0
      });

      // Validar DTO de entrada
      const validationErrors = validateCreateOccasionListDto(dto);
      if (validationErrors.length > 0) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Datos de entrada inválidos',
            details: validationErrors
          }
        });
        return;
      }

      // Ejecutar caso de uso
      const result = await this.createOccasionListUseCase.execute(dto, userId);

      if (result.isFailure) {
        this.handleUseCaseError(result.error, res);
        return;
      }

      const processingTime = Date.now() - startTime;
      
      this.logger.ai('Lista por ocasión generada exitosamente', {
        userId,
        listId: result.value.listId,
        totalProducts: result.value.summary.totalProducts,
        processingTime,
        aiConfidence: result.value.aiConfidence
      });

      res.status(201).json({
        success: true,
        data: result.value,
        meta: {
          processingTime,
          timestamp: new Date().toISOString()
        },
        message: `Lista "${result.value.listName}" generada exitosamente con ${result.value.summary.totalProducts} productos`
      });

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      this.logger.error('Error generando lista por ocasión', error as Error, {
        userId: req.user?.id,
        processingTime
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Error interno al generar lista'
        },
        meta: {
          processingTime,
          timestamp: new Date().toISOString()
        }
      });
    }
  };

  /**
   * POST /api/occasion-lists/preview
   * Genera una vista previa de productos sin crear la lista
   */
  public previewOccasionList = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      // Verificar autenticación
      if (!req.user?.id) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Token de autenticación requerido'
          }
        });
        return;
      }

      const dto: CreateOccasionListDto = req.body;

      // Validar DTO básico (sin crear lista real)
      const validationErrors = validateCreateOccasionListDto(dto);
      if (validationErrors.length > 0) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Datos de entrada inválidos',
            details: validationErrors
          }
        });
        return;
      }

      // TODO: Implementar preview sin crear lista real
      // Por ahora, respuesta simulada
      res.status(200).json({
        success: true,
        data: {
          preview: true,
          occasion: dto.occasion,
          estimatedProducts: Math.floor(Math.random() * 10) + 5, // 5-15 productos
          estimatedCost: dto.maxBudget ? dto.maxBudget * 0.8 : undefined,
          categories: ['Carnes', 'Verduras', 'Lácteos', 'Bebidas'],
          processingTime: 500
        },
        message: 'Vista previa generada (funcionalidad en desarrollo)'
      });

    } catch (error) {
      this.logger.error('Error generando vista previa', error as Error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Error interno generando vista previa'
        }
      });
    }
  };

  /**
   * Maneja errores específicos del caso de uso
   */
  private handleUseCaseError(error: Error, res: Response): void {
    if (error instanceof ValidationError) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.message,
          field: error.field
        }
      });
    } else if (error instanceof NotFoundError) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: error.message,
          resource: error.resource
        }
      });
    } else {
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Error interno procesando solicitud'
        }
      });
    }
  }
}

/**
 * Esquemas de validación para Swagger/OpenAPI
 */
export const OccasionListSchemas = {
  CreateOccasionListRequest: {
    type: 'object',
    required: ['occasion', 'numberOfPeople'],
    properties: {
      occasion: {
        type: 'string',
        maxLength: 100,
        example: 'Barbacoa familiar',
        description: 'Tipo de ocasión (predefinida o personalizada)'
      },
      numberOfPeople: {
        type: 'integer',
        minimum: 1,
        maximum: 50,
        example: 6,
        description: 'Número de personas para la ocasión'
      },
      dietaryRestrictions: {
        type: 'array',
        items: { type: 'string' },
        maxItems: 10,
        example: ['vegetariano', 'sin gluten'],
        description: 'Restricciones dietéticas (opcional)'
      },
      maxBudget: {
        type: 'number',
        minimum: 0,
        maximum: 10000,
        example: 80,
        description: 'Presupuesto máximo en euros (opcional)'
      },
      additionalPreferences: {
        type: 'string',
        maxLength: 500,
        example: 'Preferencias por productos frescos y locales',
        description: 'Preferencias adicionales (opcional)'
      },
      storeId: {
        type: 'string',
        format: 'uuid',
        description: 'ID de la tienda (opcional)'
      },
      customListName: {
        type: 'string',
        maxLength: 50,
        example: 'Barbacoa del sábado',
        description: 'Nombre personalizado para la lista (opcional)'
      }
    }
  },

  OccasionListResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      data: {
        type: 'object',
        properties: {
          listId: { type: 'string', format: 'uuid' },
          listName: { type: 'string', example: 'Barbacoa familiar (6 personas)' },
          occasionDescription: { type: 'string' },
          products: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string', example: 'Carne para asar' },
                quantity: { type: 'number', example: 2 },
                unit: { type: 'string', example: 'kg' },
                category: { type: 'string', example: 'Carnes' },
                estimatedPrice: { type: 'number', example: 18.50 },
                priority: { type: 'integer', enum: [1, 2, 3], example: 1 },
                aiReason: { type: 'string', example: 'Esencial para barbacoa de 6 personas' },
                alternatives: { type: 'array', items: { type: 'string' } }
              }
            }
          },
          summary: {
            type: 'object',
            properties: {
              totalProducts: { type: 'integer', example: 15 },
              estimatedCost: { type: 'number', example: 67.80 },
              categoriesIncluded: { type: 'array', items: { type: 'string' } },
              restrictionsApplied: { type: 'array', items: { type: 'string' } }
            }
          },
          processingTime: { type: 'integer', example: 2350 },
          aiConfidence: { type: 'integer', minimum: 0, maximum: 100, example: 87 }
        }
      },
      message: { type: 'string', example: 'Lista generada exitosamente' }
    }
  },

  PredefinedOccasionsResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      data: {
        type: 'object',
        properties: {
          occasions: {
            type: 'array',
            items: { type: 'string' },
            example: ['Barbacoa familiar', 'Cena romántica', 'Cumpleaños infantil']
          },
          total: { type: 'integer', example: 20 }
        }
      },
      message: { type: 'string', example: 'Ocasiones predefinidas obtenidas exitosamente' }
    }
  }
};