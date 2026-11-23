/**
 * Tests unitarios para CU-30: AnalyzePurchaseHabits
 */

import { AnalyzePurchaseHabitsUseCase } from '../../../../../src/application/use-cases/ai/AnalyzePurchaseHabits';
import { success } from '../../../../../src/shared/result';

jest.mock('../../../../../src/infrastructure/observability/logger/Logger', () => {
  // Clase falsa (no mock de jest) para que resetMocks no le borre los métodos
  class FakeLogger {
    ai = jest.fn();
    http = jest.fn();
    error = jest.fn();
    warn = jest.fn();
    info = jest.fn();
    security = jest.fn();
    debug = jest.fn();
    constructor(_context?: string) {}
  }
  return { Logger: FakeLogger, defaultLogger: new FakeLogger('Main') };
});

const USER_ID = '11111111-1111-4111-8111-111111111111';

const makeProducto = (overrides: Record<string, any> = {}) => ({
  id: overrides['id'] ?? 'prod-1',
  nombre: overrides['nombre'] ?? 'Leche Entera',
  cantidad: overrides['cantidad'] ?? 2,
  precio: overrides['precio'] ?? null,
  comprado: true,
  urgente: false,
  listaId: overrides['listaId'] ?? 'lista-1',
  categoriaId: overrides['categoriaId'] ?? null,
  fechaCompra: overrides['fechaCompra'] ?? new Date('2025-01-10T00:00:00Z'),
  fechaCreacion: new Date('2025-01-01T00:00:00Z')
} as any);

const makeLista = (overrides: Record<string, any> = {}) => ({
  id: overrides['id'] ?? 'lista-1',
  tiendaId: overrides['tiendaId'] ?? null
} as any);

const unwrap = <T>(r: { isSuccess: boolean; value?: T; error?: unknown }): T => {
  if (!r.isSuccess) throw new Error('Se esperaba success');
  return r.value as T;
};

