/**
 * Tests unitarios para OccasionListController (CU-32).
 */

import { OccasionListController } from '../../../../../src/infrastructure/http/controllers/OccasionListController';
import { PREDEFINED_OCCASIONS } from '../../../../../src/application/dto/lists/CreateOccasionListDto';

const makeReq = (over: Record<string, unknown> = {}) => ({ user: { id: 'u1' }, body: {}, ...over }) as any;

const makeRes = () => {
  const res: any = { statusCode: 0 };
  res.status = jest.fn((c: number) => { res.statusCode = c; return res; });
  res.json = jest.fn((b: unknown) => { res.body = b; return res; });
  return res;
};

const makeUseCase = () => ({
  execute: jest.fn().mockResolvedValue({
    isSuccess: true,
    isFailure: false,
    value: {
      listId: 'l1',
      listName: 'Barbacoa (4 personas)',
      occasionDescription: 'desc',
      products: [],
      summary: { totalProducts: 10, estimatedCost: 50, categoriesIncluded: [], restrictionsApplied: [] },
      processingTime: 100,
      aiConfidence: 0.85
    }
  })
});

const validDto = { occasion: 'Barbacoa', numberOfPeople: 4 };

describe('OccasionListController', () => {
  let useCase: ReturnType<typeof makeUseCase>;
  let controller: OccasionListController;

  beforeEach(() => {
    useCase = makeUseCase();
    controller = new OccasionListController(useCase as any);
  });

  describe('getPredefinedOccasions', () => {
    it('200 con el catálogo de ocasiones', async () => {
      const res = makeRes();
      await controller.getPredefinedOccasions(makeReq(), res);
      expect(res.statusCode).toBe(200);
      expect(res.body.data.occasions).toEqual(PREDEFINED_OCCASIONS);
      expect(res.body.data.total).toBe(PREDEFINED_OCCASIONS.length);
    });
  });

  describe('generateOccasionList', () => {
    it('401 sin usuario autenticado', async () => {
      const res = makeRes();
      await controller.generateOccasionList(makeReq({ user: undefined }), res);
      expect(res.statusCode).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('400 con DTO inválido', async () => {
      const res = makeRes();
      await controller.generateOccasionList(makeReq({ body: { occasion: '', numberOfPeople: 0 } }), res);
      expect(res.statusCode).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(res.body.error.details.length).toBeGreaterThan(0);
    });

    it('400 con numberOfPeople > 50', async () => {
      const res = makeRes();
      await controller.generateOccasionList(makeReq({ body: { ...validDto, numberOfPeople: 100 } }), res);
      expect(res.statusCode).toBe(400);
    });

    it('201 con lista generada', async () => {
      const res = makeRes();
      await controller.generateOccasionList(makeReq({ body: validDto }), res);
      expect(useCase.execute).toHaveBeenCalledWith(validDto, 'u1');
      expect(res.statusCode).toBe(201);
      expect(res.body.data.listId).toBe('l1');
      expect(res.body.data.summary.totalProducts).toBe(10);
      expect(res.body.meta.processingTime).toBeGreaterThanOrEqual(0);
    });

    it('mapea errores del use case (ValidationError → 400, NotFoundError → 404, otros → 500)', async () => {
      const { ValidationError, NotFoundError } = await import('../../../../../src/application/errors');
      const errors: [Error, number, string][] = [
        [new ValidationError('campo inválido', 'occasion', 'x'), 400, 'VALIDATION_ERROR'],
        [new NotFoundError('Ocasion', 'x'), 404, 'NOT_FOUND'],
        [new Error('boom'), 500, 'INTERNAL_SERVER_ERROR']
      ];
      for (const [error, status, code] of errors) {
        useCase.execute.mockResolvedValueOnce({ isSuccess: false, isFailure: true, error });
        const res = makeRes();
        await controller.generateOccasionList(makeReq({ body: validDto }), res);
        expect(res.statusCode).toBe(status);
        expect(res.body.error.code).toBe(code);
      }
    });

    it('500 si el use case lanza', async () => {
      useCase.execute.mockRejectedValue(new Error('crash'));
      const res = makeRes();
      await controller.generateOccasionList(makeReq({ body: validDto }), res);
      expect(res.statusCode).toBe(500);
    });
  });

  describe('previewOccasionList', () => {
    it('401 sin usuario autenticado', async () => {
      const res = makeRes();
      await controller.previewOccasionList(makeReq({ user: undefined }), res);
      expect(res.statusCode).toBe(401);
    });

    it('200 con preview para DTO válido', async () => {
      const res = makeRes();
      await controller.previewOccasionList(makeReq({ body: { ...validDto, maxBudget: 100 } }), res);
      expect(res.statusCode).toBe(200);
      expect(res.body.data.preview).toBe(true);
      expect(res.body.data.occasion).toBe('Barbacoa');
      expect(res.body.data.estimatedCost).toBe(80);
      expect(res.body.data.estimatedProducts).toBeGreaterThanOrEqual(5);
    });

    it('400 con DTO inválido', async () => {
      const res = makeRes();
      await controller.previewOccasionList(makeReq({ body: { ...validDto, maxBudget: -5 } }), res);
      expect(res.statusCode).toBe(400);
    });
  });
});
