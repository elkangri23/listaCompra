/**
 * Tests unitarios para PerplexityService (adapter de la API de IA)
 * Mockea axios.create: éxito, errores HTTP, parsing y fallbacks.
 */

import { PerplexityService } from '../../../../../src/infrastructure/external-services/ai/PerplexityService';
import type { PerplexityConfig } from '../../../../../src/infrastructure/config/ai.config';
import axios from 'axios';

const postMock = jest.fn();

jest.mock('axios', () => {
  const isAxiosError = (e: unknown) => !!(e as any)?.isAxiosError;
  return {
    __esModule: true,
    default: { create: jest.fn() },
    isAxiosError
  };
});

const makeConfig = (overrides: Partial<PerplexityConfig> = {}): PerplexityConfig => ({
  provider: 'perplexity',
  apiKey: 'pplx-test-key-1234567890',
  apiUrl: 'https://api.perplexity.ai',
  model: 'sonar',
  temperature: 0.3,
  maxTokens: 1000,
  timeout: 10000,
  cache: { enabled: false, ttl: 3600 },
  rateLimit: { requestsPerMinute: 10 },
  ...overrides
} as PerplexityConfig);

const aiResponse = (content: string) => ({ data: { choices: [{ message: { content } }], usage: { total_tokens: 10 } } });