describe('CU-30: AnalyzePurchaseHabits', () => {
  let usuarioRepository: any;
  let listaRepository: any;
  let productoRepository: any;
  let categoriaRepository: any;
  let tiendaRepository: any;
  let aiService: any;
  let useCase: AnalyzePurchaseHabitsUseCase;

  const dto = { userId: USER_ID, timeRange: '90d' as const };

  beforeEach(() => {
    usuarioRepository = { findById: jest.fn().mockResolvedValue(success({ id: USER_ID, nombre: 'Test' })) };
    listaRepository = {
      findByOwner: jest.fn().mockResolvedValue(success({
        items: [makeLista()], total: 1, page: 1, limit: 100, totalPages: 1, hasNext: false, hasPrevious: false
      }))
    };
    productoRepository = { findByList: jest.fn().mockResolvedValue(success({
      items: [], total: 0, page: 1, limit: 500, totalPages: 0, hasNext: false, hasPrevious: false
    })) };
    categoriaRepository = { findById: jest.fn() };
    tiendaRepository = { findById: jest.fn() };
    aiService = { analyzePurchaseHabits: jest.fn().mockResolvedValue([
      { type: 'frequency', title: 'Compra frecuente', description: 'Compras leche a menudo', confidence: 0.9 }
    ]) };
    useCase = new AnalyzePurchaseHabitsUseCase(
      usuarioRepository, listaRepository, productoRepository,
      categoriaRepository, tiendaRepository, aiService
    );
  });

  it('rechaza si el solicitante no es el propio usuario ni admin', async () => {
    const result = await useCase.execute(dto, '22222222-2222-4222-8222-222222222222', 'USUARIO');

    expect(result.isFailure).toBe(true);
    expect((result as any).error.constructor.name).toBe('UnauthorizedError');
    expect(aiService.analyzePurchaseHabits).not.toHaveBeenCalled();
  });

  it('permite si el solicitante es admin aunque no sea el usuario', async () => {
    const result = await useCase.execute(dto, '22222222-2222-4222-8222-222222222222', 'ADMIN');
    expect(result.isSuccess).toBe(true);
  });

  it('devuelve 404 si el usuario no existe', async () => {
    usuarioRepository.findById.mockResolvedValue(success(null));

    const result = await useCase.execute(dto, USER_ID);

    expect(result.isFailure).toBe(true);
    expect((result as any).error.constructor.name).toBe('NotFoundError');
  });

  it('responde vacío sin llamar a IA si el usuario no tiene listas', async () => {
    listaRepository.findByOwner.mockResolvedValue(success({
      items: [], total: 0, page: 1, limit: 100, totalPages: 0, hasNext: false, hasPrevious: false
    }));

    const result = await useCase.execute(dto, USER_ID);

    expect(result.isSuccess).toBe(true);
    expect(unwrap(result).insights).toEqual([]);
    expect(unwrap(result).metadata.productsAnalyzed).toBe(0);
    expect(unwrap(result).metadata.listsAnalyzed).toBe(0);
    expect(aiService.analyzePurchaseHabits).not.toHaveBeenCalled(); // ahorra coste IA
  });

  it('responde vacío sin llamar a IA si no hay compras en el rango', async () => {
    productoRepository.findByList.mockResolvedValue(success({
      items: [makeProducto({ fechaCompra: new Date('2020-01-01') })],
      total: 1, page: 1, limit: 500, totalPages: 1, hasNext: false, hasPrevious: false
    }));

    const result = await useCase.execute(dto, USER_ID);

    expect(result.isSuccess).toBe(true);
    expect(unwrap(result).metadata.productsAnalyzed).toBe(0);
    expect(aiService.analyzePurchaseHabits).not.toHaveBeenCalled();
  });

  it('agrega productos repetidos como frecuencia y enriquece categoría/tienda', async () => {
    const fechaReciente = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    productoRepository.findByList.mockResolvedValue(success({
      items: [
        makeProducto({ id: '1', nombre: 'Leche Entera', categoriaId: 'cat-1', fechaCompra: fechaReciente, precio: 1.5, cantidad: 2 }),
        makeProducto({ id: '2', nombre: 'leche entera ', categoriaId: 'cat-1', fechaCompra: fechaReciente, precio: 1.5, cantidad: 1 }),
        makeProducto({ id: '3', nombre: 'Pan Integral', categoriaId: null, listaId: 'lista-1', fechaCompra: fechaReciente, precio: 2.0, cantidad: 1 })
      ],
      total: 3, page: 1, limit: 500, totalPages: 1, hasNext: false, hasPrevious: false
    }));
    categoriaRepository.findById.mockResolvedValue(success({ id: 'cat-1', nombre: 'Lácteos' }));
    tiendaRepository.findById.mockResolvedValue(success({ id: 'tienda-1', nombre: 'Mercadona' }));
    listaRepository.findByOwner.mockResolvedValue(success({
      items: [makeLista({ tiendaId: 'tienda-1' })], total: 1, page: 1, limit: 100, totalPages: 1, hasNext: false, hasPrevious: false
    }));

    const result = await useCase.execute(dto, USER_ID);

    expect(result.isSuccess).toBe(true);
    expect(unwrap(result).metadata.productsAnalyzed).toBe(2); // leche + pan agregados
    expect(unwrap(result).metadata.listsAnalyzed).toBe(1);
    expect(aiService.analyzePurchaseHabits).toHaveBeenCalledTimes(1);

    const history = aiService.analyzePurchaseHabits.mock.calls[0][0];
    const leche = history.find((h: any) => h.productName === 'Leche Entera');
    expect(leche.frequency).toBe(2);
    expect(leche.quantity).toBe(3);
    expect(leche.category).toBe('Lácteos');
    expect(leche.storeName).toBe('Mercadona');
    expect(leche.price).toBeCloseTo(1.5, 2);

    const pan = history.find((h: any) => h.productName === 'Pan Integral');
    expect(pan.category).toBe('Sin categoría');
    expect(pan.frequency).toBe(1);
  });

  it('propaga los insights de la IA en la respuesta', async () => {
    const fechaReciente = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    productoRepository.findByList.mockResolvedValue(success({
      items: [makeProducto({ fechaCompra: fechaReciente })],
      total: 1, page: 1, limit: 500, totalPages: 1, hasNext: false, hasPrevious: false
    }));

    const result = await useCase.execute(dto, USER_ID);

    expect(result.isSuccess).toBe(true);
    expect(unwrap(result).insights).toHaveLength(1);
    expect(unwrap(result).insights[0]?.type).toBe('frequency');
    expect(unwrap(result).metadata.generatedAt).toBeDefined();
  });

  it('devuelve failure si la IA falla', async () => {
    const fechaReciente = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    productoRepository.findByList.mockResolvedValue(success({
      items: [makeProducto({ fechaCompra: fechaReciente })],
      total: 1, page: 1, limit: 500, totalPages: 1, hasNext: false, hasPrevious: false
    }));
    aiService.analyzePurchaseHabits.mockRejectedValue(new Error('IA caída'));

    const result = await useCase.execute(dto, USER_ID);

    expect(result.isFailure).toBe(true);
  });
});
