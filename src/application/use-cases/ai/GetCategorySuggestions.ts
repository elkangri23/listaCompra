/**
 * Caso de Uso: GetCategorySuggestions (CU-28)
 * Categorización automática de productos usando IA
 */

import { Result, success, failure } from '../../../shared/result';
import { IAIService, CategorySuggestion } from '../../ports/external/IAIService';
import { GetCategorySuggestionsDto, CategorySuggestionResponseDto } from '../../dto/ai/AIDto';
import { Logger } from '../../../infrastructure/observability/logger/Logger';
import { ValidationError } from '../../errors/ValidationError';
import { v4 as uuidv4 } from 'uuid';

interface GetCategorySuggestionsUseCaseDeps {
  aiService: IAIService;
}

export class GetCategorySuggestionsUseCase {
  private readonly logger = new Logger('GetCategorySuggestionsUseCase');

  constructor(private readonly deps: GetCategorySuggestionsUseCaseDeps) {}

  async execute(dto: GetCategorySuggestionsDto): Promise<Result<CategorySuggestionResponseDto>> {
    try {
      // Validar entrada
      const validationResult = this.validateInput(dto);
      if (validationResult.isFailure) {
        return failure(validationResult.error);
      }

      const requestId = uuidv4();
      this.logger.ai(`Solicitando sugerencias de categorías para producto: ${dto.productName}`, {
        requestId,
        storeName: dto.storeName,
        existingCategories: dto.existingCategories?.length || 0
      });

      // Preparar el contexto para la IA (para futuras mejoras)
      this.buildAIContext(dto);

      // Solicitar sugerencias a la IA
      const suggestions = await this.deps.aiService.suggestCategories(
        dto.productName,
        dto.storeName,
        dto.existingCategories
      );

      // Procesar y filtrar las sugerencias
      const processedSuggestions = this.processSuggestions(
        suggestions,
        dto.existingCategories
      );

      const response: CategorySuggestionResponseDto = {
        suggestions: processedSuggestions,
        productName: dto.productName,
        ...(dto.storeName && { storeName: dto.storeName }), // Solo incluir si existe
        cached: false, // El servicio no devuelve info de cache por ahora
        requestId,
        timestamp: new Date().toISOString()
      };

      this.logger.ai(`Sugerencias generadas exitosamente`, {
        requestId,
        suggestionsCount: processedSuggestions.length,
        cached: response.cached,
        avgConfidence: this.calculateAverageConfidence(processedSuggestions)
      });

      return success(response);

    } catch (error) {
      this.logger.error('Error inesperado en GetCategorySuggestions', error as Error);
      return failure(error as Error);
    }
  }

  /**
   * Validar los datos de entrada
   */
  private validateInput(dto: GetCategorySuggestionsDto): Result<void> {
    if (!dto.productName || dto.productName.trim().length === 0) {
      return failure(new ValidationError('El nombre del producto es requerido', 'productName', dto.productName));
    }

    if (dto.productName.trim().length < 2) {
      return failure(new ValidationError('El nombre del producto debe tener al menos 2 caracteres', 'productName', dto.productName));
    }

    if (dto.productName.trim().length > 100) {
      return failure(new ValidationError('El nombre del producto no puede exceder 100 caracteres', 'productName', dto.productName));
    }

    // Validar caracteres especiales o patrones sospechosos
    const suspiciousPattern = /[<>{}[\]\\\/\|\^\$\*\+\?\(\)]/;
    if (suspiciousPattern.test(dto.productName)) {
      return failure(new ValidationError('El nombre del producto contiene caracteres no válidos', 'productName', dto.productName));
    }

    // Validar storeName si se proporciona
    if (dto.storeName && dto.storeName.trim().length > 50) {
      return failure(new ValidationError('El nombre de la tienda no puede exceder 50 caracteres', 'storeName', dto.storeName));
    }

    // Validar categorías existentes
    if (dto.existingCategories) {
      if (dto.existingCategories.length > 20) {
        return failure(new ValidationError('No se pueden proporcionar más de 20 categorías existentes', 'existingCategories', dto.existingCategories.length));
      }

      for (const category of dto.existingCategories) {
        if (!category || category.trim().length === 0) {
          return failure(new ValidationError('Las categorías existentes no pueden estar vacías', 'existingCategories', category));
        }
        if (category.trim().length > 50) {
          return failure(new ValidationError('Las categorías no pueden exceder 50 caracteres', 'existingCategories', category));
        }
      }
    }

    return success(undefined);
  }

