// src/application/use-cases/products/GetProductRecommendations.ts

/**
 * Caso de Uso: Obtener Recomendaciones Contextuales de Productos
 * CU-33: Recomendaciones Contextuales Automáticas
 * 
 * Este caso de uso genera sugerencias inteligentes de productos complementarios
 * basándose en los productos actuales de la lista del usuario.
 */

import { Result, success, failure } from '../../../shared/result';
import { 
  GetProductRecommendationsDto, 
  GetProductRecommendationsResponseDto,
  ProductRecommendationDto,
  validateGetProductRecommendationsDto,
  applyRecommendationsDefaults
} from '../../dto/products/GetProductRecommendationsDto';
import { IListaRepository } from '../../ports/repositories/IListaRepository';
import { IProductoRepository } from '../../ports/repositories/IProductoRepository';
import { ICategoriaRepository } from '../../ports/repositories/ICategoriaRepository';
import { IAIService, ProductInList } from '../../ports/external/IAIService';
import { Logger } from '../../../infrastructure/observability/logger/Logger';
import { Producto } from '../../../domain/entities/Producto';

export class GetProductRecommendations {
  private readonly logger = new Logger('GetProductRecommendations');

  constructor(
    private readonly listaRepository: IListaRepository,
    private readonly productoRepository: IProductoRepository,
    private readonly categoriaRepository: ICategoriaRepository,
    private readonly aiService: IAIService
  ) {}

