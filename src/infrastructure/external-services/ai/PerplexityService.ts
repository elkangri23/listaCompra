/**
 * Implementación del adaptador para Perplexity AI
 * Implementa el puerto IAIService para categorización de productos
 */

import axios from 'axios';
import { 
  IAIService, 
  CategorySuggestion, 
  PurchaseInsight, 
  ProductRecommendation,
  AIAnalysisRequest,
  AIAnalysisResponse,
  PurchaseHistoryData,
  TimeRange,
  ProductInList,
  UserPreferences,
  APIUsageInfo
} from '../../../application/ports/external/IAIService';
import { PerplexityConfig, AI_USE_CASES } from '../../config/ai.config';
import { Logger } from '../../observability/logger/Logger';
import { CacheService, CacheKeyBuilder, CACHE_TTL } from '../cache/RedisCacheService';

export class PerplexityService implements IAIService {
  private readonly logger = new Logger('PerplexityService');
  private readonly httpClient: any;
  private readonly config: PerplexityConfig;
  private readonly cacheService: CacheService | undefined;

  constructor(config: PerplexityConfig, cacheService?: CacheService) {
    this.config = config;
    this.cacheService = cacheService;
    this.httpClient = axios.create({
      baseURL: config.apiUrl,
      timeout: config.timeout,
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    this.logger.ai('PerplexityService inicializado', {
      model: config.model,
      timeout: config.timeout,
      cacheEnabled: config.cache.enabled
    });
  }

  /**
   * Sugiere categorías para un producto usando Perplexity AI
   */
  async suggestCategories(
    productName: string,
    storeName?: string,
    existingCategories?: string[]
  ): Promise<CategorySuggestion[]> {
    try {
      // Intentar obtener del cache primero
      if (this.cacheService) {
        const cacheKey = CacheKeyBuilder.buildCategorySuggestionsKey(
          productName,
          storeName,
          existingCategories
        );

        const cached = await this.cacheService.get<CategorySuggestion[]>(cacheKey);
        if (cached) {
          this.logger.ai('Sugerencias obtenidas del cache', {
            productName,
            cacheKey,
            suggestionsCount: cached.length
          });
          return cached;
        }
      }

      this.logger.ai('Solicitando sugerencias de categorías a Perplexity', {
        productName,
        storeName,
        existingCategoriesCount: existingCategories?.length || 0
      });

      const prompt = this.buildCategoryPrompt(productName, storeName, existingCategories);
      
      const response = await this.callPerplexityAPI(
        prompt,
        AI_USE_CASES.CATEGORY_SUGGESTIONS.temperature,
        AI_USE_CASES.CATEGORY_SUGGESTIONS.maxTokens
      );

      const suggestions = this.parseCategorySuggestions(response);

      // Almacenar en cache si está disponible
      if (this.cacheService && suggestions.length > 0) {
        const cacheKey = CacheKeyBuilder.buildCategorySuggestionsKey(
          productName,
          storeName,
          existingCategories
        );

        await this.cacheService.set(cacheKey, suggestions, CACHE_TTL.CATEGORY_SUGGESTIONS);
        this.logger.ai('Sugerencias almacenadas en cache', {
          productName,
          cacheKey,
          ttl: CACHE_TTL.CATEGORY_SUGGESTIONS
        });
      }

      this.logger.ai('Sugerencias obtenidas exitosamente', {
        productName,
        suggestionsCount: suggestions.length,
        avgConfidence: suggestions.reduce((acc, s) => acc + s.confidence, 0) / suggestions.length
      });

      return suggestions;

    } catch (error) {
      this.logger.error('Error al obtener sugerencias de categorías', error as Error, {
        productName,
        storeName
      });
      
      // En caso de error, devolver sugerencias por defecto basadas en heurísticas
      return this.getFallbackCategorySuggestions(productName);
    }
  }

  /**
   * Analiza hábitos de compra (implementación básica)
   */
  async analyzePurchaseHabits(
    purchaseHistory: PurchaseHistoryData[],
    timeRange: TimeRange
  ): Promise<PurchaseInsight[]> {
    try {
      this.logger.ai('Analizando hábitos de compra', {
        historyCount: purchaseHistory.length,
        timeRange: `${timeRange.start} - ${timeRange.end}`
      });

      const prompt = this.buildPurchaseAnalysisPrompt(purchaseHistory, timeRange);
      
      const response = await this.callPerplexityAPI(
        prompt,
        AI_USE_CASES.PURCHASE_ANALYSIS.temperature,
        AI_USE_CASES.PURCHASE_ANALYSIS.maxTokens
      );

      return this.parsePurchaseInsights(response);

    } catch (error) {
      this.logger.error('Error al analizar hábitos de compra', error as Error);
      return [];
    }
  }

  /**
   * Recomienda productos (implementación básica)
   */
  async recommendProducts(
    userId: string,
    currentList?: ProductInList[],
    preferences?: UserPreferences
  ): Promise<ProductRecommendation[]> {
    try {
      this.logger.ai('Generando recomendaciones de productos', { userId });

      const prompt = this.buildProductRecommendationPrompt(currentList, preferences);
      
      const response = await this.callPerplexityAPI(
        prompt,
        AI_USE_CASES.PRODUCT_RECOMMENDATIONS.temperature,
        AI_USE_CASES.PRODUCT_RECOMMENDATIONS.maxTokens
      );

      return this.parseProductRecommendations(response);

    } catch (error) {
      this.logger.error('Error al generar recomendaciones', error as Error, { userId });
      return [];
    }
  }

  /**
   * Análisis genérico con IA
   */
  async analyzeWithAI(request: AIAnalysisRequest): Promise<AIAnalysisResponse> {
    try {
      this.logger.ai('Análisis genérico de IA', { 
        promptLength: request.prompt.length,
        hasContext: !!request.context 
      });

      const response = await this.callPerplexityAPI(
        request.prompt,
        request.temperature || this.config.temperature,
        request.maxTokens || this.config.maxTokens
      );

      return {
        content: response.content,
        tokensUsed: 0, // Perplexity no devuelve esta info fácilmente
        model: this.config.model,
        timestamp: new Date(),
        cached: false
      };

    } catch (error) {
      this.logger.error('Error en análisis genérico', error as Error);
      throw error;
    }
  }

  /**
   * Verifica disponibilidad del servicio
   */
  async isAvailable(): Promise<boolean> {
    try {
      const testPrompt = "Test de conectividad. Responde únicamente 'OK'.";
      await this.callPerplexityAPI(testPrompt, 0.1, 50);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Obtiene información de uso de la API
   */
  async getUsageInfo(): Promise<APIUsageInfo> {
    // Perplexity no proporciona endpoint de usage por ahora
    // Implementación básica
    return {
      provider: 'perplexity',
      tokensUsed: 0,
      tokensRemaining: 1000000, // valor estimado
      requestsThisMonth: 0,
      rateLimitRemaining: this.config.rateLimit.requestsPerMinute,
      resetTime: new Date(Date.now() + 60000), // próximo minuto
      costEstimate: 0
    };
  }

  /**
   * Llama a la API de Perplexity
   */
  private async callPerplexityAPI(
    prompt: string,
    temperature: number,
    maxTokens: number
  ): Promise<{ content: string; confidence?: number }> {
    try {
      const requestBody = {
        model: this.config.model,
        messages: [
          {
            role: 'system',
            content: AI_USE_CASES.CATEGORY_SUGGESTIONS.systemPrompt
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature,
        max_tokens: maxTokens,
        return_citations: false,
        return_images: false
      };

      this.logger.ai('Llamada a Perplexity API', {
        model: this.config.model,
        temperature,
        maxTokens,
        promptLength: prompt.length
      });

      const response = await this.httpClient.post('/chat/completions', requestBody);

      const content = response.data?.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error('Respuesta vacía de Perplexity API');
      }

      this.logger.ai('Respuesta recibida de Perplexity', {
        responseLength: content.length,
        usage: response.data?.usage
      });

      return { content };

    } catch (error: any) {
      if (axios.isAxiosError && axios.isAxiosError(error)) {
        this.logger.error('Error HTTP en Perplexity API', new Error(error.message), {
          status: error.response?.status,
          data: error.response?.data,
          config: {
            url: error.config?.url,
            method: error.config?.method
          }
        });
      } else {
        this.logger.error('Error inesperado en Perplexity API', error instanceof Error ? error : new Error(String(error)));
      }
      throw error;
    }
  }

  /**
   * Construye el prompt para sugerencias de categorías
   */
  private buildCategoryPrompt(
    productName: string,
    storeName?: string,
    existingCategories?: string[]
  ): string {
    let prompt = `Necesito categorizar el producto "${productName}" para una lista de compras.`;

    if (storeName) {
      prompt += ` La compra será en ${storeName}.`;
    }

    if (existingCategories && existingCategories.length > 0) {
      prompt += ` Categorías ya existentes: ${existingCategories.join(', ')}.`;
    }

    prompt += `

Proporciona 3-5 sugerencias de categorías apropiadas en español, con:
1. Nombre de categoría (máximo 30 caracteres)
2. Nivel de confianza (0.0 a 1.0)
3. Breve explicación

Formato JSON:
[
  {
    "category": "Nombre de categoría",
    "confidence": 0.9,
    "reasoning": "Explicación breve"
  }
]

Considera categorías típicas de supermercado como: Frutas y Verduras, Carnes y Pescados, Lácteos, Panadería, Bebidas, Limpieza, Higiene Personal, Congelados, Conservas, Snacks.`;

    return prompt;
  }

  /**
   * Parsea la respuesta de categorías de Perplexity
   */
  private parseCategorySuggestions(response: { content: string }): CategorySuggestion[] {
    try {
      // Intentar extraer JSON de la respuesta
      const jsonMatch = response.content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error('No se encontró JSON válido en la respuesta');
      }

      const suggestions = JSON.parse(jsonMatch[0]);
      
      return suggestions.map((s: any) => ({
        category: s.category || 'Otros',
        confidence: Math.min(Math.max(s.confidence || 0.5, 0), 1),
        reasoning: s.reasoning
      }));

    } catch (error) {
      this.logger.warn('Error parseando respuesta de categorías, usando fallback', {
        error: (error as Error).message,
        response: response.content.substring(0, 200)
      });

      // Fallback: extraer categorías con regex simple
      return this.extractCategoriesWithRegex(response.content);
    }
  }

  /**
   * Extrae categorías usando regex como fallback
   */
  private extractCategoriesWithRegex(content: string): CategorySuggestion[] {
    const categoryPattern = /(?:categoría|category)[:\s]+([^\n,]{3,30})/gi;
    const matches = content.match(categoryPattern);
    
    if (!matches) {
      return this.getFallbackCategorySuggestions('');
    }

    return matches.slice(0, 3).map((match, index) => ({
      category: match.replace(/(?:categoría|category)[:\s]+/i, '').trim(),
      confidence: 0.7 - (index * 0.1),
      reasoning: 'Extraído automáticamente'
    }));
  }

  /**
   * Proporciona sugerencias de fallback basadas en heurísticas
   */
  private getFallbackCategorySuggestions(productName: string): CategorySuggestion[] {
    const productLower = productName.toLowerCase();
    
    const categoryRules = [
      { keywords: ['manzana', 'pera', 'plátano', 'naranja', 'fruta'], category: 'Frutas y Verduras', confidence: 0.9 },
      { keywords: ['leche', 'yogur', 'queso', 'mantequilla'], category: 'Lácteos', confidence: 0.9 },
      { keywords: ['pollo', 'carne', 'pescado', 'jamón'], category: 'Carnes y Pescados', confidence: 0.9 },
      { keywords: ['pan', 'panecillo', 'bollería'], category: 'Panadería', confidence: 0.9 },
      { keywords: ['agua', 'refresco', 'zumo', 'cerveza'], category: 'Bebidas', confidence: 0.8 },
      { keywords: ['detergente', 'suavizante', 'limpiar'], category: 'Limpieza', confidence: 0.8 },
      { keywords: ['champú', 'jabón', 'pasta'], category: 'Higiene Personal', confidence: 0.8 }
    ];

    for (const rule of categoryRules) {
      if (rule.keywords.some(keyword => productLower.includes(keyword))) {
        return [{
          category: rule.category,
          confidence: rule.confidence,
          reasoning: 'Categorización automática basada en palabras clave'
        }];
      }
    }

    return [{
      category: 'Otros',
      confidence: 0.5,
      reasoning: 'Categoría por defecto'
    }];
  }

  /**
   * Construye prompt para análisis de hábitos (implementación básica)
   */
  private buildPurchaseAnalysisPrompt(
    purchaseHistory: PurchaseHistoryData[],
    timeRange: TimeRange
  ): string {
    return `Analiza los siguientes hábitos de compra en el período ${timeRange.start} - ${timeRange.end}:
    
${purchaseHistory.map(p => `- ${p.productName} (${p.quantity} unidades, ${p.price ? p.price + '€' : 'precio no disponible'})`).join('\n')}

Proporciona insights sobre frecuencia, patrones estacionales y recomendaciones de optimización.`;
  }

  /**
   * Parsea insights de hábitos de compra (implementación básica)
   */
  private parsePurchaseInsights(response: { content: string }): PurchaseInsight[] {
    return [{
      type: 'frequency',
      title: 'Análisis generado',
      description: response.content.substring(0, 200),
      confidence: 0.7
    }];
  }

  /**
   * Construye prompt para recomendaciones (implementación básica)
   */
  private buildProductRecommendationPrompt(
    currentList?: ProductInList[],
    preferences?: UserPreferences
  ): string {
    let prompt = 'Recomienda productos para una lista de compras.';
    
    if (currentList && currentList.length > 0) {
      prompt += ` Lista actual: ${currentList.map(p => p.name).join(', ')}.`;
    }

    if (preferences) {
      if (preferences.dietaryRestrictions && preferences.dietaryRestrictions.length > 0) {
        prompt += ` Restricciones dietéticas: ${preferences.dietaryRestrictions.join(', ')}.`;
      }
      if (preferences.preferredBrands && preferences.preferredBrands.length > 0) {
        prompt += ` Marcas preferidas: ${preferences.preferredBrands.join(', ')}.`;
      }
      if (preferences.excludedCategories && preferences.excludedCategories.length > 0) {
        prompt += ` Categorías excluidas: ${preferences.excludedCategories.join(', ')}.`;
      }
    }

    return prompt;
  }

  /**
   * Parsea recomendaciones de productos (implementación básica)
   */
  private parseProductRecommendations(response: { content: string }): ProductRecommendation[] {
    return [{
      productName: 'Producto recomendado',
      category: 'Otros',
      reasoning: response.content.substring(0, 100),
      confidence: 0.6,
      priority: 'medium'
    }];
  }
}