  /**
   * Construir contexto para la IA basado en los datos disponibles
   */
  private buildAIContext(dto: GetCategorySuggestionsDto): Record<string, any> {
    const context: Record<string, any> = {
      language: dto.language || 'es',
      task: 'category_suggestion',
      domain: 'grocery_shopping'
    };

    if (dto.storeName) {
      context['store'] = dto.storeName;
      context['storeContext'] = this.getStoreContext(dto.storeName);
    }

    if (dto.existingCategories && dto.existingCategories.length > 0) {
      context['existingCategories'] = dto.existingCategories;
      context['avoidDuplicates'] = true;
    }

    return context;
  }

  /**
   * Obtener contexto adicional basado en la tienda
   */
  private getStoreContext(storeName: string): string {
    const storePatterns = {
      'mercadona': 'supermercado general español',
      'carrefour': 'hipermercado con amplia variedad',
      'dia': 'supermercado de proximidad',
      'lidl': 'supermercado alemán con marcas propias',
      'aldi': 'supermercado alemán enfocado en precio',
      'eroski': 'cooperativa vasca de consumo',
      'el corte inglés': 'grandes almacenes premium'
    };

    const normalizedStore = storeName.toLowerCase();
    
    for (const [key, context] of Object.entries(storePatterns)) {
      if (normalizedStore.includes(key)) {
        return context;
      }
    }

    return 'supermercado general';
  }

  /**
   * Procesar y filtrar las sugerencias de la IA
   */
  private processSuggestions(
    suggestions: CategorySuggestion[],
    existingCategories?: string[]
  ): Array<{ category: string; confidence: number; reasoning?: string }> {
    let processed = suggestions
      // Filtrar duplicados con categorías existentes (case-insensitive)
      .filter(suggestion => {
        if (!existingCategories) return true;
        
        const normalizedSuggestion = suggestion.category.toLowerCase().trim();
        const normalizedExisting = existingCategories.map(cat => cat.toLowerCase().trim());
        
        return !normalizedExisting.includes(normalizedSuggestion);
      })
      // Filtrar sugerencias con baja confianza
      .filter(suggestion => suggestion.confidence >= 0.3)
      // Normalizar nombres de categorías
      .map(suggestion => ({
        category: this.normalizeCategoryName(suggestion.category),
        confidence: Math.round(suggestion.confidence * 100) / 100, // Redondear a 2 decimales
        ...(suggestion.reasoning && { reasoning: suggestion.reasoning }) // Solo incluir si existe
      }))
      // Ordenar por confianza descendente
      .sort((a, b) => b.confidence - a.confidence);

    // Limitar a máximo 5 sugerencias
    processed = processed.slice(0, 5);

    return processed;
  }

  /**
   * Normalizar nombres de categorías
   */
  private normalizeCategoryName(categoryName: string): string {
    return categoryName
      .trim()
      // Limpiar espacios múltiples
      .replace(/\s+/g, ' ')
      // Capitalizar primera letra de cada palabra usando split/join
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  /**
   * Calcular confianza promedio de las sugerencias
   */
  private calculateAverageConfidence(suggestions: Array<{ confidence: number }>): number {
    if (suggestions.length === 0) return 0;
    
    const sum = suggestions.reduce((acc, suggestion) => acc + suggestion.confidence, 0);
    return Math.round((sum / suggestions.length) * 100) / 100;
  }
}