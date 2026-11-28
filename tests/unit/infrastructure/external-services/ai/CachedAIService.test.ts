/**
 * Tests unitarios para CachedAIService (proxy IA + cache Redis)
 * Mockea PerplexityService, RedisCacheService y RedisCacheAnalytics.
 */

import { CachedAIService } from '../../../../../src/infrastructure/external-services/ai/CachedAIService';
import { PerplexityService } from '../../../../../src/infrastructure/external-services/ai/PerplexityService';
import { RedisCacheService } from '../../../../../src/infrastructure/external-services/cache/RedisCacheService';

jest.mock('../../../../../src/infrastructure/external-services/ai/PerplexityService', () => ({
  PerplexityService: jest.fn()
}));

jest.mock('../../../../../src/infrastructure/external-services/cache/RedisCacheService', () => ({
  RedisCacheService: jest.fn()
}));

jest.mock('../../../../../src/infrastructure/external-services/cache/RedisCacheAnalytics', () => ({
  RedisCacheAnalytics: jest.fn()
}));

// resetMocks:true borra las implementaciones registradas en los factory mocks:
// hay que re-aplicarlas antes de cada test
const applyServiceMocks = () => {
  (PerplexityService as unknown as jest.Mock).mockImplementation(() => ({
    suggestCategories: jest.fn().mockResolvedValue([]),
    analyzePurchaseHabits: jest.fn().mockResolvedValue([]),
    recommendProducts: jest.fn().mockResolvedValue([]),
    analyzeWithAI: jest.fn().mockResolvedValue({ result: 'ok' }),
    generateOccasionList: jest.fn().mockResolvedValue('[]'),
    getProductRecommendations: jest.fn().mockResolvedValue('{"recommendations":[]}'),
    bulkCategorizeProducts: jest.fn().mockResolvedValue('{"products":[]}'),
    isAvailable: jest.fn().mockResolvedValue(true),
    getUsageInfo: jest.fn().mockResolvedValue({ requestsUsed: 0 })
  }));
  (RedisCacheService as unknown as jest.Mock).mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
    deletePattern: jest.fn().mockResolvedValue(3),
    isAvailable: jest.fn().mockResolvedValue(true),
    disconnect: jest.fn().mockResolvedValue(undefined),
    getClient: jest.fn().mockReturnValue({ id: 'redis-mock' })
  }));
  const { RedisCacheAnalytics } = jest.requireMock('../../../../../src/infrastructure/external-services/cache/RedisCacheAnalytics') as { RedisCacheAnalytics: jest.Mock };
  RedisCacheAnalytics.mockImplementation(() => ({
    getRealTimeMetrics: jest.fn().mockResolvedValue({ hits: 1 }),
    getDailyMetrics: jest.fn().mockResolvedValue({ day: 'x' }),
    generateOptimizationReport: jest.fn().mockResolvedValue({ report: true }),
    getMetricsForDashboard: jest.fn().mockResolvedValue({ dashboard: true })
  }));
};

