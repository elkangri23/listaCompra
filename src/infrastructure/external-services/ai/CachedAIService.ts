/**
 * Adaptador de IA con Cache
 * Combina el servicio de Perplexity con cache Redis para optimizar costos
 */

import { PerplexityService } from './PerplexityService';
import { RedisCacheService } from '../cache/RedisCacheService';
import { RedisCacheAnalytics } from '../cache/RedisCacheAnalytics';
import { PerplexityConfig } from '../../config/ai.config';
import { RedisConfig } from '../../config/redis.config';
import { Logger } from '../../observability/logger/Logger';
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

export interface CachedAIServiceDependencies {
  aiConfig: PerplexityConfig;
  redisConfig?: RedisConfig; // Opcional - si no se proporciona, no usa cache
}

export class CachedAIService implements IAIService {
  private readonly logger = new Logger('CachedAIService');
  private readonly perplexityService: PerplexityService;
  private readonly cacheService?: RedisCacheService;
  private readonly cacheAnalytics?: RedisCacheAnalytics;

  constructor(dependencies: CachedAIServiceDependencies) {
    const { aiConfig, redisConfig } = dependencies;

    // Inicializar cache si se proporciona configuración
    if (redisConfig) {
      this.cacheService = new RedisCacheService(redisConfig);
      this.cacheAnalytics = new RedisCacheAnalytics(this.cacheService);
    }

    // Inicializar servicio de IA con cache opcional
    this.perplexityService = new PerplexityService(aiConfig, this.cacheService);
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
    existingCategories?: string[]
  ): Promise<CategorySuggestion[]> {
    return await this.perplexityService.suggestCategories(
      productName,
      storeName,
      existingCategories
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
   */
  async getUsageInfo(): Promise<APIUsageInfo> {
    return await this.perplexityService.getUsageInfo();
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