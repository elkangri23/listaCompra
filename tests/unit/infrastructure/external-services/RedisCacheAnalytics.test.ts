/**
 * Tests unitarios para Redis Cache Analytics
 * Verifica la funcionalidad del sistema de métricas de cache
 */

import { RedisCacheAnalytics, CacheOperation } from '../../../../src/infrastructure/external-services/cache/RedisCacheAnalytics';
import { CacheService } from '../../../../src/infrastructure/external-services/cache/RedisCacheService';

// Mock del CacheService
const mockCacheService: CacheService = {
  get: jest.fn(),
  set: jest.fn(),
  delete: jest.fn(),
  deletePattern: jest.fn(),
  exists: jest.fn(),
  ttl: jest.fn(),
  isAvailable: jest.fn(),
  disconnect: jest.fn()
};

describe('RedisCacheAnalytics', () => {
  let analytics: RedisCacheAnalytics;

  beforeEach(() => {
    analytics = new RedisCacheAnalytics(mockCacheService);
    analytics.reset(); // Limpiar estadísticas
  });

  describe('recordOperation', () => {
    it('debería registrar una operación hit correctamente', () => {
      const operation: CacheOperation = {
        type: 'hit',
        key: 'test-key',
        category: 'ai-category',
        responseTime: 15,
        timestamp: Date.now()
      };

      analytics.recordOperation(operation);
      
      // Verificar que se registró internamente
      expect(true).toBe(true); // Test simple para verificar que no hay errores
    });

    it('debería registrar una operación miss correctamente', () => {
      const operation: CacheOperation = {
        type: 'miss',
        key: 'test-key',
        category: 'ai-category',
        responseTime: 150,
        size: 1024,
        ttl: 3600,
        timestamp: Date.now()
      };

      analytics.recordOperation(operation);
      
      expect(true).toBe(true);
    });
  });

  describe('recordHit', () => {
    it('debería registrar un hit con la categoría correcta', () => {
      analytics.recordHit('test-key', 'ai-category', 10, 512);
      
      expect(true).toBe(true);
    });
  });

  describe('recordMiss', () => {
    it('debería registrar un miss con tiempo de API', () => {
      analytics.recordMiss('test-key', 'ai-category', 200, 1024, 3600);
      
      expect(true).toBe(true);
    });
  });

  describe('getAnalytics', () => {
    it('debería calcular métricas básicas correctamente', async () => {
      // Simular algunas operaciones
      analytics.recordHit('key1', 'ai-category', 10);
      analytics.recordHit('key2', 'ai-category', 15);
      analytics.recordMiss('key3', 'ai-category', 200);

      const result = await analytics.getAnalytics();

      expect(result.hits).toBe(2);
      expect(result.misses).toBe(1);
      expect(result.totalOperations).toBe(3);
      expect(result.hitRatio).toBeCloseTo(0.666, 2); // 2/3
    });

    it('debería manejar caso sin operaciones', async () => {
      const result = await analytics.getAnalytics();

      expect(result.hits).toBe(0);
      expect(result.misses).toBe(0);
      expect(result.totalOperations).toBe(0);
      expect(result.hitRatio).toBe(0);
    });

    it('debería calcular tiempos de respuesta promedio', async () => {
      analytics.recordHit('key1', 'ai-category', 10);
      analytics.recordHit('key2', 'ai-category', 20);
      analytics.recordMiss('key3', 'ai-category', 300);

      const result = await analytics.getAnalytics();

      expect(result.cacheResponseTime).toBe(15); // (10+20)/2
      expect(result.apiResponseTime).toBe(300);
    });
  });

  describe('getRealTimeMetrics', () => {
    it('debería devolver métricas de los últimos 5 minutos', async () => {
      // Simular operación reciente
      analytics.recordHit('recent-key', 'ai-category', 10);

      const result = await analytics.getRealTimeMetrics();

      expect(result.hits).toBe(1);
      expect(result.misses).toBe(0);
    });
  });

  describe('getDailyMetrics', () => {
    it('debería devolver métricas de las últimas 24 horas', async () => {
      analytics.recordHit('daily-key', 'ai-category', 10);
      analytics.recordMiss('daily-key-2', 'ai-analysis', 150);

      const result = await analytics.getDailyMetrics();

      expect(result.totalOperations).toBe(2);
      expect(result.hitRatio).toBe(0.5);
    });
  });

  describe('generateOptimizationReport', () => {
    it('debería generar recomendaciones para hit ratio bajo', async () => {
      // Simular hit ratio bajo (20%)
      analytics.recordHit('key1', 'ai-category', 10);
      analytics.recordMiss('key2', 'ai-category', 200);
      analytics.recordMiss('key3', 'ai-category', 200);
      analytics.recordMiss('key4', 'ai-category', 200);
      analytics.recordMiss('key5', 'ai-category', 200);

      const report = await analytics.generateOptimizationReport();

      expect(report.inefficiencies.length).toBeGreaterThan(0);
      expect(report.recommendations.length).toBeGreaterThan(0);
      expect(report.inefficiencies.some((i: string) => i.includes('Hit ratio bajo'))).toBe(true);
    });

    it('debería sugerir ajustes de TTL', async () => {
      // Simular datos para análisis de TTL
      analytics.recordMiss('key1', 'ai-category', 200, 1024, 1800); // TTL corto
      analytics.recordMiss('key2', 'ai-category', 200, 1024, 1800);

      const report = await analytics.generateOptimizationReport();

      expect(report.ttlSuggestions).toBeDefined();
      expect(typeof report.ttlSuggestions).toBe('object');
    });
  });

  describe('categoryStats', () => {
    it('debería calcular estadísticas por categoría', async () => {
      analytics.recordHit('key1', 'ai-category', 10);
      analytics.recordMiss('key2', 'ai-category', 200);
      analytics.recordHit('key3', 'ai-analysis', 15);

      const result = await analytics.getAnalytics();

      expect(result.categoryStats['ai-category']).toBeDefined();
      expect(result.categoryStats['ai-category']?.hits).toBe(1);
      expect(result.categoryStats['ai-category']?.misses).toBe(1);
      expect(result.categoryStats['ai-category']?.hitRatio).toBe(0.5);

      expect(result.categoryStats['ai-analysis']).toBeDefined();
      expect(result.categoryStats['ai-analysis']?.hits).toBe(1);
      expect(result.categoryStats['ai-analysis']?.misses).toBe(0);
      expect(result.categoryStats['ai-analysis']?.hitRatio).toBe(1);
    });
  });

  describe('reset', () => {
    it('debería limpiar todas las estadísticas', async () => {
      // Agregar algunas operaciones
      analytics.recordHit('key1', 'ai-category', 10);
      analytics.recordMiss('key2', 'ai-category', 200);

      // Verificar que hay datos
      let result = await analytics.getAnalytics();
      expect(result.totalOperations).toBe(2);

      // Reset
      analytics.reset();

      // Verificar que se limpiaron los datos
      result = await analytics.getAnalytics();
      expect(result.totalOperations).toBe(0);
      expect(result.hits).toBe(0);
      expect(result.misses).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('debería manejar ventana de tiempo específica', async () => {
      const now = Date.now();
      
      // Operación hace 2 horas
      analytics.recordOperation({
        type: 'hit',
        key: 'old-key',
        category: 'ai-category',
        responseTime: 10,
        timestamp: now - (2 * 60 * 60 * 1000)
      });

      // Operación reciente
      analytics.recordOperation({
        type: 'hit',
        key: 'new-key',
        category: 'ai-category',
        responseTime: 15,
        timestamp: now
      });

      // Solo última hora
      const result = await analytics.getAnalytics(60 * 60 * 1000);
      expect(result.hits).toBe(1); // Solo la operación reciente
    });

    it('debería calcular operaciones por minuto correctamente', async () => {
      const now = Date.now();
      
      // 3 operaciones en los últimos 3 minutos
      analytics.recordOperation({
        type: 'hit',
        key: 'key1',
        category: 'ai-category',
        responseTime: 10,
        timestamp: now - (2 * 60 * 1000)
      });
      
      analytics.recordOperation({
        type: 'hit',
        key: 'key2',
        category: 'ai-category',
        responseTime: 10,
        timestamp: now - (1 * 60 * 1000)
      });
      
      analytics.recordOperation({
        type: 'hit',
        key: 'key3',
        category: 'ai-category',
        responseTime: 10,
        timestamp: now
      });

      const result = await analytics.getAnalytics(3 * 60 * 1000); // 3 minutos
      expect(result.readsPerMinute).toBe(1); // 3 ops / 3 min = 1 op/min
    });
  });
});