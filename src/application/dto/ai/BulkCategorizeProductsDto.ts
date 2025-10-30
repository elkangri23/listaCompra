/**
 * @file BulkCategorizeProductsDto.ts
 * @description DTOs para categorización masiva de productos con IA
 * @module application/dto/ai
 */

/**
 * Input de un producto individual para categorización
 */
export interface ProductInput {
  /** Nombre del producto (1-100 caracteres) */
  nombre: string;
  /** Descripción opcional del producto (máximo 500 caracteres) */
  descripcion?: string;
}

/**
 * DTO de entrada para categorización masiva
 */
export interface BulkCategorizeProductsDto {
  /** Array de productos a categorizar (mínimo 1, máximo 50) */
  products: ProductInput[];
  /** ID de la tienda para enriquecer con categorías existentes (opcional) */
  tiendaId?: string;
  /** Si debe enriquecer con categorías existentes de la BD (default: true) */
  enrichWithExistingCategories?: boolean;
}

/**
 * Resultado de categorización de un producto individual
 */
export interface CategorizedProduct {
  /** Nombre original del producto */
  nombre: string;
  /** Categoría sugerida por IA (puede ser undefined si hubo error) */
  suggestedCategory?: {
    /** Nombre de la categoría sugerida */
    nombre: string;
    /** ID de la tienda asociada */
    tiendaId: string;
    /** Nivel de confianza 0-100 */
    confidence: number;
  };
  /** Categorías alternativas con menor confianza */
  alternativeCategories: Array<{
    /** Nombre de la categoría alternativa */
    nombre: string;
    /** Nivel de confianza 0-100 */
    confidence: number;
  }>;
  /** Fuente de la categorización */
  source: 'ai' | 'cache' | 'existing' | 'error';
  /** Mensaje de error si source='error' */
  error?: string;
  /** Tiempo de procesamiento en milisegundos */
  processingTimeMs: number;
}

/**
 * Estadísticas del batch de categorización
 */
export interface BatchStats {
  /** Total de productos procesados */
  totalProducts: number;
  /** Productos categorizados exitosamente */
  successful: number;
  /** Productos que fallaron */
  failed: number;
  /** Productos obtenidos de cache */
  fromCache: number;
  /** Productos categorizados por IA */
  fromAI: number;
  /** Productos categorizados desde categorías existentes */
  fromExisting: number;
  /** Confianza promedio de las categorizaciones (0-100) */
  averageConfidence: number;
  /** Tiempo total de procesamiento en milisegundos */
  totalProcessingTimeMs: number;
  /** Tokens estimados consumidos en llamadas a IA */
  estimatedTokens: number;
  /** Advertencias generadas durante el procesamiento */
  warnings?: string[];
}

/**
 * Resultado completo de categorización masiva
 */
export interface BulkCategorizationResult {
  /** Productos categorizados */
  categorizedProducts: CategorizedProduct[];
  /** Estadísticas del batch */
  batchStats: BatchStats;
}

/**
 * Validaciones para BulkCategorizeProductsDto
 */
export class BulkCategorizeProductsDtoValidator {
  private static readonly MIN_PRODUCTS = 1;
  private static readonly MAX_PRODUCTS = 50;
  private static readonly MAX_PRODUCT_NAME_LENGTH = 100;
  private static readonly MAX_DESCRIPTION_LENGTH = 500;
  private static readonly UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  /**
   * Valida el DTO completo
   * @throws Error si la validación falla
   */
  static validate(dto: BulkCategorizeProductsDto): void {
    this.validateProducts(dto.products);
    
    if (dto.tiendaId !== undefined) {
      this.validateTiendaId(dto.tiendaId);
    }
    
    if (dto.enrichWithExistingCategories !== undefined && 
        typeof dto.enrichWithExistingCategories !== 'boolean') {
      throw new Error('enrichWithExistingCategories must be a boolean');
    }
  }

