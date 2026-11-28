/**
 * Tests unitarios para AIController (CU-28, CU-29, CU-30)
 * Cubre: sugerencias de categorías, categorización masiva y análisis de hábitos
 */

import { AIController } from '../../../../../src/infrastructure/http/controllers/AIController';
import { ValidationError } from '../../../../../src/application/errors/ValidationError';
import { NotFoundError } from '../../../../../src/application/errors/NotFoundError';
import { UnauthorizedError } from '../../../../../src/application/errors/UnauthorizedError';
import { Success, Failure } from '../../../../../src/shared/result';

jest.mock('../../../../../src/infrastructure/observability/logger/Logger', () => {
  class FakeLogger {
    ai = jest.fn(); http = jest.fn(); error = jest.fn(); warn = jest.fn();
    info = jest.fn(); security = jest.fn(); debug = jest.fn();
    constructor(_context?: string) {}
  }
  return { Logger: FakeLogger };
});

jest.mock('../../../../../src/application/dto/ai/BulkCategorizeProductsDto', () => ({
  BulkCategorizeProductsDtoFactory: {
    fromHttpRequest: jest.fn()
  }
}));

import { BulkCategorizeProductsDtoFactory } from '../../../../../src/application/dto/ai/BulkCategorizeProductsDto';

const VALID_UUID = '5f0b8a4e-1c2d-4e3f-8a9b-2c3d4e5f6a7b';
const makeReq = (overrides: any = {}): any => ({ body: {}, query: {}, params: {}, user: { userId: 'u-1', rol: 'USER' }, ...overrides });

const makeRes = (): any => {
  const res: any = {
    statusCode: 0,
    body: undefined,
    status(code: number) { res.statusCode = code; return res; },
    json(payload: unknown) { res.body = payload; return res; }
  };
  return res;
};

