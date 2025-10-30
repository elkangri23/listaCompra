// src/application/dto/products/GetProductRecommendationsDto.ts

/**
 * DTO para obtener recomendaciones contextuales de productos
 * CU-33: Recomendaciones Contextuales Automáticas
 * 
 * Este DTO permite solicitar sugerencias de productos complementarios
 * basándose en productos existentes en la lista del usuario.
 */

export interface GetProductRecommendationsDto {
  /**
   * ID de la lista para la cual se solicitan recomendaciones
   * Las recomendaciones se basan en los productos actuales de esta lista
   */
  listId: string;

  /**
   * Número máximo de recomendaciones a devolver
   * Por defecto: 5
   * Rango válido: 1-20
   */
  maxRecommendations?: number;

  /**
   * ID de producto específico para recomendaciones relacionadas
   * Si se proporciona, las recomendaciones se enfocan en complementos para este producto
   * Opcional: si no se especifica, se analizan todos los productos de la lista
   */
  productId?: string;

  /**
   * Contexto adicional para mejorar recomendaciones
   * Ejemplos: "desayuno", "cena", "postre", "vegano", "fitness"
   * Opcional: si no se especifica, se infiere del contenido de la lista
   */
  context?: string;

  /**
   * Filtrar por categoría específica
   * Si se proporciona, solo se recomiendan productos de esta categoría
   */
  categoryId?: string;

  /**
   * Filtrar por tienda específica
   * Si se proporciona, solo se recomiendan productos disponibles en esta tienda
   */
  storeId?: string;

  /**
   * Incluir productos que el usuario ha comprado frecuentemente en el pasado
   * Por defecto: true
   */
  includeUserHistory?: boolean;

  /**
   * Excluir productos que ya están en la lista
   * Por defecto: true
   */
  excludeExisting?: boolean;

  /**
   * Nivel de creatividad de las sugerencias
   * - "conservative": Solo productos muy relacionados
   * - "balanced": Mix de relacionados y exploración (por defecto)
   * - "creative": Incluye sugerencias más innovadoras
   */
  creativityLevel?: 'conservative' | 'balanced' | 'creative';
}

/**
 * DTO de respuesta para una recomendación individual
 */
export interface ProductRecommendationDto {
  /**
   * Nombre del producto recomendado
   */
  name: string;

  /**
   * Razón de la recomendación (generada por IA)
   * Ejemplo: "Complementa bien con la pasta que agregaste"
   */
  reason: string;

  /**
   * Score de confianza de la recomendación (0-100)
   * Mayor score = mayor relevancia
   */
  confidenceScore: number;

  /**
   * Categoría sugerida para el producto
   */
  suggestedCategory?: {
    id: string;
    name: string;
  };

  /**
   * Precio estimado (si está disponible)
   */
  estimatedPrice?: number;

  /**
   * Cantidad sugerida
   */
  suggestedQuantity: number;

  /**
   * Unidad de medida sugerida
   */
  suggestedUnit: string;

  /**
   * Productos relacionados que ya están en la lista
   * Usado para explicar la recomendación
   */
  relatedProducts: string[];

  /**
   * Tags/etiquetas para categorización adicional
   * Ejemplos: ["saludable", "vegano", "sin gluten"]
   */
  tags?: string[];

  /**
   * Indicador si este producto es frecuentemente comprado por el usuario
   */
  fromUserHistory: boolean;

  /**
   * Tipo de recomendación
   * - "complement": Producto complementario directo
   * - "frequently_together": Productos comprados juntos frecuentemente
   * - "category_match": Productos de la misma categoría/contexto
   * - "user_preference": Basado en historial del usuario
   */
  recommendationType: 'complement' | 'frequently_together' | 'category_match' | 'user_preference';
}

/**
 * DTO de respuesta completa para recomendaciones
 */
export interface GetProductRecommendationsResponseDto {
  /**
   * ID de la lista para la cual se generaron recomendaciones
   */
  listId: string;

  /**
   * Lista de recomendaciones ordenadas por relevancia
   */
  recommendations: ProductRecommendationDto[];

  /**
   * Contexto detectado de la lista
   * Ejemplo: "Comida italiana", "Desayuno saludable"
   */
  detectedContext?: string;

  /**
   * Número total de productos en la lista analizada
   */
  productsInList: number;