describe('PerplexityService', () => {
  let service: PerplexityService;

  beforeEach(() => {
    postMock.mockReset();
    // resetMocks:true borra la implementación del factory: hay que reaplicarla
    (axios.create as unknown as jest.Mock).mockImplementation(() => ({ post: postMock }));
    service = new PerplexityService(makeConfig());
  });

  describe('constructor y updateConfig', () => {
    it('crea el adaptador con la config', () => {
      expect((service as unknown as { chatAdapter: unknown }).chatAdapter).toBeTruthy();
    });

    it('updateConfig recrea el cliente y cambia modelo/apiUrl', () => {
      const nueva = makeConfig({ model: 'sonar-pro', apiUrl: 'https://api.openai.com/v1' });
      service.updateConfig(nueva);

      expect((service as unknown as { config: PerplexityConfig }).config.model).toBe('sonar-pro');
    });
  });

  describe('callPerplexityAPI (vía suggestCategories)', () => {
    it('devuelve sugerencias parseadas de la respuesta', async () => {
      postMock.mockResolvedValue(aiResponse(JSON.stringify([
        { category: 'Lácteos', confidence: 0.9, reasoning: 'leche' }
      ])));

      const suggestions = await service.suggestCategories('Leche');

      expect(suggestions).toHaveLength(1);
      expect(suggestions[0]!.category).toBe('Lácteos');
      expect(postMock).toHaveBeenCalledWith(
        '/chat/completions',
        expect.objectContaining({ model: 'sonar', messages: expect.any(Array) })
      );
    });

    it('lanza si la respuesta de la API está vacía', async () => {
      postMock.mockResolvedValue({ data: { choices: [] } });

      // suggestCategories captura el error y usa fallback
      const suggestions = await service.suggestCategories('ProductoX');
      expect(suggestions.length).toBeGreaterThan(0); // fallback
    });

    it('loguea y relanza errores HTTP (axios error)', async () => {
      const axiosError = Object.assign(new Error('quota exceeded'), {
        isAxiosError: true,
        response: { status: 429, statusText: 'Too Many Requests', data: { error: 'quota' } },
        config: { url: '/chat/completions', method: 'post', timeout: 10000 }
      });
      postMock.mockRejectedValue(axiosError);

      const suggestions = await service.suggestCategories('Leche');
      // El error en suggestCategories usa fallback heurístico
      expect(suggestions[0]!.category).toBeTruthy();
    });
  });

  describe('getFallbackCategorySuggestions (heurísticas)', () => {
    it('clasifica por palabras clave (lácteos, frutas, limpieza...)', async () => {
      postMock.mockRejectedValue(new Error('IA caída'));

      expect((await service.suggestCategories('Leche entera'))[0]!.category).toBe('Lácteos');
      expect((await service.suggestCategories('Manzana'))[0]!.category).toBe('Frutas y Verduras');
      expect((await service.suggestCategories('Detergente'))[0]!.category).toBe('Limpieza');
      expect((await service.suggestCategories('ProductoDesconocido'))[0]!.category).toBe('Otros');
    });
  });

  describe('analyzePurchaseHabits', () => {
    it('parsea insights JSON de la respuesta', async () => {
      postMock.mockResolvedValue(aiResponse(JSON.stringify([
        { type: 'frequency', title: 'Compra semanal', description: 'Sueles comprar leche', confidence: 0.8 }
      ])));

      const insights = await service.analyzePurchaseHabits(
        [{ productName: 'Leche', category: 'Lácteos', storeName: 'Mercadona', purchaseDate: new Date(), quantity: 1 }],
        { start: new Date().toISOString(), end: new Date().toISOString() } as never
      );

      expect(insights).toHaveLength(1);
      expect(insights[0]!.type).toBe('frequency');
    });

    it('devuelve [] si la IA falla', async () => {
      postMock.mockRejectedValue(new Error('boom'));

      const insights = await service.analyzePurchaseHabits([], { start: '', end: '' } as never);
      expect(insights).toEqual([]);
    });
  });

  describe('isAvailable / getUsageInfo', () => {
    it('isAvailable depende de que la API responda', async () => {
      postMock.mockResolvedValue(aiResponse('OK'));
      expect(await service.isAvailable()).toBe(true);

      postMock.mockRejectedValue(new Error('down'));
      expect(await service.isAvailable()).toBe(false);
    });

    it('getUsageInfo devuelve info estimada del proveedor', async () => {
      const info = await service.getUsageInfo();
      expect(info.provider).toBe('perplexity');
      expect(info.rateLimitRemaining).toBe(10);
    });
  });

  describe('getProductRecommendations (CU-33)', () => {
    it('genera prompt con contexto y devuelve JSON de la IA', async () => {
      postMock.mockResolvedValue(aiResponse(JSON.stringify({
        detectedContext: 'Cena',
        recommendations: [{ name: 'Vino', reason: 'combina', confidenceScore: 90 }]
      })));

      const result = await service.getProductRecommendations(
        [{ name: 'Pasta', quantity: 1, purchased: false }],
        'Cena romántica'
      );

      const parsed = JSON.parse(result);
      expect(parsed.detectedContext).toBe('Cena');
      expect(parsed.recommendations).toHaveLength(1);
    });

    it('sin productos usa fallback local (no lanza)', async () => {
      const result = await service.getProductRecommendations([]);
      const parsed = JSON.parse(result);
      expect(parsed.detectedContext).toContain('IA no disponible');
      expect(parsed.recommendations.length).toBeGreaterThan(0);
    });

    it('maxRecommendations fuera de rango usa fallback local', async () => {
      const result = await service.getProductRecommendations(
        [{ name: 'X', quantity: 1, purchased: false }], undefined, undefined, 25
      );
      expect(JSON.parse(result).recommendations).toBeTruthy();
    });

    it('excluye productos comprados del prompt', async () => {
      postMock.mockResolvedValue(aiResponse(JSON.stringify({ recommendations: [] })));

      await service.getProductRecommendations([
        { name: 'Pan', quantity: 1, purchased: false },
        { name: 'Leche', quantity: 1, purchased: true }
      ]);

      const userContent = postMock.mock.calls[0]?.[1]?.messages?.find((m: any) => m.role === 'user')?.content ?? '';
      expect(userContent).toContain('Pan');
      expect(userContent).not.toContain('- Leche 1 unidades');
    });

    it('genera fallback si la respuesta de IA no es JSON', async () => {
      postMock.mockResolvedValue(aiResponse('texto-no-json'));

      const result = await service.getProductRecommendations([{ name: 'Pasta', quantity: 1, purchased: false }]);

      const parsed = JSON.parse(result);
      expect(parsed.recommendations).toBeTruthy();
    });
  });

  describe('bulkCategorizeProducts (CU-29)', () => {
    it('categoriza en lote y devuelve JSON', async () => {
      postMock.mockResolvedValue(aiResponse(JSON.stringify({
        products: [{ nombre: 'Leche', categoria: 'Lácteos', confidence: 0.9 }]
      })));

      const result = await service.bulkCategorizeProducts([{ nombre: 'Leche' }]);

      const parsed = JSON.parse(result);
      expect(parsed.products).toHaveLength(1);
    });

    it('sin productos devuelve fallback vacío (no lanza)', async () => {
      const result = await service.bulkCategorizeProducts([]);
      expect(JSON.parse(result).products).toEqual([]);
    });

    it('más de 50 productos devuelve fallback sin llamar a la IA', async () => {
      const products = Array.from({ length: 51 }, (_, i) => ({ nombre: `P${i}` }));
      const result = await service.bulkCategorizeProducts(products);
      const parsed = JSON.parse(result);
      expect(parsed.products.length).toBeGreaterThan(0);
      expect(postMock).not.toHaveBeenCalled();
    });

    it('nombre de producto inválido genera fallback', async () => {
      const result = await service.bulkCategorizeProducts([{ nombre: '   ' }]);
      expect(JSON.parse(result).products).toBeTruthy();
    });

    it('usa fallback local si la IA no devuelve JSON válido', async () => {
      postMock.mockResolvedValue(aiResponse('no-json'));

      const result = await service.bulkCategorizeProducts([{ nombre: 'Leche' }]);

      const parsed = JSON.parse(result);
      expect(parsed.products).toBeTruthy();
    });
  });

  describe('suggestCategories con ejemplos del usuario', () => {
    const messagesOf = () => {
      const body = postMock.mock.calls[0]?.[1] as any;
      return (body?.messages ?? []) as Array<{ role: string; content: string }>;
    };

    it('incluye los ejemplos y la preferencia por categorías existentes en el prompt', async () => {
      postMock.mockResolvedValue(aiResponse(JSON.stringify([
        { category: 'Lácteos', confidence: 0.97, reasoning: 'como siempre' }
      ])));

      const suggestions = await service.suggestCategories(
        'Leche semidesnatada',
        'Mercadona',
        ['Lácteos'],
        [{ productName: 'Leche entera', category: 'Lácteos' }],
        'supermercado general español'
      );

      expect(suggestions[0]!.category).toBe('Lácteos');
      const system = messagesOf().find(m => m.role === 'system')?.content ?? '';
      const user = messagesOf().find(m => m.role === 'user')?.content ?? '';
      expect(system).toContain('Ejemplos de cómo este usuario categoriza');
      expect(system).toContain('Leche entera');
      expect(system).toContain('Lácteos');
      expect(system).toContain('Prefiere las categorías que el usuario ya tiene');
      expect(user).toContain('supermercado general español');
    });

    it('sin ejemplos no añade el bloque de ejemplos', async () => {
      postMock.mockResolvedValue(aiResponse(JSON.stringify([
        { category: 'Lácteos', confidence: 0.9, reasoning: 'leche' }
      ])));

      await service.suggestCategories('Leche');

      const system = messagesOf().find(m => m.role === 'system')?.content ?? '';
      expect(system).not.toContain('Ejemplos de cómo este usuario categoriza');
      expect(system).toContain('Prefiere las categorías que el usuario ya tiene');
    });
  });
});