describe('AIController', () => {
  let controller: AIController;
  let suggestionsUseCase: any;
  let bulkUseCase: any;
  let habitsUseCase: any;

  beforeEach(() => {
    suggestionsUseCase = { execute: jest.fn() };
    bulkUseCase = { execute: jest.fn() };
    habitsUseCase = { execute: jest.fn() };
    controller = new AIController(suggestionsUseCase, bulkUseCase, habitsUseCase);
  });

  describe('analyzePurchaseHabits (CU-30)', () => {
    it('devuelve 401 si no hay usuario autenticado', async () => {
      const res = makeRes();
      await controller.analyzePurchaseHabits(makeReq({ user: undefined }), res);
      expect(res.statusCode).toBe(401);
      expect(res.body.error).toBe('Usuario no autenticado');
    });

    it('devuelve 503 si el use case no está disponible', async () => {
      const controllerSinUC = new AIController(undefined, undefined, undefined);
      const res = makeRes();
      await controllerSinUC.analyzePurchaseHabits(makeReq({ params: { userId: VALID_UUID } }), res);
      expect(res.statusCode).toBe(503);
      expect(res.body.code).toBe('HABITS_SERVICE_UNAVAILABLE');
    });

    it('devuelve 400 si el userId no es un UUID válido', async () => {
      const res = makeRes();
      await controller.analyzePurchaseHabits(makeReq({ params: { userId: 'no-es-uuid' } }), res);
      expect(res.statusCode).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
      expect(Array.isArray(res.body.allowedTimeRanges)).toBe(true);
    });

    it('devuelve 400 si el timeRange no es un preset válido', async () => {
      const res = makeRes();
      await controller.analyzePurchaseHabits(
        makeReq({ params: { userId: VALID_UUID }, query: { timeRange: '7h' } }),
        res
      );
      expect(res.statusCode).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('mapea NotFoundError a 404', async () => {
      habitsUseCase.execute.mockResolvedValue(
        new Failure(new NotFoundError('Usuario', VALID_UUID))
      );
      const res = makeRes();
      await controller.analyzePurchaseHabits(makeReq({ params: { userId: VALID_UUID } }), res);
      expect(res.statusCode).toBe(404);
      expect(res.body.code).toBe('HABITS_ANALYSIS_ERROR');
    });

    it('mapea UnauthorizedError a 403', async () => {
      habitsUseCase.execute.mockResolvedValue(
        new Failure(new UnauthorizedError('Sin permiso'))
      );
      const res = makeRes();
      await controller.analyzePurchaseHabits(makeReq({ params: { userId: VALID_UUID } }), res);
      expect(res.statusCode).toBe(403);
    });

    it('mapea ValidationError a 400', async () => {
      habitsUseCase.execute.mockResolvedValue(
        new Failure(new ValidationError('Rango inválido', 'timeRange', 'x'))
      );
      const res = makeRes();
      await controller.analyzePurchaseHabits(makeReq({ params: { userId: VALID_UUID } }), res);
      expect(res.statusCode).toBe(400);
    });

    it('mapea errores desconocidos a 500', async () => {
      habitsUseCase.execute.mockResolvedValue(new Failure(new Error('boom')));
      const res = makeRes();
      await controller.analyzePurchaseHabits(makeReq({ params: { userId: VALID_UUID } }), res);
      expect(res.statusCode).toBe(500);
      expect(res.body.code).toBe('HABITS_ANALYSIS_ERROR');
    });

    it('devuelve 200 con el análisis en caso de éxito', async () => {
      const analysis = {
        insights: [{ type: 'frequency', title: 't', description: 'd', confidence: 0.8 }],
        metadata: { productsAnalyzed: 3 }
      };
      habitsUseCase.execute.mockResolvedValue(new Success(analysis));
      const res = makeRes();
      await controller.analyzePurchaseHabits(
        makeReq({ params: { userId: VALID_UUID }, query: { timeRange: '30d' } }),
        res
      );
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(analysis);
      expect(habitsUseCase.execute).toHaveBeenCalledWith(
        { userId: VALID_UUID, timeRange: '30d' },
        'u-1',
        'USER'
      );
    });

    it('devuelve 500 si el use case lanza una excepción', async () => {
      habitsUseCase.execute.mockRejectedValue(new Error('crash'));
      const res = makeRes();
      await controller.analyzePurchaseHabits(makeReq({ params: { userId: VALID_UUID } }), res);
      expect(res.statusCode).toBe(500);
      expect(res.body.code).toBe('INTERNAL_SERVER_ERROR');
    });
  });

  describe('suggestCategories (CU-28)', () => {
    it('devuelve 503 si el use case no está disponible', async () => {
      const controllerSinUC = new AIController(undefined);
      const res = makeRes();
      await controllerSinUC.suggestCategories(makeReq({ body: { productName: 'Leche' } }), res);
      expect(res.statusCode).toBe(503);
      expect(res.body.error.code).toBe('FEATURE_NOT_AVAILABLE');
    });

    it('devuelve 400 si falta el nombre del producto', async () => {
      const res = makeRes();
      await controller.suggestCategories(makeReq({ body: { productName: '   ' } }), res);
      expect(res.statusCode).toBe(400);
      expect(res.body.code).toBe('INVALID_PRODUCT_NAME');
    });

    it('devuelve 400 si el nombre excede 100 caracteres', async () => {
      const res = makeRes();
      await controller.suggestCategories(makeReq({ body: { productName: 'x'.repeat(101) } }), res);
      expect(res.statusCode).toBe(400);
      expect(res.body.code).toBe('PRODUCT_NAME_TOO_LONG');
    });

    it('mapea ValidationError del use case a 400', async () => {
      suggestionsUseCase.execute.mockResolvedValue(
        new Failure(new ValidationError('Producto vacío', 'productName', ''))
      );
      const res = makeRes();
      await controller.suggestCategories(makeReq({ body: { productName: 'Leche' } }), res);
      expect(res.statusCode).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('mapea otros errores del use case a 500', async () => {
      suggestionsUseCase.execute.mockResolvedValue(new Failure(new Error('IA caída')));
      const res = makeRes();
      await controller.suggestCategories(makeReq({ body: { productName: 'Leche' } }), res);
      expect(res.statusCode).toBe(500);
      expect(res.body.code).toBe('INTERNAL_SERVER_ERROR');
    });

    it('devuelve 200 con las sugerencias en caso de éxito', async () => {
      suggestionsUseCase.execute.mockResolvedValue(
        new Success({
          productName: 'Leche',
          suggestions: [
            { category: 'Lácteos', confidence: 0.95, reasoning: 'por tipo' },
            { category: 'Desayuno', confidence: 0.6 }
          ],
          cached: true,
          requestId: 'req-1',
          timestamp: '2025-11-30T00:00:00Z'
        })
      );
      const res = makeRes();
      await controller.suggestCategories(
        makeReq({ body: { productName: 'Leche', storeName: 'Mercadona' } }),
        res
      );
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.cached).toBe(true);
      expect(res.body.data.suggestions).toHaveLength(2);
      expect(res.body.data.suggestions[0]).toEqual({
        category: 'Lácteos',
        confidence: 0.95,
        reasoning: 'por tipo'
      });
    });

    it('devuelve 500 si el use case lanza una excepción', async () => {
      suggestionsUseCase.execute.mockRejectedValue(new Error('crash'));
      const res = makeRes();
      await controller.suggestCategories(makeReq({ body: { productName: 'Leche' } }), res);
      expect(res.statusCode).toBe(500);
      expect(res.body.code).toBe('UNEXPECTED_ERROR');
    });
  });

  describe('bulkCategorize (CU-29)', () => {
    const dtoOk = { products: [{ name: 'Leche' }], tiendaId: 't-1' };

    it('devuelve 503 si el use case no está disponible', async () => {
      const controllerSinUC = new AIController(undefined, undefined);
      const res = makeRes();
      await controllerSinUC.bulkCategorize(makeReq({ body: { products: [] } }), res);
      expect(res.statusCode).toBe(503);
      expect(res.body.error.code).toBe('FEATURE_NOT_AVAILABLE');
    });

    it('devuelve 400 si la validación del DTO falla', async () => {
      (BulkCategorizeProductsDtoFactory.fromHttpRequest as jest.Mock).mockImplementation(() => {
        throw new Error('products debe ser un array');
      });
      const res = makeRes();
      await controller.bulkCategorize(makeReq({ body: { products: 'no-soy-array' } }), res);
      expect(res.statusCode).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('mapea errores "no encontrado" a 404', async () => {
      (BulkCategorizeProductsDtoFactory.fromHttpRequest as jest.Mock).mockReturnValue(dtoOk);
      bulkUseCase.execute.mockResolvedValue(
        new Failure(new Error('Tienda no encontrado'))
      );
      const res = makeRes();
      await controller.bulkCategorize(makeReq({ body: dtoOk }), res);
      expect(res.statusCode).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('mapea otros errores del use case a 500', async () => {
      (BulkCategorizeProductsDtoFactory.fromHttpRequest as jest.Mock).mockReturnValue(dtoOk);
      bulkUseCase.execute.mockResolvedValue(new Failure(new Error('IA caída')));
      const res = makeRes();
      await controller.bulkCategorize(makeReq({ body: dtoOk }), res);
      expect(res.statusCode).toBe(500);
      expect(res.body.error.code).toBe('PROCESSING_ERROR');
    });

    it('devuelve 207 si hay fallos parciales', async () => {
      (BulkCategorizeProductsDtoFactory.fromHttpRequest as jest.Mock).mockReturnValue(dtoOk);
      bulkUseCase.execute.mockResolvedValue(
        new Success({
          categorizedProducts: [{ name: 'Leche', category: 'Lácteos' }],
          batchStats: { successful: 1, failed: 1, fromCache: 0, fromAI: 1, averageConfidence: 0.8 }
        })
      );
      const res = makeRes();
      await controller.bulkCategorize(makeReq({ body: dtoOk }), res);
      expect(res.statusCode).toBe(207);
      expect(res.body.success).toBe(true);
      expect(res.body.data.batchStats.failed).toBe(1);
    });

    it('devuelve 200 si todo se categorizó correctamente', async () => {
      (BulkCategorizeProductsDtoFactory.fromHttpRequest as jest.Mock).mockReturnValue(dtoOk);
      bulkUseCase.execute.mockResolvedValue(
        new Success({
          categorizedProducts: [{ name: 'Leche', category: 'Lácteos' }],
          batchStats: { successful: 2, failed: 0, fromCache: 1, fromAI: 1, averageConfidence: 0.9 }
        })
      );
      const res = makeRes();
      await controller.bulkCategorize(makeReq({ body: dtoOk }), res);
      expect(res.statusCode).toBe(200);
      expect(res.body.data.batchStats.successful).toBe(2);
    });

    it('devuelve 500 si el use case lanza una excepción', async () => {
      (BulkCategorizeProductsDtoFactory.fromHttpRequest as jest.Mock).mockReturnValue(dtoOk);
      bulkUseCase.execute.mockRejectedValue(new Error('crash'));
      const res = makeRes();
      await controller.bulkCategorize(makeReq({ body: dtoOk }), res);
      expect(res.statusCode).toBe(500);
      expect(res.body.error.code).toBe('INTERNAL_SERVER_ERROR');
    });
  });

  describe('healthCheck', () => {
    it('devuelve 200 con estado healthy', async () => {
      const res = makeRes();
      await controller.healthCheck(makeReq(), res);
      expect(res.statusCode).toBe(200);
      expect(res.body.data.status).toBe('healthy');
      expect(res.body.data.features.categorySuggestions).toBe(true);
    });
  });

  describe('getUsageInfo', () => {
    it('devuelve 403 para usuarios no admin', async () => {
      const res = makeRes();
      await controller.getUsageInfo(makeReq({ user: { userId: 'u-1', rol: 'USER' } }), res);
      expect(res.statusCode).toBe(403);
      expect(res.body.code).toBe('ACCESS_DENIED');
    });

    it('devuelve 403 si no hay usuario', async () => {
      const res = makeRes();
      await controller.getUsageInfo(makeReq({ user: undefined }), res);
      expect(res.statusCode).toBe(403);
    });

    it('devuelve 503 cuando no hay caso de uso de uso de IA aunque sea admin', async () => {
      const res = makeRes();
      await controller.getUsageInfo(makeReq({ user: { userId: 'a-1', rol: 'ADMIN' } }), res);
      expect(res.statusCode).toBe(503);
      expect(res.body.code).toBe('AI_USAGE_NOT_AVAILABLE');
    });

    it('devuelve 200 con los agregados reales para admin con caso de uso', async () => {
      const usage = { tokensUsed: 1250, requestsThisMonth: 42 };
      const usageUseCase = {
        usageEventRepository: {} as any,
        getProviderInfo: () => ({ provider: 'freellmapi', model: 'test-model' }),
        execute: jest.fn().mockResolvedValue(usage)
      } as any;
      const controllerConUso = new AIController(
        suggestionsUseCase,
        bulkUseCase,
        habitsUseCase,
        usageUseCase
      );
      const res = makeRes();
      await controllerConUso.getUsageInfo(makeReq({ user: { userId: 'a-1', rol: 'ADMIN' } }), res);
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(usage);
    });
  });
});
