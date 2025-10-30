/**
 * Puerto para servicios de Inteligencia Artificial
 * Define los contratos para funcionalidades de IA en la aplicación
 */

export interface CategorySuggestion {
  category: string;
  confidence: number; // 0-1
  reasoning?: string;
}

export interface PurchaseInsight {
  type: 'frequency' | 'seasonal' | 'preference' | 'optimization';
  title: string;
  description: string;
  data?: Record<string, any>;
  confidence: number;
}

export interface ProductRecommendation {
  productName: string;
  category: string;
  reasoning: string;
  confidence: number;
  priority: 'high' | 'medium' | 'low';
}

export interface AIAnalysisRequest {
  prompt: string;
  context?: Record<string, any>;
  useCase: 'category_suggestions' | 'purchase_analysis' | 'product_recommendations';
  maxTokens?: number;
  temperature?: number;
}

export interface AIAnalysisResponse {
  content: string;
  tokensUsed: number;
  model: string;
  timestamp: Date;
  cached?: boolean;
}

/**
 * Puerto principal para servicios de IA
 */
export interface IAIService {
  /**
   * Sugiere categorías para un producto basándose en su nombre y tienda
   * @param productName Nombre del producto
   * @param storeName Nombre de la tienda (opcional)
   * @param existingCategories Categorías existentes para contexto
   * @returns Lista de sugerencias de categorías
   */
  suggestCategories(
    productName: string,
    storeName?: string,
    existingCategories?: string[]
  ): Promise<CategorySuggestion[]>;

  /**
   * Analiza hábitos de compra del usuario y proporciona insights
   * @param purchaseHistory Historial de compras del usuario
   * @param timeRange Rango temporal del análisis
   * @returns Insights sobre los hábitos de compra
   */
  analyzePurchaseHabits(
    purchaseHistory: PurchaseHistoryData[],
    timeRange: TimeRange
  ): Promise<PurchaseInsight[]>;

  /**
   * Recomienda productos basándose en el historial del usuario
   * @param userId ID del usuario
   * @param currentList Lista actual (opcional)
   * @param preferences Preferencias del usuario (opcional)
   * @returns Lista de recomendaciones de productos
   */
  recommendProducts(
    userId: string,
    currentList?: ProductInList[],
    preferences?: UserPreferences
  ): Promise<ProductRecommendation[]>;

  /**
   * Genera una lista de productos para una ocasión específica
   * @param prompt Prompt detallado con la ocasión, personas, restricciones, etc.
   * @returns Respuesta de IA con productos sugeridos en formato JSON
   */
  generateOccasionList(prompt: string): Promise<string>;

  /**
   * Genera recomendaciones contextuales de productos complementarios
   * CU-33: Recomendaciones Contextuales Automáticas
   * @param productsInList Productos actuales en la lista
   * @param context Contexto adicional (opcional: "desayuno", "cena", "vegano", etc.)
   * @param specificProductName Producto específico para recomendaciones focalizadas (opcional)
   * @param maxRecommendations Número máximo de recomendaciones (por defecto: 5)
   * @param creativityLevel Nivel de creatividad: "conservative" | "balanced" | "creative"
   * @returns Respuesta de IA con productos recomendados en formato JSON
   */
  getProductRecommendations(
    productsInList: ProductInList[],
    context?: string,
    specificProductName?: string,
    maxRecommendations?: number,
    creativityLevel?: 'conservative' | 'balanced' | 'creative'
  ): Promise<string>;

  /**
   * Análisis genérico de IA con prompt personalizado
   * @param request Solicitud de análisis con prompt y contexto
   * @returns Respuesta del modelo de IA
   */
  analyzeWithAI(request: AIAnalysisRequest): Promise<AIAnalysisResponse>;

  /**
   * Verifica la disponibilidad del servicio de IA
   * @returns true si el servicio está disponible
   */
  isAvailable(): Promise<boolean>;

  /**
   * Obtiene información sobre el uso de la API (tokens, límites, etc.)
   * @returns Información de uso actual
   */
  getUsageInfo(): Promise<APIUsageInfo>;
}

/**
 * Tipos auxiliares para los métodos del servicio
 */
export interface PurchaseHistoryData {
  productName: string;
  category: string;
  storeName: string;
  purchaseDate: Date;
  quantity: number;
  price?: number;
  frequency?: number; // veces comprado en el período
}

export interface TimeRange {
  start: Date;
  end: Date;
}

export interface ProductInList {
  name: string;
  category?: string;
  quantity: number;
  purchased: boolean;
}

export interface UserPreferences {
  dietaryRestrictions?: string[];
  preferredBrands?: string[];
  budgetRange?: {
    min: number;
    max: number;
  };
  excludedCategories?: string[];
}

export interface APIUsageInfo {
  provider: string;
  tokensUsed: number;
  tokensRemaining?: number;
  requestsThisMonth: number;
  rateLimitRemaining: number;
  resetTime?: Date;
  costEstimate?: number;
}

/**
 * Errores específicos del servicio de IA
 */
export class AIServiceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = 'AIServiceError';
  }
}

export class AIRateLimitError extends AIServiceError {
  constructor(resetTime?: Date) {
    super(
      `Rate limit exceeded${resetTime ? `. Reset at ${resetTime.toISOString()}` : ''}`,
      'RATE_LIMIT_EXCEEDED',
      429
    );
  }
}

export class AIQuotaExceededError extends AIServiceError {
  constructor() {
    super('AI service quota exceeded', 'QUOTA_EXCEEDED', 402);
  }
}

export class AIServiceUnavailableError extends AIServiceError {
  constructor() {
    super('AI service is currently unavailable', 'SERVICE_UNAVAILABLE', 503);
  }
}