  /**
   * Metadata adicional sobre las recomendaciones
   */
  metadata: {
    /**
     * Tiempo de procesamiento en milisegundos
     */
    processingTime: number;

    /**
     * Si se usó IA o reglas básicas
     */
    aiUsed: boolean;

    /**
     * Versión del algoritmo de recomendaciones
     */
    algorithmVersion: string;

    /**
     * Score promedio de confianza de todas las recomendaciones
     */
    averageConfidence: number;
  };
}

/**
 * Función de validación para GetProductRecommendationsDto
 */
export function validateGetProductRecommendationsDto(
  dto: GetProductRecommendationsDto
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validar listId (requerido)
  if (!dto.listId || typeof dto.listId !== 'string' || dto.listId.trim() === '') {
    errors.push('listId es requerido y debe ser un string válido');
  }

  // Validar maxRecommendations (opcional, pero con límites)
  if (dto.maxRecommendations !== undefined) {
    if (typeof dto.maxRecommendations !== 'number') {
      errors.push('maxRecommendations debe ser un número');
    } else if (dto.maxRecommendations < 1 || dto.maxRecommendations > 20) {
      errors.push('maxRecommendations debe estar entre 1 y 20');
    } else if (!Number.isInteger(dto.maxRecommendations)) {
      errors.push('maxRecommendations debe ser un número entero');
    }
  }

  // Validar productId (opcional, pero debe ser string válido si existe)
  if (dto.productId !== undefined && (typeof dto.productId !== 'string' || dto.productId.trim() === '')) {
    errors.push('productId debe ser un string válido si se proporciona');
  }

  // Validar context (opcional, pero debe ser string válido si existe)
  if (dto.context !== undefined) {
    if (typeof dto.context !== 'string' || dto.context.trim() === '') {
      errors.push('context debe ser un string válido si se proporciona');
    } else if (dto.context.length > 100) {
      errors.push('context no debe exceder 100 caracteres');
    }
  }

  // Validar categoryId (opcional)
  if (dto.categoryId !== undefined && (typeof dto.categoryId !== 'string' || dto.categoryId.trim() === '')) {
    errors.push('categoryId debe ser un string válido si se proporciona');
  }

  // Validar storeId (opcional)
  if (dto.storeId !== undefined && (typeof dto.storeId !== 'string' || dto.storeId.trim() === '')) {
    errors.push('storeId debe ser un string válido si se proporciona');
  }

  // Validar includeUserHistory (opcional, booleano)
  if (dto.includeUserHistory !== undefined && typeof dto.includeUserHistory !== 'boolean') {
    errors.push('includeUserHistory debe ser un booleano');
  }

  // Validar excludeExisting (opcional, booleano)
  if (dto.excludeExisting !== undefined && typeof dto.excludeExisting !== 'boolean') {
    errors.push('excludeExisting debe ser un booleano');
  }

  // Validar creativityLevel (opcional, enum específico)
  if (dto.creativityLevel !== undefined) {
    const validLevels = ['conservative', 'balanced', 'creative'];
    if (!validLevels.includes(dto.creativityLevel)) {
      errors.push(`creativityLevel debe ser uno de: ${validLevels.join(', ')}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Valores por defecto para campos opcionales
 */
export const DEFAULT_RECOMMENDATIONS_CONFIG = {
  maxRecommendations: 5,
  includeUserHistory: true,
  excludeExisting: true,
  creativityLevel: 'balanced' as const,
} as const;

/**
 * Helper para aplicar valores por defecto
 */
export function applyRecommendationsDefaults(
  dto: GetProductRecommendationsDto
): Required<Omit<GetProductRecommendationsDto, 'productId' | 'context' | 'categoryId' | 'storeId'>> & 
  Pick<GetProductRecommendationsDto, 'productId' | 'context' | 'categoryId' | 'storeId'> {
  return {
    ...dto,
    maxRecommendations: dto.maxRecommendations ?? DEFAULT_RECOMMENDATIONS_CONFIG.maxRecommendations,
    includeUserHistory: dto.includeUserHistory ?? DEFAULT_RECOMMENDATIONS_CONFIG.includeUserHistory,
    excludeExisting: dto.excludeExisting ?? DEFAULT_RECOMMENDATIONS_CONFIG.excludeExisting,
    creativityLevel: dto.creativityLevel ?? DEFAULT_RECOMMENDATIONS_CONFIG.creativityLevel,
  };
}
