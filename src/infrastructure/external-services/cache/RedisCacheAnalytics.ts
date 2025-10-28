/**
 * Sistema de Analytics para Cache Redis
 * Monitorea hit ratios, performance y eficiencia del cache
 */

import { CacheService } from './RedisCacheService';
import { Logger } from '../../observability/logger/Logger';

export interface CacheAnalytics {
  // Métricas de hit/miss
  hits: number;
  misses: number;
  hitRatio: number;
  
  // Métricas de tiempo
  averageResponseTime: number;
  cacheResponseTime: number;
  apiResponseTime: number;
  
  // Métricas de uso
  totalOperations: number;
  readsPerMinute: number;
  writesPerMinute: number;
  
  // Métricas de eficiencia
  costSavings: number; // En requests API evitadas
  spaceSavings: number; // En MB utilizados
  
  // Métricas por categoría
  categoryStats: Record<string, {
    hits: number;
    misses: number;
    hitRatio: number;
    avgTTL: number;
  }>;
}

export interface CacheOperation {
  type: 'hit' | 'miss' | 'set' | 'delete';
  key: string;
  category: 'ai-category' | 'ai-analysis' | 'user-data' | 'other';
  responseTime: number;
  size?: number; // Tamaño en bytes
  ttl?: number;
  timestamp: number;
}

export class RedisCacheAnalytics {
  private readonly logger = new Logger('RedisCacheAnalytics');
  private operations: CacheOperation[] = [];
  private readonly maxOperationsHistory = 10000; // Últimas 10k operaciones
  
