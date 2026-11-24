/**
 * Tests unitarios para RecommendationsController (CU-33)
 */

import { RecommendationsController } from '../../../../../src/infrastructure/http/controllers/RecommendationsController';

const makeReq = (overrides: any = {}): any => ({
  body: {}, params: {}, query: {}, userId: 'user-1', ...overrides
});

const makeRes = (): any => {
  const res: any = {
    statusCode: 0,
    body: undefined,
    status(code: number) { res.statusCode = code; return res; },
    json(payload: unknown) { res.body = payload; return res; }
  };
  return res;
};

describe('RecommendationsController (CU-33)', () => {
  let useCase: any;
  let controller: RecommendationsController;

  beforeEach(() => {
    useCase = { execute: jest.fn() };
    controller = new RecommendationsController(useCase);
  });

  describe('getListRecommendations', () => {
    it('sin listId → 400', async () => {
      const res = makeRes();
      await controller.getListRecommendations(makeReq(), res);

      expect(res.statusCode).toBe(400);
      expect(useCase.execute).not.toHaveBeenCalled();
    });

    it('devuelve 200 con las recomendaciones y _meta', async () => {
      useCase.execute.mockResolvedValue({
        isSuccess: true,
        value: { listId: 'l1', recommendations: [{ name: 'Pan' }], metadata: { processingTime: 5 } }
      });

      const res = makeRes();
      await controller.getListRecommendations(
        makeReq({ params: { listId: 'l1' }, query: { maxRecommendations: '5', context: 'cena' } }), res
      );

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.recommendations).toHaveLength(1);
      expect(res.body._meta.processingTime).toBeGreaterThanOrEqual(0);
      expect(useCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({ listId: 'l1', maxRecommendations: 5, context: 'cena' }),
        'user-1'
      );
    });

    it('error "no encontrada" → 404', async () => {
      useCase.execute.mockResolvedValue({ isFailure: true, error: new Error('Lista no encontrada') });

      const res = makeRes();
      await controller.getListRecommendations(makeReq({ params: { listId: 'l1' } }), res);

      expect(res.statusCode).toBe(404);
    });

    it('error de permisos → 403', async () => {
      useCase.execute.mockResolvedValue({ isFailure: true, error: new Error('No tienes permisos') });

      const res = makeRes();
      await controller.getListRecommendations(makeReq({ params: { listId: 'l1' } }), res);

      expect(res.statusCode).toBe(403);
    });

    it('lista vacía → 400', async () => {
      useCase.execute.mockResolvedValue({ isFailure: true, error: new Error('La lista está vacía') });

      const res = makeRes();
      await controller.getListRecommendations(makeReq({ params: { listId: 'l1' } }), res);

      expect(res.statusCode).toBe(400);
    });

    it('excepción inesperada → 500', async () => {
      useCase.execute.mockRejectedValue(new Error('boom'));

      const res = makeRes();
      await controller.getListRecommendations(makeReq({ params: { listId: 'l1' } }), res);

      expect(res.statusCode).toBe(500);
    });
  });

  describe('getProductSpecificRecommendations', () => {
    it('usa productId en el DTO', async () => {
      useCase.execute.mockResolvedValue({ isSuccess: true, value: { recommendations: [] } });

      const res = makeRes();
      await controller.getProductSpecificRecommendations(
        makeReq({ params: { listId: 'l1', productId: 'p1' } }), res
      );

      expect(res.statusCode).toBe(200);
      expect(useCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({ listId: 'l1', productId: 'p1' }),
        'user-1'
      );
    });
  });

  describe('getContextExamples', () => {
    it('devuelve ejemplos públicos y tips', async () => {
      const res = makeRes();
      await controller.getContextExamples(makeReq(), res);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.examples.length).toBeGreaterThan(0);
      expect(res.body.data.tips.length).toBeGreaterThan(0);
    });
  });
});