describe('CachedAIService', () => {
  beforeEach(() => {
    applyServiceMocks();
  });

  it('sin redisConfig no usa cache (clearCache devuelve 0, getCacheStats unavailable)', async () => {
    const service = new CachedAIService({ aiConfig: {} as any });

    await service.initialize();
    expect(await service.clearCache()).toBe(0);
    expect(await service.getCacheStats()).toEqual({ available: false });
    expect(await service.getCacheAnalytics()).toBeNull();
    expect(await service.getDailyCacheMetrics()).toBeNull();
    expect(await service.getCacheOptimizationReport()).toBeNull();
    expect(await service.getCacheMetricsForDashboard()).toBeNull();
    expect(service.cacheClient).toBeNull();
  });

  it('delega llamadas al PerplexityService subyacente', async () => {
    const service = new CachedAIService({ aiConfig: {} as any });

    expect(await service.isAvailable()).toBe(true);
    expect(await service.getUsageInfo()).toEqual({ requestsUsed: 0 });
    expect(await service.analyzePurchaseHabits([], '30d' as never)).toEqual([]);
    expect(await service.getProductRecommendations([], 'cena')).toBe('{"recommendations":[]}');
    expect(await service.analyzeWithAI({} as any)).toEqual({ result: 'ok' });
  });

  describe('con cache', () => {
    let service: CachedAIService;

    beforeEach(() => {
      service = new CachedAIService({
        aiConfig: {} as any,
        redisConfig: { host: 'localhost', port: 6379 } as any
      });
    });

    it('initialize y shutdown conectan/desconectan el cache', async () => {
      await service.initialize();
      await service.shutdown();
      expect(service.cacheClient).toBeTruthy();
    });

    it('bulkCategorizeProducts en cache miss llama a IA y guarda con TTL 24h', async () => {
      const result = await service.bulkCategorizeProducts([{ nombre: 'Leche' }], ['Lácteos']);

      expect(result).toBe('{"products":[]}');
      const cacheService = (service as unknown as { cacheService: { set: jest.Mock } }).cacheService!;
      expect(cacheService.set).toHaveBeenCalledWith(
        expect.stringContaining('ai:bulk-categorize:'),
        '{"products":[]}',
        86400
      );
    });

    it('bulkCategorizeProducts en cache hit devuelve _fromCache true', async () => {
      const cacheService = (service as unknown as { cacheService: { get: jest.Mock } }).cacheService!;
      cacheService.get.mockResolvedValue(JSON.stringify({ products: [{ nombre: 'Leche', source: 'ai' }] }));

      const result = await service.bulkCategorizeProducts([{ nombre: 'Leche' }]);

      const parsed = JSON.parse(result);
      expect(parsed._fromCache).toBe(true);
      expect(parsed.products[0].nombre).toBe('Leche');
    });

    it('bulkCategorizeProducts en cache hit registra el evento cached=true', async () => {
      const recorder = { record: jest.fn().mockResolvedValue(undefined) };
      const serviceWithRecorder = new CachedAIService({
        aiConfig: { provider: 'freellmapi', model: 'qwen3.8-27b' } as any,
        redisConfig: { host: 'localhost', port: 6379 } as any,
        usageRecorder: recorder as any,
      });
      const cacheService = (serviceWithRecorder as unknown as { cacheService: { get: jest.Mock } }).cacheService!;
      cacheService.get.mockResolvedValue(JSON.stringify({ products: [{ nombre: 'Leche', source: 'ai' }] }));

      const result = await serviceWithRecorder.bulkCategorizeProducts([{ nombre: 'Leche' }]);

      expect(JSON.parse(result)._fromCache).toBe(true);
      expect(recorder.record).toHaveBeenCalledTimes(1);
      expect(recorder.record).toHaveBeenCalledWith(expect.objectContaining({
        operation: 'bulk-categorize',
        success: true,
        cached: true,
        provider: 'freellmapi',
        model: 'qwen3.8-27b',
      }));
    });

    it('bulkCategorizeProducts en cache hit sin recorder no registra nada', async () => {
      const cacheService = (service as unknown as { cacheService: { get: jest.Mock } }).cacheService!;
      cacheService.get.mockResolvedValue(JSON.stringify({ products: [{ nombre: 'Leche', source: 'ai' }] }));

      const result = await service.bulkCategorizeProducts([{ nombre: 'Leche' }]);

      expect(JSON.parse(result)._fromCache).toBe(true);
    });

    it('bulkCategorizeProducts con cache caído continúa hacia IA', async () => {
      const cacheService = (service as unknown as { cacheService: { get: jest.Mock; set: jest.Mock } }).cacheService!;
      cacheService.get.mockRejectedValue(new Error('redis down'));
      cacheService.set.mockRejectedValue(new Error('redis down'));

      const result = await service.bulkCategorizeProducts([{ nombre: 'Leche' }]);

      expect(result).toBe('{"products":[]}');
    });

    it('clearCache delega en deletePattern', async () => {
      const cacheService = (service as unknown as { cacheService: { deletePattern: jest.Mock } }).cacheService!;

      expect(await service.clearCache('ai:*')).toBe(3);
      expect(cacheService.deletePattern).toHaveBeenCalledWith('ai:*');

      expect(await service.clearCache()).toBe(3);
      expect(cacheService.deletePattern).toHaveBeenLastCalledWith('*');
    });

    it('getCacheStats disponible cuando Redis responde', async () => {
      const stats = await service.getCacheStats();
      expect(stats.available).toBe(true);
    });

    it('getCacheStats unavailable si Redis no responde', async () => {
      const cacheService = (service as unknown as { cacheService: { isAvailable: jest.Mock } }).cacheService!;
      cacheService.isAvailable.mockResolvedValue(false);

      expect(await service.getCacheStats()).toEqual({ available: false });
    });

    it('analytics delegan en RedisCacheAnalytics', async () => {
      expect(await service.getCacheAnalytics()).toEqual({ hits: 1 });
      expect(await service.getDailyCacheMetrics()).toEqual({ day: 'x' });
      expect(await service.getCacheOptimizationReport()).toEqual({ report: true });
      expect(await service.getCacheMetricsForDashboard()).toEqual({ dashboard: true });
    });
  });
});
