/**
 * Tests unitarios para GetProductRecommendations (CU-33)
 * Recomendaciones contextuales con IA sobre una lista de compra.
 */

import { GetProductRecommendations } from '../../../../../src/application/use-cases/products/GetProductRecommendations';
import type { Result } from '../../../../../src/shared/result';

jest.mock('../../../../../src/infrastructure/observability/logger/Logger', () => {
  class FakeLogger {
    ai = jest.fn(); http = jest.fn(); error = jest.fn(); warn = jest.fn();
    info = jest.fn(); security = jest.fn(); debug = jest.fn();
    constructor(_context?: string) {}
  }
  return { Logger: FakeLogger };
});

const unwrap = <T>(r: Result<T, Error>): T | undefined => (r.isSuccess ? (r as { value: T }).value : undefined);
const unwrapFail = <T>(r: Result<T, Error>): Error => (r as { error: Error }).error;

const makeProducto = (overrides: Record<string, unknown> = {}) => ({
  id: 'p1', nombre: 'Leche', cantidad: 1, comprado: false,
  categoriaId: null, listaId: 'l1', ...overrides
} as any);

describe('GetProductRecommendations (CU-33)', () => {
  let listaRepository: any;
  let productoRepository: any;
  let categoriaRepository: any;
  let aiService: any;
  let useCase: GetProductRecommendations;

  beforeEach(() => {
    listaRepository = {
      findById: jest.fn().mockResolvedValue({ isSuccess: true, value: { id: 'l1', propietarioId: 'user-1', tiendaId: 't1' } })
    };
    productoRepository = {
      findByList: jest.fn().mockResolvedValue({
        isSuccess: true,
        value: { items: [makeProducto()], total: 1, page: 1, limit: 1000, totalPages: 1, hasNext: false, hasPrevious: false }
      })
    };
    categoriaRepository = {
      findById: jest.fn().mockResolvedValue({ isSuccess: true, value: { id: 'c1', nombre: 'Lácteos' } }),
      findByTienda: jest.fn().mockResolvedValue({ isSuccess: true, value: [{ id: 'c1', nombre: 'Lácteos' }] })
    };
    aiService = {
      getProductRecommendations: jest.fn().mockResolvedValue(JSON.stringify({
        detectedContext: 'Contexto general',
        recommendations: [
          { name: 'Galletas', reason: 'Complementa la leche', confidenceScore: 0.8, recommendationType: 'complement' }
        ]
      }))
    };
    useCase = new GetProductRecommendations(listaRepository, productoRepository, categoriaRepository, aiService);
  });

  it('genera recomendaciones para el propietario de la lista', async () => {
    const result = await useCase.execute({ listId: 'l1' }, 'user-1');

    expect(result.isSuccess).toBe(true);
    const dto = unwrap(result)!;
    expect(dto.listId).toBe('l1');
    expect(dto.recommendations).toHaveLength(1);
    expect(dto.recommendations[0]?.name).toBe('Galletas');
    expect(dto.metadata.aiUsed).toBe(true);
    expect(dto.productsInList).toBe(1);
  });

  it('falla con listId inválido (validación DTO)', async () => {
    const result = await useCase.execute({ listId: '' }, 'user-1');

    expect(result.isFailure).toBe(true);
  });

  it('falla si la lista no existe', async () => {
    listaRepository.findById.mockResolvedValue({ isSuccess: true, value: null });

    const result = await useCase.execute({ listId: 'l1' }, 'user-1');

    expect(result.isFailure).toBe(true);
    expect(unwrapFail(result).message).toContain('no encontrada');
  });

  it('falla si el usuario no es propietario', async () => {
    const result = await useCase.execute({ listId: 'l1' }, 'intruso');

    expect(result.isFailure).toBe(true);
    expect(unwrapFail(result).message).toContain('permisos');
  });

  it('falla si la lista está vacía', async () => {
    productoRepository.findByList.mockResolvedValue({
      isSuccess: true, value: { items: [], total: 0, page: 1, limit: 1000, totalPages: 1, hasNext: false, hasPrevious: false }
    });

    const result = await useCase.execute({ listId: 'l1' }, 'user-1');

    expect(result.isFailure).toBe(true);
    expect(unwrapFail(result).message).toContain('vacía');
  });

  it('falla si el productId especificado no está en la lista', async () => {
    const result = await useCase.execute({ listId: 'l1', productId: 'p-inexistente' }, 'user-1');

    expect(result.isFailure).toBe(true);
    expect(unwrapFail(result).message).toContain('no existe');
  });

  it('excluye productos comprados con excludeExisting', async () => {
    productoRepository.findByList.mockResolvedValue({
      isSuccess: true,
      value: {
        items: [makeProducto(), makeProducto({ id: 'p2', nombre: 'Pan', comprado: true })],
        total: 2, page: 1, limit: 1000, totalPages: 1, hasNext: false, hasPrevious: false
      }
    });

    await useCase.execute({ listId: 'l1', excludeExisting: true }, 'user-1');

    const productsForAI = aiService.getProductRecommendations.mock.calls[0]?.[0] as any[];
    expect(productsForAI).toHaveLength(1);
    expect(productsForAI[0]?.name).toBe('Leche');
  });

  it('enriquece productos con nombre de categoría', async () => {
    productoRepository.findByList.mockResolvedValue({
      isSuccess: true,
      value: {
        items: [makeProducto({ categoriaId: 'c1' })],
        total: 1, page: 1, limit: 1000, totalPages: 1, hasNext: false, hasPrevious: false
      }
    });

    await useCase.execute({ listId: 'l1' }, 'user-1');

    const productsForAI = aiService.getProductRecommendations.mock.calls[0]?.[0] as any[];
    expect(productsForAI[0]?.category).toBe('Lácteos');
  });

  it('falla si la respuesta de IA no es JSON válido', async () => {
    aiService.getProductRecommendations.mockResolvedValue('no-es-json');

    const result = await useCase.execute({ listId: 'l1' }, 'user-1');

    expect(result.isFailure).toBe(true);
    expect(unwrapFail(result).message).toContain('procesar');
  });

  it('falla si la respuesta de IA no tiene recommendations', async () => {
    aiService.getProductRecommendations.mockResolvedValue(JSON.stringify({ foo: 'bar' }));

    const result = await useCase.execute({ listId: 'l1' }, 'user-1');

    expect(result.isFailure).toBe(true);
    expect(unwrapFail(result).message).toContain('formato');
  });

  it('omite recomendaciones con campos inválidos (name/reason/confidenceScore)', async () => {
    aiService.getProductRecommendations.mockResolvedValue(JSON.stringify({
      recommendations: [
        { name: 'Buena', reason: 'ok', confidenceScore: 0.9 },
        { name: 'Sin score', reason: 'ok' }
      ]
    }));

    const result = await useCase.execute({ listId: 'l1' }, 'user-1');

    expect(unwrap(result)!.recommendations).toHaveLength(1);
  });

  it('enriquece suggestedCategory con categoría existente de la tienda', async () => {
    aiService.getProductRecommendations.mockResolvedValue(JSON.stringify({
      recommendations: [
        { name: 'Yogur', reason: 'lácteos', confidenceScore: 0.7, suggestedCategory: 'Lácteos' }
      ]
    }));

    const result = await useCase.execute({ listId: 'l1' }, 'user-1');

    const rec = unwrap(result)!.recommendations[0]!;
    expect(rec.suggestedCategory?.id).toBe('c1');
    expect(rec.suggestedCategory?.name).toBe('Lácteos');
  });

  it('captura excepciones del servicio IA', async () => {
    aiService.getProductRecommendations.mockRejectedValue(new Error('IA caída'));

    const result = await useCase.execute({ listId: 'l1' }, 'user-1');

    expect(result.isFailure).toBe(true);
    expect(unwrapFail(result).message).toContain('generar recomendaciones');
  });
});
