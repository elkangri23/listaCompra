/**
 * Tests unitarios para BulkCategorizeProducts (CU-29)
 * Categorización masiva con IA: batching, fallos parciales y stats.
 */

import { BulkCategorizeProducts } from '../../../../../src/application/use-cases/ai/BulkCategorizeProducts';
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

const AI_OK = (nombres: string[], fromCache = false) => JSON.stringify({
  _fromCache: fromCache,
  products: nombres.map(nombre => ({
    nombre,
    categoriaSugerida: 'Lácteos',
    confidence: 0.85,
    alternativeCategories: ['Panadería']
  }))
});

describe('BulkCategorizeProducts (CU-29)', () => {
  let aiService: any;
  let usuarioRepository: any;
  let categoriaRepository: any;
  let useCase: BulkCategorizeProducts;

  beforeEach(() => {
    aiService = {
      bulkCategorizeProducts: jest.fn().mockImplementation(async (products: any[]) => AI_OK(products.map(p => p.nombre)))
    };
    usuarioRepository = { findById: jest.fn().mockResolvedValue({ isSuccess: true, value: { id: 'user-1' } }) };
    categoriaRepository = {
      findByTienda: jest.fn().mockResolvedValue({ isSuccess: true, value: [{ id: 'c1', nombre: 'Lácteos' }] })
    };
    useCase = new BulkCategorizeProducts(aiService, usuarioRepository, categoriaRepository);
  });

  it('categoriza productos con éxito y calcula stats', async () => {
    const result = await useCase.execute({ products: [{ nombre: 'Leche' }, { nombre: 'Yogur' }] }, 'user-1');

    expect(result.isSuccess).toBe(true);
    const dto = unwrap(result)!;
    expect(dto.categorizedProducts).toHaveLength(2);
    expect(dto.batchStats.successful).toBe(2);
    expect(dto.batchStats.failed).toBe(0);
    expect(dto.batchStats.totalProcessingTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('falla si el usuario no existe', async () => {
    usuarioRepository.findById.mockResolvedValue({ isSuccess: false, isFailure: true, error: new Error('x') });

    const result = await useCase.execute({ products: [{ nombre: 'Leche' }] }, 'user-1');

    expect(result.isFailure).toBe(true);
    expect(unwrapFail(result).message).toContain('no encontrado');
  });

  it('enriquece con categorías existentes cuando tiendaId está presente', async () => {
    await useCase.execute({
      products: [{ nombre: 'Leche' }],
      tiendaId: 't1',
      enrichWithExistingCategories: true
    }, 'user-1');

    expect(categoriaRepository.findByTienda).toHaveBeenCalledWith('t1');
    const [, existingCategories] = aiService.bulkCategorizeProducts.mock.calls[0] as [any[], string[]];
    expect(existingCategories).toContain('Lácteos');
  });

  it('no consulta categorías si no se solicita enriquecimiento', async () => {
    await useCase.execute({ products: [{ nombre: 'Leche' }], tiendaId: 't1' }, 'user-1');

    expect(categoriaRepository.findByTienda).not.toHaveBeenCalled();
  });

  it('divide en sub-batches de 20', async () => {
    const products = Array.from({ length: 45 }, (_, i) => ({ nombre: `P${i}` }));
    await useCase.execute({ products }, 'user-1');

    expect(aiService.bulkCategorizeProducts).toHaveBeenCalledTimes(3);
    const batchSizes = (aiService.bulkCategorizeProducts.mock.calls as any[][]).map(c => (c[0] as any[]).length);
    expect(batchSizes).toEqual([20, 20, 5]);
  });

  it('marca productos con error si la IA falla en un sub-batch (fallos parciales)', async () => {
    aiService.bulkCategorizeProducts
      .mockImplementationOnce(async (products: any[]) => AI_OK(products.map(p => p.nombre)))
      .mockRejectedValueOnce(new Error('IA caída'));

    const products = Array.from({ length: 22 }, (_, i) => ({ nombre: `P${i}` }));
    const result = await useCase.execute({ products }, 'user-1');

    expect(result.isSuccess).toBe(true);
    const dto = unwrap(result)!;
    expect(dto.batchStats.successful).toBe(20);
    expect(dto.batchStats.failed).toBe(2);
    const withError = dto.categorizedProducts.filter(p => p.source === 'error');
    expect(withError).toHaveLength(2);
    expect(withError[0]?.error).toContain('IA caída');
  });

  it('detecta productos servidos desde cache', async () => {
    aiService.bulkCategorizeProducts.mockResolvedValue(AI_OK(['Leche'], true));

    const result = await useCase.execute({ products: [{ nombre: 'Leche' }] }, 'user-1');

    const dto = unwrap(result)!;
    expect(dto.categorizedProducts[0]?.source).toBe('cache');
    expect(dto.batchStats.fromCache).toBe(1);
  });

  it('acumula failures si el enriquecimiento de categorías de BD falla (no bloquea)', async () => {
    categoriaRepository.findByTienda.mockResolvedValue({ isSuccess: false, isFailure: true, error: new Error('DB') });

    const result = await useCase.execute({
      products: [{ nombre: 'Leche' }],
      tiendaId: 't1',
      enrichWithExistingCategories: true
    }, 'user-1');

    expect(result.isSuccess).toBe(true);
    const [, existingCategories] = aiService.bulkCategorizeProducts.mock.calls[0] as [any[], string[]];
    expect(existingCategories).toEqual([]);
  });

  it('respuesta IA con estructura inválida marca el batch como error', async () => {
    aiService.bulkCategorizeProducts.mockResolvedValue('{"no-products": true}');

    const result = await useCase.execute({ products: [{ nombre: 'Leche' }] }, 'user-1');

    expect(result.isSuccess).toBe(true);
    const dto = unwrap(result)!;
    expect(dto.batchStats.failed).toBe(1);
    expect(dto.categorizedProducts[0]?.source).toBe('error');
  });
});