  async execute(
    dto: GetProductRecommendationsDto,
    userId: string
  ): Promise<Result<GetProductRecommendationsResponseDto, Error>> {
    const startTime = Date.now();

    try {
      // 1. Validar DTO
      const validation = validateGetProductRecommendationsDto(dto);
      if (!validation.valid) {
        this.logger.warn('Validación fallida en GetProductRecommendations', {
          errors: validation.errors,
          userId
        });
        return failure(new Error(validation.errors.join(', ')));
      }

      // 2. Aplicar valores por defecto
      const normalizedDto = applyRecommendationsDefaults(dto);

      this.logger.info('Generando recomendaciones de productos', {
        userId,
        listId: normalizedDto.listId,
        maxRecommendations: normalizedDto.maxRecommendations,
        creativityLevel: normalizedDto.creativityLevel,
        hasProductId: !!normalizedDto.productId,
        hasContext: !!normalizedDto.context
      });

      // 3. Verificar que la lista existe y pertenece al usuario
      const listaResult = await this.listaRepository.findById(normalizedDto.listId);
      if (listaResult.isFailure || !listaResult.value) {
        this.logger.warn('Lista no encontrada', { listId: normalizedDto.listId, userId });
        return failure(new Error('Lista no encontrada'));
      }

      const lista = listaResult.value;

      // Verificar permisos: debe ser propietario o tener acceso de lectura
      const hasAccess = await this.checkUserAccess(lista, userId);
      if (!hasAccess) {
        this.logger.warn('Usuario sin permisos para acceder a la lista', {
          listId: normalizedDto.listId,
          userId,
          ownerId: lista.propietarioId
        });
        return failure(new Error('No tienes permisos para acceder a esta lista'));
      }

      // 4. Obtener productos de la lista
      const productosResult = await this.productoRepository.findByList(
        normalizedDto.listId,
        {}, // Sin filtros adicionales
        { page: 1, limit: 1000 } // Obtener todos
      );
      
      if (productosResult.isFailure || !productosResult.value || productosResult.value.items.length === 0) {
        this.logger.info('Lista vacía, no se pueden generar recomendaciones', {
          listId: normalizedDto.listId
        });
        return failure(new Error('La lista está vacía. Añade al menos un producto para obtener recomendaciones.'));
      }

      // 5. Filtrar productos según configuración
      let filteredProducts = productosResult.value.items;

      // Excluir productos ya comprados si se solicita
      if (normalizedDto.excludeExisting) {
        filteredProducts = filteredProducts.filter((p: Producto) => !p.comprado);
      }

      // Si se especifica un producto específico, validar que existe
      if (normalizedDto.productId) {
        const specificProduct = filteredProducts.find((p: Producto) => p.id === normalizedDto.productId);
        if (!specificProduct) {
          return failure(new Error('El producto especificado no existe en la lista'));
        }
      }

      // 6. Convertir productos al formato esperado por IA
      // Necesitamos enriquecer productos con categoría si es necesario
      const productsForAI: ProductInList[] = [];
      
      for (const producto of filteredProducts) {
        let categoryName: string | undefined = undefined;
        
        // Obtener nombre de categoría si existe
        if (producto.categoriaId) {
          const categoriaResult = await this.categoriaRepository.findById(producto.categoriaId);
          if (categoriaResult.isSuccess && categoriaResult.value) {
            categoryName = categoriaResult.value.nombre;
          }
        }
        
        const productData: ProductInList = {
          name: producto.nombre,
          quantity: producto.cantidad,
          purchased: producto.comprado
        };
        
        // Solo añadir category si tiene valor
        if (categoryName !== undefined) {
          productData.category = categoryName;
        }
        
        productsForAI.push(productData);
      }

      this.logger.debug('Productos preparados para análisis IA', {
        totalProducts: productsForAI.length,
        activeProducts: productsForAI.filter(p => !p.purchased).length,
        purchasedProducts: productsForAI.filter(p => p.purchased).length
      });

      // 7. Obtener nombre del producto específico si se proporciona
      let specificProductName: string | undefined;
      if (normalizedDto.productId) {
        const product = filteredProducts.find((p: Producto) => p.id === normalizedDto.productId);
        specificProductName = product?.nombre;
      }

      // 8. Llamar al servicio de IA para obtener recomendaciones
      const aiResponse = await this.aiService.getProductRecommendations(
        productsForAI,
        normalizedDto.context,
        specificProductName,
        normalizedDto.maxRecommendations,
        normalizedDto.creativityLevel
      );

      // 9. Parsear respuesta de IA
      let parsedResponse: any;
      try {
        parsedResponse = JSON.parse(aiResponse);
      } catch (error) {
        this.logger.error('Error al parsear respuesta de IA', {
          error: error instanceof Error ? error.message : String(error),
          responsePreview: aiResponse.substring(0, 200)
        });
        return failure(new Error('Error al procesar recomendaciones de IA'));
      }

      // 10. Validar estructura de respuesta
      if (!parsedResponse.recommendations || !Array.isArray(parsedResponse.recommendations)) {
        this.logger.error('Respuesta de IA con estructura inválida', {
          hasRecommendations: !!parsedResponse.recommendations,
          type: typeof parsedResponse.recommendations
        });
        return failure(new Error('Respuesta de IA con formato inválido'));
      }

      // 11. Procesar recomendaciones y enriquecer con datos locales
      const recommendations: ProductRecommendationDto[] = await this.processRecommendations(
        parsedResponse.recommendations,
        normalizedDto.categoryId,
        lista.tiendaId ?? undefined
      );

      // 12. Calcular metadata
      const processingTime = Date.now() - startTime;
      const averageConfidence = recommendations.length > 0
        ? recommendations.reduce((sum, r) => sum + r.confidenceScore, 0) / recommendations.length
        : 0;

      // 13. Construir respuesta
      const response: GetProductRecommendationsResponseDto = {
        listId: normalizedDto.listId,
        recommendations: recommendations,
        detectedContext: parsedResponse.detectedContext || 'Contexto general',
        productsInList: productsForAI.length,
        metadata: {
          processingTime,
          aiUsed: true,
          algorithmVersion: '1.0.0',
          averageConfidence: Math.round(averageConfidence * 100) / 100
        }
      };

      this.logger.info('Recomendaciones generadas exitosamente', {
        userId,
        listId: normalizedDto.listId,
        recommendationsCount: recommendations.length,
        processingTime,
        averageConfidence: response.metadata.averageConfidence,
        detectedContext: response.detectedContext
      });

      return success(response);

    } catch (error: any) {
      const processingTime = Date.now() - startTime;
      this.logger.error('Error al generar recomendaciones', {
        error: error.message,
        stack: error.stack,
        userId,
        listId: dto.listId,
        processingTime
      });
      return failure(new Error(`Error al generar recomendaciones: ${error.message}`));
    }
  }

