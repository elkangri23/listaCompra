/**
 * Tests unitarios para StoreController (CU-26)
 * Usa use cases mockeados y objetos req/res simulados.
 */

import { StoreController } from '../../../../../src/infrastructure/http/controllers/StoreController';
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
    body: undefined as any,
    status(code: number) { res.statusCode = code; return res; },
    json(payload: unknown) { res.body = payload; return res; }
  };
  return res;
};

const successResult = (value: unknown) => ({ isSuccess: true, isFailure: false, value });
const failureResult = (error: unknown) => ({ isSuccess: false, isFailure: true, error });

describe('StoreController', () => {
  let createStore: any;
  let getStores: any;
  let updateStore: any;
  let deleteStore: any;
  let controller: StoreController;

  beforeEach(() => {
    createStore = { execute: jest.fn() };
    getStores = { execute: jest.fn() };
    updateStore = { execute: jest.fn() };
    deleteStore = { execute: jest.fn() };
    controller = new StoreController(createStore, getStores, updateStore, deleteStore);
  });

  describe('create', () => {
    it('devuelve 201 con la tienda creada', async () => {
      createStore.execute.mockResolvedValue(successResult({ id: 't1', nombre: 'Mercadona' }));
      const res = makeRes();
      await controller.create(makeReq({ body: { nombre: 'Mercadona', direccion: 'c/ Falsa 123' } }), res);

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe('t1');
      expect(createStore.execute).toHaveBeenCalledWith(
        expect.objectContaining({ nombre: 'Mercadona', direccion: 'c/ Falsa 123' })
      );
    });

    it('400 con InvalidValueError', async () => {
      createStore.execute.mockResolvedValue(failureResult(new InvalidValueError('nombre requerido', 'nombre', '')));
      const res = makeRes();
      await controller.create(makeReq({ body: { nombre: '' } }), res);
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe('Datos inválidos');
      expect(res.body.details.field).toBe('nombre');
    });

    it('409 con BusinessRuleViolationError', async () => {
      createStore.execute.mockResolvedValue(failureResult(new BusinessRuleViolationError('duplicada', 'nombre-unico')));
      const res = makeRes();
      await controller.create(makeReq({ body: { nombre: 'Mercadona' } }), res);
      expect(res.statusCode).toBe(409);
      expect(res.body.details.rule).toBe('nombre-unico');
    });

    it('500 si el use case lanza', async () => {
      createStore.execute.mockRejectedValue(new Error('boom'));
      const res = makeRes();
      await controller.create(makeReq({ body: { nombre: 'x' } }), res);
      expect(res.statusCode).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  describe('getAll', () => {
    it('mapea query params al DTO', async () => {
      getStores.execute.mockResolvedValue(successResult({ tiendas: [], total: 0 }));
      const res = makeRes();
      await controller.getAll(makeReq({ query: { page: '2', limit: '20', activas: 'true', search: 'mer' } }), res);

      expect(res.statusCode).toBe(200);
      expect(getStores.execute).toHaveBeenCalledWith(
        expect.objectContaining({ page: 2, limit: 20, activas: true, search: 'mer' })
      );
    });

    it('activas=false mapea a false y sin params no añade nada', async () => {
      getStores.execute.mockResolvedValue(successResult({ tiendas: [] }));
      await controller.getAll(makeReq({ query: { activas: 'false', tipo: 'supermercado' } }), makeRes());
      expect(getStores.execute).toHaveBeenCalledWith(
        expect.objectContaining({ activas: false, tipo: 'supermercado' })
      );

      getStores.execute.mockClear();
      await controller.getAll(makeReq(), makeRes());
      expect(getStores.execute).toHaveBeenCalledWith({});
    });

    it('errores de dominio y excepciones', async () => {
      getStores.execute.mockResolvedValue(failureResult(new InvalidValueError('bad', 'page', -1)));
      const res = makeRes();
      await controller.getAll(makeReq(), res);
      expect(res.statusCode).toBe(400);

      getStores.execute.mockRejectedValue(new Error('boom'));
      const res2 = makeRes();
      await controller.getAll(makeReq(), res2);
      expect(res2.statusCode).toBe(500);
    });
  });

  describe('getById', () => {
    it('400 sin id', async () => {
      const res = makeRes();
      await controller.getById(makeReq(), res);
      expect(res.statusCode).toBe(400);
      expect(getStores.execute).not.toHaveBeenCalled();
    });

    it('200 con la primera tienda del resultado', async () => {
      getStores.execute.mockResolvedValue(successResult({ tiendas: [{ id: 't1', nombre: 'Mercadona' }] }));
      const res = makeRes();
      await controller.getById(makeReq({ params: { id: 't1' } }), res);
      expect(res.statusCode).toBe(200);
      expect(res.body.data.id).toBe('t1');
      expect(getStores.execute).toHaveBeenCalledWith({ id: 't1' });
    });

    it('404 si no hay tiendas', async () => {
      getStores.execute.mockResolvedValue(successResult({ tiendas: [] }));
      const res = makeRes();
      await controller.getById(makeReq({ params: { id: 'x' } }), res);
      expect(res.statusCode).toBe(404);
    });

    it('errores de dominio y excepciones', async () => {
      getStores.execute.mockResolvedValue(failureResult(new InvalidValueError('mal', 'id', 'x')));
      const res = makeRes();
      await controller.getById(makeReq({ params: { id: 'x' } }), res);
      expect(res.statusCode).toBe(400);

      getStores.execute.mockRejectedValue(new Error('boom'));
      const res2 = makeRes();
      await controller.getById(makeReq({ params: { id: 'x' } }), res2);
      expect(res2.statusCode).toBe(500);
    });
  });

  describe('update', () => {
    it('devuelve 200 con la tienda actualizada', async () => {
      updateStore.execute.mockResolvedValue(successResult({ id: 't1', nombre: 'Nuevo' }));
      const res = makeRes();
      await controller.update(makeReq({ params: { id: 't1' }, body: { nombre: 'Nuevo', activa: false } }), res);

      expect(res.statusCode).toBe(200);
      expect(updateStore.execute).toHaveBeenCalledWith(
        expect.objectContaining({ id: 't1', nombre: 'Nuevo', activa: false })
      );
    });

    it('400 sin id, 400/409 con errores de dominio y 500 con excepción', async () => {
      const res = makeRes();
      await controller.update(makeReq({ body: { nombre: 'x' } }), res);
      expect(res.statusCode).toBe(400);

      updateStore.execute.mockResolvedValue(failureResult(new BusinessRuleViolationError('dup', 'r1')));
      const res2 = makeRes();
      await controller.update(makeReq({ params: { id: 't1' }, body: {} }), res2);
      expect(res2.statusCode).toBe(409);

      updateStore.execute.mockRejectedValue(new Error('boom'));
      const res3 = makeRes();
      await controller.update(makeReq({ params: { id: 't1' }, body: {} }), res3);
      expect(res3.statusCode).toBe(500);
    });
  });

  describe('delete', () => {
    it('200 al eliminar', async () => {
      deleteStore.execute.mockResolvedValue(successResult(undefined));
      const res = makeRes();
      await controller.delete(makeReq({ params: { id: 't1' } }), res);
      expect(res.statusCode).toBe(200);
      expect(res.body.message).toContain('eliminada');
      expect(deleteStore.execute).toHaveBeenCalledWith({ id: 't1' });
    });

    it('400 sin id y 500 con excepción', async () => {
      const res = makeRes();
      await controller.delete(makeReq(), res);
      expect(res.statusCode).toBe(400);

      deleteStore.execute.mockRejectedValue(new Error('boom'));
      const res2 = makeRes();
      await controller.delete(makeReq({ params: { id: 't1' } }), res2);
      expect(res2.statusCode).toBe(500);
    });
  });

  describe('toggleStatus / getCategories', () => {
    it('toggleStatus pasa activa al updateStore', async () => {
      updateStore.execute.mockResolvedValue(successResult({ id: 't1', activa: true }));
      const res = makeRes();
      await controller.toggleStatus(makeReq({ params: { id: 't1' }, body: { activa: true } }), res);
      expect(res.statusCode).toBe(200);
      expect(updateStore.execute).toHaveBeenCalledWith({ id: 't1', activa: true });
    });

    it('getCategories redirige a /categories?tiendaId', async () => {
      const req = makeReq({ params: { id: 't1' } });
      const res = makeRes();
      await controller.getCategories(req, res);
      expect(res.statusCode).toBe(200);
      expect(req.query['tiendaId']).toBe('t1');
      expect(res.body.message).toContain('/api/categories?tiendaId=t1');
    });

    it('getCategories 400 sin id y 500 con excepción', async () => {
      const res = makeRes();
      await controller.getCategories(makeReq(), res);
      expect(res.statusCode).toBe(400);

      const req = makeReq({ params: { id: 't1' } });
      Object.defineProperty(req, 'query', { get() { throw new Error('boom'); } });
      const res2 = makeRes();
      await controller.getCategories(req, res2);
      expect(res2.statusCode).toBe(500);
    });
  });
});
