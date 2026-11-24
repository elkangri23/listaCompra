/**
 * Tests unitarios para CategoryController (CU-11..CU-14)
 * Usa use cases mockeados y objetos req/res simulados.
 */

import { CategoryController } from '../../../../../src/infrastructure/http/controllers/CategoryController';
import { InvalidValueError, BusinessRuleViolationError } from '../../../../../src/domain/errors/DomainError';

const makeReq = (overrides: any = {}): any => ({
  body: {},
  params: {},
  query: {},
  ...overrides
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

describe('CategoryController', () => {
  let createUseCase: any;
  let getByStoreUseCase: any;
  let updateUseCase: any;
  let deleteUseCase: any;
  let controller: CategoryController;

  beforeEach(() => {
    createUseCase = { execute: jest.fn() };
    getByStoreUseCase = { execute: jest.fn() };
    updateUseCase = { execute: jest.fn() };
    deleteUseCase = { execute: jest.fn() };
    controller = new CategoryController(createUseCase, getByStoreUseCase, updateUseCase, deleteUseCase);
  });

  describe('create', () => {
    it('devuelve 201 con la categoría creada', async () => {
      createUseCase.execute.mockResolvedValue({ isSuccess: true, value: { id: 'c1', nombre: 'Lácteos' } });

      const res = makeRes();
      await controller.create(makeReq({ body: { nombre: 'Lácteos' } }), res);

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe('c1');
    });

    it('mapea InvalidValueError a 400', async () => {
      createUseCase.execute.mockResolvedValue({
        isFailure: true,
        error: new InvalidValueError('nombre requerido', 'nombre', '')
      });

      const res = makeRes();
      await controller.create(makeReq({ body: {} }), res);

      expect(res.statusCode).toBe(400);
      expect(res.body.error.type).toBe('VALIDATION_ERROR');
      expect(res.body.error.field).toBe('nombre');
    });

    it('mapea BusinessRuleViolationError CATEGORIA_DUPLICADA a 409', async () => {
      createUseCase.execute.mockResolvedValue({
        isFailure: true,
        error: new BusinessRuleViolationError('duplicada', 'CATEGORIA_DUPLICADA')
      });

      const res = makeRes();
      await controller.create(makeReq({ body: {} }), res);

      expect(res.statusCode).toBe(409);
      expect(res.body.error.rule).toBe('CATEGORIA_DUPLICADA');
    });

    it('mapea TIENDA_INACTIVA a 422', async () => {
      updateUseCase.execute.mockResolvedValue({
        isFailure: true,
        error: new BusinessRuleViolationError('inactiva', 'TIENDA_INACTIVA')
      });

      const res = makeRes();
      await controller.moveToStore(makeReq({ params: { id: 'c1' }, body: { tiendaId: 't1' } }), res);

      expect(res.statusCode).toBe(422);
    });

    it('excepción inesperada → 500', async () => {
      createUseCase.execute.mockRejectedValue(new Error('boom'));

      const res = makeRes();
      await controller.create(makeReq({ body: {} }), res);

      expect(res.statusCode).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  describe('getByStore', () => {
    it('pasa tiendaId y activas al use case', async () => {
      getByStoreUseCase.execute.mockResolvedValue({ isSuccess: true, value: [] });

      const res = makeRes();
      await controller.getByStore(makeReq({ query: { tiendaId: 't1', activas: 'true' } }), res);

      expect(res.statusCode).toBe(200);
      expect(getByStoreUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({ tiendaId: 't1', activas: true })
      );
    });

    it('includeInactive=true se propaga', async () => {
      getByStoreUseCase.execute.mockResolvedValue({ isSuccess: true, value: [] });

      const res = makeRes();
      await controller.getByStore(makeReq({ query: { includeInactive: 'true' } }), res);

      expect(getByStoreUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({ includeInactive: true })
      );
    });
  });

  describe('update / delete / toggleStatus', () => {
    it('update sin id → 400', async () => {
      const res = makeRes();
      await controller.update(makeReq(), res);

      expect(res.statusCode).toBe(400);
      expect(updateUseCase.execute).not.toHaveBeenCalled();
    });

    it('update devuelve 200', async () => {
      updateUseCase.execute.mockResolvedValue({ isSuccess: true, value: { id: 'c1', nombre: 'X' } });

      const res = makeRes();
      await controller.update(makeReq({ params: { id: 'c1' }, body: { nombre: 'X' } }), res);

      expect(res.statusCode).toBe(200);
      expect(updateUseCase.execute).toHaveBeenCalledWith(expect.objectContaining({ id: 'c1', nombre: 'X' }));
    });

    it('delete sin id → 400', async () => {
      const res = makeRes();
      await controller.delete(makeReq(), res);

      expect(res.statusCode).toBe(400);
    });

    it('delete devuelve deleted', async () => {
      deleteUseCase.execute.mockResolvedValue({ isSuccess: true, value: true });

      const res = makeRes();
      await controller.delete(makeReq({ params: { id: 'c1' } }), res);

      expect(res.statusCode).toBe(200);
      expect(res.body.data.deleted).toBe(true);
    });

    it('toggleStatus sin id → 400', async () => {
      const res = makeRes();
      await controller.toggleStatus(makeReq(), res);

      expect(res.statusCode).toBe(400);
    });

    it('toggleStatus activa/desactiva con mensaje correcto', async () => {
      updateUseCase.execute.mockResolvedValue({ isSuccess: true, value: { id: 'c1', activa: false } });

      const res = makeRes();
      await controller.toggleStatus(makeReq({ params: { id: 'c1' }, body: { activa: false } }), res);

      expect(res.statusCode).toBe(200);
      expect(res.body.message).toContain('desactivada');
    });

    it('moveToStore sin id → 400', async () => {
      const res = makeRes();
      await controller.moveToStore(makeReq(), res);

      expect(res.statusCode).toBe(400);
    });

    it('moveToStore con tienda vacía usa mensaje "categorías generales"', async () => {
      updateUseCase.execute.mockResolvedValue({ isSuccess: true, value: { id: 'c1', tiendaId: null } });

      const res = makeRes();
      await controller.moveToStore(makeReq({ params: { id: 'c1' }, body: {} }), res);

      expect(res.statusCode).toBe(200);
      expect(res.body.message).toContain('categorías generales');
    });
  });

  describe('CATEGORIA_CON_PRODUCTOS', () => {
    it('mapea a 422', async () => {
      deleteUseCase.execute.mockResolvedValue({
        isFailure: true,
        error: new BusinessRuleViolationError('tiene productos', 'CATEGORIA_CON_PRODUCTOS')
      });

      const res = makeRes();
      await controller.delete(makeReq({ params: { id: 'c1' } }), res);

      expect(res.statusCode).toBe(422);
    });
  });
});