  // Contadores en tiempo real
  private counters = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    totalResponseTime: 0,
    cacheResponseTime: 0,
    apiResponseTime: 0
  };

  constructor(_cacheService: CacheService) {}

  /**
   * Registra una operación de cache
   */
  recordOperation(operation: CacheOperation): void {
    // Actualizar contadores
    this.counters[operation.type === 'hit' ? 'hits' : 
                   operation.type === 'miss' ? 'misses' :
                   operation.type === 'set' ? 'sets' : 'deletes']++;
    
    if (operation.type === 'hit') {
      this.counters.cacheResponseTime += operation.responseTime;
    } else if (operation.type === 'miss') {
      this.counters.apiResponseTime += operation.responseTime;
    }
    
    this.counters.totalResponseTime += operation.responseTime;

    // Agregar a historial (mantener límite)
    this.operations.push(operation);
    if (this.operations.length > this.maxOperationsHistory) {
      this.operations.shift(); // Remover la más antigua
    }

    this.logger.debug('Operación de cache registrada', {
      type: operation.type,
      category: operation.category,
      responseTime: operation.responseTime,
      key: operation.key.substring(0, 50) + '...' // Truncar para logs
    });
  }

  /**
   * Registra un hit de cache
   */
  recordHit(key: string, category: string, responseTime: number, size?: number): void {
    this.recordOperation({
      type: 'hit',
      key,
      category: category as any,
      responseTime,
      ...(size !== undefined && { size }),
      timestamp: Date.now()
    });
  }

  /**
   * Registra un miss de cache (y posterior API call)
   */
  recordMiss(key: string, category: string, apiResponseTime: number, size?: number, ttl?: number): void {
    this.recordOperation({
      type: 'miss',
      key,
      category: category as any,
      responseTime: apiResponseTime,
      ...(size !== undefined && { size }),
      ...(ttl !== undefined && { ttl }),
      timestamp: Date.now()
    });
  }

  /**
   * Registra una operación de set (escribir al cache)
   */
  recordSet(key: string, category: string, responseTime: number, size: number, ttl: number): void {
    this.recordOperation({
      type: 'set',
      key,
      category: category as any,
      responseTime,
      size,
      ttl,
      timestamp: Date.now()
    });
  }

  /**
   * Obtiene analytics actuales
   */
  async getAnalytics(timeWindow?: number): Promise<CacheAnalytics> {
    const now = Date.now();
    const windowStart = timeWindow ? now - timeWindow : 0;
    
    // Filtrar operaciones por ventana de tiempo
    const relevantOps = this.operations.filter(op => op.timestamp >= windowStart);
    
    // Calcular métricas básicas
    const hits = relevantOps.filter(op => op.type === 'hit').length;
    const misses = relevantOps.filter(op => op.type === 'miss').length;
    const total = hits + misses;
    const hitRatio = total > 0 ? hits / total : 0;

    // Calcular tiempos de respuesta promedio
    const cacheOps = relevantOps.filter(op => op.type === 'hit');
    const apiOps = relevantOps.filter(op => op.type === 'miss');
    
    const avgCacheTime = cacheOps.length > 0 
      ? cacheOps.reduce((sum, op) => sum + op.responseTime, 0) / cacheOps.length 
      : 0;
    
    const avgApiTime = apiOps.length > 0 
      ? apiOps.reduce((sum, op) => sum + op.responseTime, 0) / apiOps.length 
      : 0;

    // Calcular operaciones por minuto
    const windowMinutes = timeWindow ? timeWindow / 60000 : 1;
    const readsPerMinute = (hits + misses) / windowMinutes;
    const writesPerMinute = relevantOps.filter(op => op.type === 'set').length / windowMinutes;

    // Calcular savings
    const costSavings = hits; // Cada hit es una request API evitada
    const spaceSavings = this.calculateSpaceUsage(relevantOps) / (1024 * 1024); // MB

    // Analytics por categoría
    const categoryStats = this.calculateCategoryStats(relevantOps);

    return {
      hits,
      misses,
      hitRatio,
      averageResponseTime: total > 0 ? relevantOps.reduce((sum, op) => sum + op.responseTime, 0) / total : 0,
      cacheResponseTime: avgCacheTime,
      apiResponseTime: avgApiTime,
      totalOperations: total,
      readsPerMinute,
      writesPerMinute,
      costSavings,
      spaceSavings,
      categoryStats
    };
  }

  /**
   * Obtiene métricas en tiempo real (últimos 5 minutos)
   */
  async getRealTimeMetrics(): Promise<CacheAnalytics> {
    return this.getAnalytics(5 * 60 * 1000); // 5 minutos
  }

  /**
   * Obtiene métricas del último día
   */
  async getDailyMetrics(): Promise<CacheAnalytics> {
    return this.getAnalytics(24 * 60 * 60 * 1000); // 24 horas
  }

  /**
   * Calcula estadísticas por categoría
   */
  private calculateCategoryStats(operations: CacheOperation[]): Record<string, any> {
    const categories = ['ai-category', 'ai-analysis', 'user-data', 'other'];
    const stats: Record<string, any> = {};

    for (const category of categories) {
      const categoryOps = operations.filter(op => op.category === category);
      const hits = categoryOps.filter(op => op.type === 'hit').length;
      const misses = categoryOps.filter(op => op.type === 'miss').length;
      const total = hits + misses;
      
      const ttls = categoryOps
        .filter(op => op.ttl)
        .map(op => op.ttl!)
        .filter(ttl => ttl > 0);
      
      stats[category] = {
        hits,
        misses,
        hitRatio: total > 0 ? hits / total : 0,
        avgTTL: ttls.length > 0 ? ttls.reduce((sum, ttl) => sum + ttl, 0) / ttls.length : 0
      };
    }

    return stats;
  }

  /**
   * Calcula el uso de espacio aproximado
   */
  private calculateSpaceUsage(operations: CacheOperation[]): number {
    return operations
      .filter(op => op.size && op.type === 'set')
      .reduce((total, op) => total + (op.size || 0), 0);
  }

  /**
   * Genera reporte de optimización
   */
  async generateOptimizationReport(): Promise<{
    recommendations: string[];
    inefficiencies: string[];
    ttlSuggestions: Record<string, number>;
  }> {
    const analytics = await this.getDailyMetrics();
    const recommendations: string[] = [];
    const inefficiencies: string[] = [];
    const ttlSuggestions: Record<string, number> = {};

    // Analizar hit ratio
    if (analytics.hitRatio < 0.7) {
      inefficiencies.push(`Hit ratio bajo: ${(analytics.hitRatio * 100).toFixed(1)}% (objetivo: >70%)`);
      recommendations.push('Aumentar TTL para datos frecuentemente accedidos');
    }

    if (analytics.hitRatio > 0.95) {
      recommendations.push('Considerar reducir TTL para liberar memoria');
    }

    // Analizar por categoría
    for (const [category, stats] of Object.entries(analytics.categoryStats)) {
      if (stats.hitRatio < 0.6) {
        inefficiencies.push(`Categoría ${category} con hit ratio bajo: ${(stats.hitRatio * 100).toFixed(1)}%`);
        ttlSuggestions[category] = Math.max(stats.avgTTL * 1.5, 3600); // Aumentar TTL
      }
      
      if (stats.hitRatio > 0.9 && stats.avgTTL > 24 * 60 * 60) {
        ttlSuggestions[category] = stats.avgTTL * 0.8; // Reducir TTL
      }
    }

    // Analizar performance
    if (analytics.cacheResponseTime > 50) {
      inefficiencies.push(`Tiempo de respuesta cache alto: ${analytics.cacheResponseTime.toFixed(1)}ms`);
      recommendations.push('Verificar latencia de red con Redis');
    }

    // Analizar espacio
    if (analytics.spaceSavings > 100) {
      recommendations.push('Considerar implementar compresión de datos');
    }

    return { recommendations, inefficiencies, ttlSuggestions };
  }

  /**
   * Expone métricas para dashboard
   */
  async getMetricsForDashboard(): Promise<{
    hitRatio: number;
    operationsPerMinute: number;
    costSavings: number;
    avgResponseTime: number;
    categories: Record<string, any>;
    trends: {
      hitRatioTrend: number[]; // Últimas 12 horas
      operationsTrend: number[];
    };
  }> {
    const current = await getRealTimeMetrics();
    const daily = await this.getDailyMetrics();
    
    // Calcular trends (simplificado para demostración)
    const hitRatioTrend = await this.calculateHourlyTrend('hitRatio', 12);
    const operationsTrend = await this.calculateHourlyTrend('operations', 12);

    return {
      hitRatio: current.hitRatio,
      operationsPerMinute: current.readsPerMinute + current.writesPerMinute,
      costSavings: daily.costSavings,
      avgResponseTime: current.averageResponseTime,
      categories: current.categoryStats,
      trends: {
        hitRatioTrend,
        operationsTrend
      }
    };
  }

  /**
   * Calcula trend por horas
   */
  private async calculateHourlyTrend(metric: string, hours: number): Promise<number[]> {
    const trend: number[] = [];
    const now = Date.now();
    
    for (let i = hours - 1; i >= 0; i--) {
      const hourStart = now - (i + 1) * 60 * 60 * 1000;
      const hourEnd = now - i * 60 * 60 * 1000;
      
      const hourOps = this.operations.filter(op => 
        op.timestamp >= hourStart && op.timestamp < hourEnd
      );
      
      if (metric === 'hitRatio') {
        const hits = hourOps.filter(op => op.type === 'hit').length;
        const total = hourOps.filter(op => op.type === 'hit' || op.type === 'miss').length;
        trend.push(total > 0 ? hits / total : 0);
      } else if (metric === 'operations') {
        trend.push(hourOps.length);
      }
    }
    
    return trend;
  }

  /**
   * Reset de estadísticas (para testing)
   */
  reset(): void {
    this.operations = [];
    this.counters = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      totalResponseTime: 0,
      cacheResponseTime: 0,
      apiResponseTime: 0
    };
    
    this.logger.info('Estadísticas de cache reseteadas');
  }
}

// Función helper para obtener analytics
async function getRealTimeMetrics(): Promise<CacheAnalytics> {
  // Esta función sería llamada desde el analytics instance
  throw new Error('Function must be bound to RedisCacheAnalytics instance');
}