  /**
   * Verifica si el usuario tiene acceso a la lista (propietario o invitado con permisos)
   */
  private async checkUserAccess(lista: any, userId: string): Promise<boolean> {
    // Si es el propietario, tiene acceso
    if (lista.propietarioId === userId) {
      return true;
    }

    // TODO: Verificar si el usuario tiene permisos como invitado
    // Por ahora, solo permitimos al propietario
    // En el futuro, verificar en IPermisoRepository si el usuario tiene acceso de lectura
    
    return false;
  }

  /**
   * Procesa y enriquece las recomendaciones con datos locales
   */
  private async processRecommendations(
    rawRecommendations: any[],
    categoryFilter?: string,
    listStoreId?: string
  ): Promise<ProductRecommendationDto[]> {
    const processed: ProductRecommendationDto[] = [];

    for (const raw of rawRecommendations) {
      try {
        // Validar campos requeridos
        if (!raw.name || !raw.reason || typeof raw.confidenceScore !== 'number') {
          this.logger.warn('Recomendación con campos inválidos, omitiendo', { raw });
          continue;
        }

        // Obtener categoría sugerida desde la base de datos si existe
        let suggestedCategory: { id: string; name: string } | undefined = undefined;
        
        if (raw.suggestedCategory) {
          // Intentar encontrar categoría por nombre
          const categoryName = typeof raw.suggestedCategory === 'string' 
            ? raw.suggestedCategory 
            : raw.suggestedCategory;

          // Si tenemos tienda, buscar categoría específica de esa tienda
          if (listStoreId) {
            const categoriasResult = await this.categoriaRepository.findByTienda(listStoreId);
            if (categoriasResult.isSuccess) {
              const matchingCategory = categoriasResult.value.find(
                (c: any) => c.nombre.toLowerCase() === categoryName.toLowerCase()
              );
              if (matchingCategory) {
                suggestedCategory = {
                  id: matchingCategory.id,
                  name: matchingCategory.nombre
                };
              }
            }
          }

          // Si no encontramos categoría específica, usar nombre sugerido por IA
          if (!suggestedCategory) {
            suggestedCategory = {
              id: '', // Vacío indica que es una sugerencia, no una categoría existente
              name: categoryName
            };
          }
        }

        // Aplicar filtro de categoría si se especificó
        if (categoryFilter && suggestedCategory && suggestedCategory.id !== categoryFilter) {
          continue; // Omitir recomendaciones que no coincidan con la categoría filtrada
        }

        // Construir recomendación procesada
        const baseRecommendation: Partial<ProductRecommendationDto> = {
          name: raw.name,
          reason: raw.reason,
          confidenceScore: Math.min(100, Math.max(0, raw.confidenceScore)), // Clamp 0-100
          suggestedQuantity: raw.suggestedQuantity || 1,
          suggestedUnit: raw.suggestedUnit || 'unidades',
          relatedProducts: Array.isArray(raw.relatedProducts) ? raw.relatedProducts : [],
          fromUserHistory: raw.fromUserHistory || false,
          recommendationType: this.validateRecommendationType(raw.recommendationType)
        };
        
        // Añadir propiedades opcionales solo si existen
        if (suggestedCategory) {
          baseRecommendation.suggestedCategory = suggestedCategory;
        }
        if (raw.estimatedPrice !== undefined) {
          baseRecommendation.estimatedPrice = raw.estimatedPrice;
        }
        if (Array.isArray(raw.tags) && raw.tags.length > 0) {
          baseRecommendation.tags = raw.tags;
        }

        processed.push(baseRecommendation as ProductRecommendationDto);

      } catch (error) {
        this.logger.warn('Error al procesar recomendación individual', {
          error: error instanceof Error ? error.message : String(error),
          recommendation: raw
        });
        // Continuar con la siguiente recomendación
      }
    }

    // Ordenar por confidenceScore descendente
    processed.sort((a, b) => b.confidenceScore - a.confidenceScore);

    return processed;
  }

  /**
   * Valida y normaliza el tipo de recomendación
   */
  private validateRecommendationType(type: any): ProductRecommendationDto['recommendationType'] {
    const validTypes: ProductRecommendationDto['recommendationType'][] = [
      'complement',
      'frequently_together',
      'category_match',
      'user_preference'
    ];

    if (validTypes.includes(type)) {
      return type;
    }

    // Por defecto, si el tipo es inválido
    return 'complement';
  }
}