  /**
   * Valida el array de productos
   */
  private static validateProducts(products: ProductInput[]): void {
    if (!Array.isArray(products)) {
      throw new Error('products must be an array');
    }

    if (products.length < this.MIN_PRODUCTS) {
      throw new Error(`At least ${this.MIN_PRODUCTS} product is required`);
    }

    if (products.length > this.MAX_PRODUCTS) {
      throw new Error(`Maximum ${this.MAX_PRODUCTS} products per batch`);
    }

    products.forEach((product, index) => {
      this.validateProduct(product, index);
    });
  }

  /**
   * Valida un producto individual
   */
  private static validateProduct(product: ProductInput, index: number): void {
    if (!product || typeof product !== 'object') {
      throw new Error(`Product at index ${index} must be an object`);
    }

    if (!product.nombre || typeof product.nombre !== 'string') {
      throw new Error(`Product at index ${index}: nombre is required and must be a string`);
    }

    const trimmedName = product.nombre.trim();
    if (trimmedName.length === 0) {
      throw new Error(`Product at index ${index}: nombre cannot be empty`);
    }

    if (trimmedName.length > this.MAX_PRODUCT_NAME_LENGTH) {
      throw new Error(
        `Product at index ${index}: nombre exceeds maximum length of ${this.MAX_PRODUCT_NAME_LENGTH} characters`
      );
    }

    // Validar caracteres especiales peligrosos
    if (/[<>{}[\]\\]/.test(trimmedName)) {
      throw new Error(
        `Product at index ${index}: nombre contains invalid characters`
      );
    }

    // Validar descripción si está presente
    if (product.descripcion !== undefined && product.descripcion !== null) {
      if (typeof product.descripcion !== 'string') {
        throw new Error(`Product at index ${index}: descripcion must be a string`);
      }

      if (product.descripcion.length > this.MAX_DESCRIPTION_LENGTH) {
        throw new Error(
          `Product at index ${index}: descripcion exceeds maximum length of ${this.MAX_DESCRIPTION_LENGTH} characters`
        );
      }
    }
  }

  /**
   * Valida el tiendaId
   */
  private static validateTiendaId(tiendaId: string): void {
    if (typeof tiendaId !== 'string') {
      throw new Error('tiendaId must be a string');
    }

    if (!this.UUID_REGEX.test(tiendaId)) {
      throw new Error('tiendaId must be a valid UUID');
    }
  }

  /**
   * Normaliza el DTO (trim strings, defaults, etc.)
   */
  static normalize(dto: BulkCategorizeProductsDto): BulkCategorizeProductsDto {
    const normalized: BulkCategorizeProductsDto = {
      products: dto.products.map(product => {
        const normalizedProduct: ProductInput = {
          nombre: product.nombre.trim()
        };
        if (product.descripcion !== undefined && product.descripcion !== null) {
          const trimmedDesc = product.descripcion.trim();
          if (trimmedDesc.length > 0) {
            normalizedProduct.descripcion = trimmedDesc;
          }
        }
        return normalizedProduct;
      }),
      enrichWithExistingCategories: dto.enrichWithExistingCategories ?? true
    };

    if (dto.tiendaId !== undefined) {
      const trimmedTiendaId = dto.tiendaId.trim();
      if (trimmedTiendaId.length > 0) {
        normalized.tiendaId = trimmedTiendaId;
      }
    }

    return normalized;
  }
}

/**
 * Helper para crear DTOs de forma segura
 */
export class BulkCategorizeProductsDtoFactory {
  /**
   * Crea y valida un DTO
   */
  static create(input: unknown): BulkCategorizeProductsDto {
    const dto = input as BulkCategorizeProductsDto;
    
    BulkCategorizeProductsDtoValidator.validate(dto);
    
    return BulkCategorizeProductsDtoValidator.normalize(dto);
  }

  /**
   * Crea un DTO desde request HTTP
   */
  static fromHttpRequest(body: any): BulkCategorizeProductsDto {
    if (!body || typeof body !== 'object') {
      throw new Error('Request body is required');
    }

    return this.create({
      products: body.products,
      tiendaId: body.tiendaId,
      enrichWithExistingCategories: body.enrichWithExistingCategories
    });
  }
}
