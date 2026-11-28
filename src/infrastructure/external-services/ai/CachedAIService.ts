/**
 * Adaptador de IA con Cache
 * Combina el servicio de Perplexity con cache Redis para optimizar costos
 */

import { PerplexityService } from './PerplexityService';
import { RedisCacheService } from '../cache/RedisCacheService';
import { RedisCacheAnalytics } from '../cache/RedisCacheAnalytics';
import type { PerplexityConfig } from '../../config/ai.config';
import type { RedisConfig } from '../../config/redis.config';
import type { RedisClientType } from 'redis';
import { Logger } from '../../observability/logger/Logger';
import type { IAIUsageRecorder } from '../../../application/ports/external/IAIUsageRecorder';
import type {
  IAIService,
  CategorySuggestion,
  PastCategoryExample,
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

export interface CachedAIServiceDependencies {
  aiConfig: PerplexityConfig;
  redisConfig?: RedisConfig; // Opcional - si no se proporciona, no usa cache
  usageRecorder?: IAIUsageRecorder; // Opcional - registra el uso real de IA
}

export class CachedAIService implements IAIService {
  private readonly logger = new Logger('CachedAIService');
  private readonly perplexityService: PerplexityService;
  private readonly aiConfig: PerplexityConfig;
  private readonly usageRecorder: IAIUsageRecorder | undefined;
  private readonly cacheService?: RedisCacheService;
  private readonly cacheAnalytics?: RedisCacheAnalytics;

  constructor(dependencies: CachedAIServiceDependencies) {
    const { aiConfig, redisConfig, usageRecorder } = dependencies;
    this.aiConfig = aiConfig;
    this.usageRecorder = usageRecorder;

    // Inicializar cache si se proporciona configuración
    if (redisConfig) {
      this.cacheService = new RedisCacheService(redisConfig);
      this.cacheAnalytics = new RedisCacheAnalytics(this.cacheService);
    }

    // Inicializar servicio de IA con cache opcional
    // El recorder se reenvía al PerplexityService interno: es él quien
    // registra las llamadas reales al modelo (el bulk de producción
    // pasa por aquí solo en AnalyzePurchaseHabits/CreateOccasionList).
    this.perplexityService = new PerplexityService(aiConfig, this.cacheService, this.usageRecorder);
  }

  /**
   * Inicializa los servicios (cache Redis)
   */
  async initialize(): Promise<void> {
    if (this.cacheService) {
      try {
        await this.cacheService.initialize();
        this.logger.info('Cache Redis inicializado correctamente');
      } catch (error) {
        this.logger.warn('Error al inicializar cache Redis, continuando sin cache', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    } else {
      this.logger.info('Servicio de IA inicializado sin cache');
    }
  }

  /**
   * Sugiere categorías para un producto
   */
  async suggestCategories(
    productName: string,
    storeName?: string,
    existingCategories?: string[],
    pastExamples?: PastCategoryExample[],
    storeContext?: string
  ): Promise<CategorySuggestion[]> {
    return await this.perplexityService.suggestCategories(
      productName,
      storeName,
      existingCategories,
      pastExamples,
      storeContext
    );
  }

  /**
   * Analiza hábitos de compra
   */
  async analyzePurchaseHabits(
    purchaseHistory: PurchaseHistoryData[],
    timeRange: TimeRange
  ): Promise<PurchaseInsight[]> {
    return await this.perplexityService.analyzePurchaseHabits(
      purchaseHistory,
      timeRange
    );
  }

  /**
   * Recomienda productos
   */
  async recommendProducts(
    userId: string,
    currentList?: ProductInList[],
    preferences?: UserPreferences
  ): Promise<ProductRecommendation[]> {
    return await this.perplexityService.recommendProducts(
      userId,
      currentList,
      preferences
    );
  }

  /**
   * Análisis genérico con IA
   */
  async analyzeWithAI(request: AIAnalysisRequest): Promise<AIAnalysisResponse> {
    return await this.perplexityService.analyzeWithAI(request);
  }

  /**
   * Genera lista de productos para una ocasión específica
   */
  async generateOccasionList(prompt: string): Promise<string> {
    return await this.perplexityService.generateOccasionList(prompt);
  }

  /**
   * Genera recomendaciones contextuales de productos complementarios
   * CU-33: Recomendaciones Contextuales Automáticas
   */
  async getProductRecommendations(
    productsInList: ProductInList[],
    context?: string,
    specificProductName?: string,
    maxRecommendations?: number,
    creativityLevel?: 'conservative' | 'balanced' | 'creative'
  ): Promise<string> {
    return await this.perplexityService.getProductRecommendations(
      productsInList,
      context,
      specificProductName,
      maxRecommendations,
      creativityLevel
    );
  }

  /**
   * Categoriza múltiples productos en lote de forma optimizada
   * CU-29: Categorización Masiva Inteligente
   */
  async bulkCategorizeProducts(
    products: Array<{ nombre: string; descripcion?: string }>,
    existingCategories?: string[]
  ): Promise<string> {
    // Cache key basado en hash de nombres de productos
    const productNames = products.map(p => p.nombre).sort().join('|');
    const categoriesKey = existingCategories?.sort().join('|') || '';
    const cacheKey = `ai:bulk-categorize:${this.hashString(productNames + categoriesKey)}`;

    // Intentar obtener de cache
    if (this.cacheService) {
      try {
        const cached = await this.cacheService.get<string>(cacheKey);
        if (cached) {
          this.logger.info('Categorización masiva obtenida de cache', {
            productsCount: products.length,
            cacheKey: cacheKey.substring(0, 50) + '...'
          });

          // Cache hit de bulk: no hay llamada al modelo; se registra
          // como evento con cached=true (el PerplexityService interno
          // no se ejecuta en este camino y no registraría nada).
          await this.recordBulkCacheHit();

          // Marcar como source 'cache' en metadata
          const parsed: any = JSON.parse(cached);
          return JSON.stringify({
            ...parsed,
            _fromCache: true
          });
        }
      } catch (error) {
        this.logger.warn('Error al leer cache de categorización masiva', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    // Cache miss: llamar a PerplexityService
    const result = await this.perplexityService.bulkCategorizeProducts(
      products,
      existingCategories
    );

    // Guardar en cache (TTL 24 horas)
    if (this.cacheService && result) {
      try {
        await this.cacheService.set(cacheKey, result, 86400); // 24 horas
        this.logger.info('Categorización masiva guardada en cache', {
          productsCount: products.length,
          ttl: 86400
        });
      } catch (error) {
        this.logger.warn('Error al guardar cache de categorización masiva', {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return result;
  }

  /**
   * Cliente Redis subyacente (o null si el cache no está disponible/disabled)
   * Expuesto para servicios de administración (ej. integridad de cache)
   */
  get cacheClient(): RedisClientType | null {
    return this.cacheService?.getClient() ?? null;
  }

  /**
   * Genera hash simple de una cadena (para cache keys)
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Verifica disponibilidad del servicio
   */
  async isAvailable(): Promise<boolean> {
    const aiAvailable = await this.perplexityService.isAvailable();
    
    if (this.cacheService) {
      const cacheAvailable = await this.cacheService.isAvailable();
      this.logger.debug('Estado de servicios', { 
        ai: aiAvailable, 
        cache: cacheAvailable 
      });
    }

    return aiAvailable; // El cache es opcional
  }

  /**
   * Obtiene información de uso
   *
   * NOTA (panel admin, fase 3): el uso REAL viene de la tabla
   * `ai_usage_events` (GET /ai/usage, caso de uso GetAIUsage). Este
   * método se queda como está porque quitarlo del puerto IAIService
   * rompería todos sus dobles de test; en producción no tiene llamadas
   * (solo tests). Sus valores son estimados, no reales.
   */
  async getUsageInfo(): Promise<APIUsageInfo> {
    return await this.perplexityService.getUsageInfo();
  }

  /**
   * Registra el cache hit de bulk-categorize (best-effort, nunca lanza).
   */
  private async recordBulkCacheHit(): Promise<void> {
    if (!this.usageRecorder) return;
    try {
      await this.usageRecorder.record({
        provider: this.aiConfig.provider,
        model: this.aiConfig.model,
        operation: 'bulk-categorize',
        latencyMs: 0,
        success: true,
        cached: true,
        userId: null,
      });
    } catch {
      // Best-effort: un fallo del registro no rompe la operación de IA.
    }
  }

  /**
   * Limpia el cache (útil para testing o administración)
   */
  async clearCache(pattern?: string): Promise<number> {
    if (!this.cacheService) {
      this.logger.warn('Intento de limpiar cache pero no está disponible');
      return 0;
    }

    try {
      const deleted = pattern 
        ? await this.cacheService.deletePattern(pattern)
        : await this.cacheService.deletePattern('*');
        
      this.logger.info('Cache limpiado', { pattern, deleted });
      return deleted;

    } catch (error) {
      this.logger.error('Error al limpiar cache', error as Error, { pattern });
      return 0;
    }
  }

  /**
   * Obtiene estadísticas del cache
   */
  async getCacheStats(): Promise<{
    available: boolean;
    keys?: number;
    memory?: string;
  }> {
    if (!this.cacheService) {
      return { available: false };
    }

    try {
      const available = await this.cacheService.isAvailable();
      
      if (!available) {
        return { available: false };
      }

      // Estadísticas básicas
      return {
        available: true,
        keys: 0, // Redis client moderno no expone fácilmente info
        memory: 'N/A'
      };

    } catch (error) {
      this.logger.error('Error al obtener estadísticas del cache', error as Error);
      return { available: false };
    }
  }

  /**
   * Cierra las conexiones
   */
  async shutdown(): Promise<void> {
    if (this.cacheService) {
      try {
        await this.cacheService.disconnect();
        this.logger.info('Servicios de IA cerrados correctamente');
      } catch (error) {
        this.logger.error('Error al cerrar servicios de IA', error as Error);
      }
    }
  }

  /**
   * Obtiene analytics del cache en tiempo real
   */
  async getCacheAnalytics(): Promise<any> {
    if (!this.cacheAnalytics) {
      return null;
    }
    
    return await this.cacheAnalytics.getRealTimeMetrics();
  }

  /**
   * Obtiene métricas diarias del cache
   */
  async getDailyCacheMetrics(): Promise<any> {
    if (!this.cacheAnalytics) {
      return null;
    }
    
    return await this.cacheAnalytics.getDailyMetrics();
  }

  /**
   * Genera reporte de optimización del cache
   */
  async getCacheOptimizationReport(): Promise<any> {
    if (!this.cacheAnalytics) {
      return null;
    }
    
    return await this.cacheAnalytics.generateOptimizationReport();
  }

  /**
   * Obtiene métricas para dashboard
   */
  async getCacheMetricsForDashboard(): Promise<any> {
    if (!this.cacheAnalytics) {
      return null;
    }
    
    return await this.cacheAnalytics.getMetricsForDashboard();
  }
}