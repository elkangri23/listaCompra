/**
 * @file BulkCategorizeProducts.ts
 * @description Caso de uso para categorización masiva de productos con IA
 * @module application/use-cases/ai
 * 
 * CU-29: Categorización Masiva Inteligente
 * - Procesa 1-50 productos por batch
 * - Optimiza tokens mediante batching de 20 productos
 * - Maneja fallos parciales sin afectar todo el batch
 * - Enriquece con categorías existentes de BD
 * - Scoring de confianza por producto
 */

import { IAIService } from '../../ports/external/IAIService';
import { IUsuarioRepository } from '../../ports/repositories/IUsuarioRepository';
import { ICategoriaRepository } from '../../ports/repositories/ICategoriaRepository';
import { 
  BulkCategorizeProductsDto,
  BulkCategorizationResult,
  CategorizedProduct,
  BatchStats,
  ProductInput
} from '../../dto/ai/BulkCategorizeProductsDto';
import { Result, success, failure } from '../../../shared/result';
import { Logger } from '../../../infrastructure/observability/logger/Logger';

export class BulkCategorizeProducts {
  private readonly logger = new Logger('BulkCategorizeProducts');
  private readonly MAX_SUB_BATCH_SIZE = 20; // Optimización de tokens

  constructor(
    private readonly aiService: IAIService,
    private readonly usuarioRepository: IUsuarioRepository,
    private readonly categoriaRepository: ICategoriaRepository
  ) {}

  /**
   * Ejecuta la categorización masiva de productos
   * @param dto Datos de entrada validados
   * @param userId ID del usuario que solicita la categorización
   * @returns Result con productos categorizados y estadísticas
   */
  async execute(
    dto: BulkCategorizeProductsDto,
    userId: string
  ): Promise<Result<BulkCategorizationResult>> {
    const startTime = Date.now();

    try {
      this.logger.info('Iniciando categorización masiva', {
        userId,
        productsCount: dto.products.length,
        tiendaId: dto.tiendaId,
        enrichWithExisting: dto.enrichWithExistingCategories
      });

      // 1. Verificar que el usuario existe
      const userResult = await this.usuarioRepository.findById(userId);
      if (userResult.isFailure) {
        this.logger.warn('Usuario no encontrado para categorización masiva', { userId });
        return failure(new Error('Usuario no encontrado'));
      }

      // 2. Obtener categorías existentes de BD si se solicita enriquecimiento
      let existingCategories: string[] = [];
      if (dto.enrichWithExistingCategories && dto.tiendaId) {
        existingCategories = await this.fetchExistingCategories(dto.tiendaId);
      }

      // 3. Dividir en sub-batches para optimización de tokens
      const subBatches = this.splitIntoSubBatches(dto.products);
      
      this.logger.info('Productos divididos en sub-batches', {
        subBatchesCount: subBatches.length,
        subBatchSize: this.MAX_SUB_BATCH_SIZE
      });

      // 4. Procesar cada sub-batch
      const allResults: CategorizedProduct[] = [];
      let totalTokens = 0;

      for (let i = 0; i < subBatches.length; i++) {
        const batch = subBatches[i];
        
        if (!batch || batch.length === 0) {
          continue; // Skip empty batches
        }

        const batchStartTime = Date.now();

        this.logger.info(`Procesando sub-batch ${i + 1}/${subBatches.length}`, {
          productsInBatch: batch.length
        });

        try {
          // Llamar a AI service (con cache automático via CachedAIService)
          const aiResponse = await this.aiService.bulkCategorizeProducts(
            batch,
            existingCategories
          );

          // Parsear y procesar respuesta
          const batchResults = await this.processAIResponse(
            aiResponse,
            batch,
            dto.tiendaId || 'default',
            Date.now() - batchStartTime
          );

          allResults.push(...batchResults.products);
          totalTokens += batchResults.estimatedTokens;

        } catch (error) {
          // Partial failure: marcar productos del batch como error
          this.logger.error(`Error en sub-batch ${i + 1}`, {
            error: error instanceof Error ? error.message : String(error),
            productsInBatch: batch.length
          });

          const errorProducts = batch.map(p => ({
            nombre: p.nombre,
            alternativeCategories: [],
            source: 'error' as const,
            error: error instanceof Error ? error.message : 'Unknown error',
            processingTimeMs: Date.now() - batchStartTime
          }));

          allResults.push(...errorProducts);
        }
      }

      // 5. Calcular estadísticas del batch completo
      const stats = this.calculateBatchStats(allResults, totalTokens);

      const totalProcessingTime = Date.now() - startTime;

      this.logger.info('Categorización masiva completada', {
        totalProducts: allResults.length,
        successful: stats.successful,
        failed: stats.failed,
        fromCache: stats.fromCache,
        fromAI: stats.fromAI,
        averageConfidence: stats.averageConfidence,
        totalProcessingTime,
        estimatedTokens: totalTokens
      });

      // 6. Retornar resultado exitoso
      return success({
        categorizedProducts: allResults,
        batchStats: {
          ...stats,
          totalProcessingTimeMs: totalProcessingTime
        }
      });

    } catch (error) {
      const totalProcessingTime = Date.now() - startTime;
      
      this.logger.error('Error fatal en categorización masiva', {
        error: error instanceof Error ? error.message : String(error),
        userId,
        productsCount: dto.products.length,
        totalProcessingTime
      });

      return failure(
        new Error(
          error instanceof Error ? error.message : 'Error desconocido en categorización masiva'
        )
      );
    }
  }

  /**
   * Obtiene categorías existentes de la BD para una tienda
   */
  private async fetchExistingCategories(tiendaId: string): Promise<string[]> {
    try {
      const categoriesResult = await this.categoriaRepository.findByTienda(tiendaId);

      if (categoriesResult.isSuccess) {
        const categories = categoriesResult.value.map(cat => cat.nombre);
        
        this.logger.info('Categorías existentes obtenidas', {
          tiendaId,
          count: categories.length
        });

        return categories;
      }

      return [];
    } catch (error) {
      this.logger.warn('Error al obtener categorías existentes', {
        tiendaId,
        error: error instanceof Error ? error.message : String(error)
      });
      
      return [];
    }
  }

  /**
   * Divide productos en sub-batches de tamaño óptimo
   */
  private splitIntoSubBatches(products: ProductInput[]): ProductInput[][] {
    const subBatches: ProductInput[][] = [];

    for (let i = 0; i < products.length; i += this.MAX_SUB_BATCH_SIZE) {
      subBatches.push(products.slice(i, i + this.MAX_SUB_BATCH_SIZE));
    }

    return subBatches;
  }

  /**
   * Procesa la respuesta JSON de la IA y la convierte a CategorizedProduct[]
   */
  private async processAIResponse(
    aiResponse: string,
    originalProducts: ProductInput[],
    tiendaId: string,
    processingTimeMs: number
  ): Promise<{ products: CategorizedProduct[]; estimatedTokens: number }> {
    try {
      const parsed = JSON.parse(aiResponse);

      // Verificar si viene de cache
      const fromCache = parsed._fromCache === true;

      if (!parsed.products || !Array.isArray(parsed.products)) {
        throw new Error('Respuesta de IA con estructura inválida');
      }

      // Mapear productos de respuesta IA a CategorizedProduct
      const categorizedProducts: CategorizedProduct[] = parsed.products.map((product: any) => {
        const source = fromCache ? 'cache' : 'ai';

        return {
          nombre: product.nombre,
          suggestedCategory: product.suggestedCategory ? {
            nombre: product.suggestedCategory.nombre,
            tiendaId,
            confidence: product.suggestedCategory.confidence
          } : undefined,
          alternativeCategories: product.alternativeCategories || [],
          source,
          processingTimeMs: fromCache ? 0 : processingTimeMs
        };
      });

      // Verificar que todos los productos originales estén en la respuesta
      const missingProducts = originalProducts.filter(
        original => !categorizedProducts.some(cat => cat.nombre === original.nombre)
      );

      // Añadir productos faltantes como error
      if (missingProducts.length > 0) {
        this.logger.warn('Productos faltantes en respuesta de IA', {
          missingCount: missingProducts.length
        });

        missingProducts.forEach(product => {
          categorizedProducts.push({
            nombre: product.nombre,
            alternativeCategories: [],
            source: 'error',
            error: 'Producto no categorizado por IA',
            processingTimeMs
          });
        });
      }

      // Estimar tokens usados (aproximación)
      const estimatedTokens = fromCache ? 0 : Math.ceil(aiResponse.length / 4);

      return {
        products: categorizedProducts,
        estimatedTokens
      };

    } catch (error) {
      this.logger.error('Error al parsear respuesta de IA', {
        error: error instanceof Error ? error.message : String(error),
        responsePreview: aiResponse.substring(0, 200)
      });

      // Retornar productos como error en caso de fallo de parsing
      return {
        products: originalProducts.map(p => ({
          nombre: p.nombre,
          alternativeCategories: [],
          source: 'error' as const,
          error: 'Error al procesar respuesta de IA',
          processingTimeMs
        })),
        estimatedTokens: 0
      };
    }
  }

  /**
   * Calcula estadísticas del batch completo
   */
  private calculateBatchStats(
    products: CategorizedProduct[],
    totalTokens: number
  ): Omit<BatchStats, 'totalProcessingTimeMs'> {
    const successful = products.filter(p => p.source !== 'error').length;
    const failed = products.length - successful;
    const fromCache = products.filter(p => p.source === 'cache').length;
    const fromAI = products.filter(p => p.source === 'ai').length;
    const fromExisting = products.filter(p => p.source === 'existing').length;

    // Calcular confianza promedio (solo productos exitosos con categoría sugerida)
    const confidences = products
      .filter(p => p.suggestedCategory !== undefined)
      .map(p => p.suggestedCategory!.confidence);

    const averageConfidence = confidences.length > 0
      ? confidences.reduce((sum, c) => sum + c, 0) / confidences.length
      : 0;

    // Generar advertencias
    const warnings: string[] = [];
    if (failed > 0) {
      warnings.push(`${failed} producto(s) fallaron en categorización`);
    }
    if (averageConfidence < 60) {
      warnings.push('Confianza promedio baja (<60%)');
    }

    const result: Omit<BatchStats, 'totalProcessingTimeMs'> = {
      totalProducts: products.length,
      successful,
      failed,
      fromCache,
      fromAI,
      fromExisting,
      averageConfidence: Math.round(averageConfidence * 100) / 100,
      estimatedTokens: totalTokens
    };

    if (warnings.length > 0) {
      result.warnings = warnings;
    }

    return result;
  }
}
