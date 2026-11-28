/**
 * Tests unitarios para AuditController
 * Usa use cases mockeados y objetos req/res simulados: parsing de query,
 * validaciones y códigos HTTP.
 */

import { AuditController } from '../../../../../src/infrastructure/http/controllers/AuditController';
import { ValidationError } from '../../../../../src/application/errors/ValidationError';

const makeReq = (overrides: any = {}): any => ({
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

const successResult = <T>(value: T) => ({ isSuccess: true, isFailure: false, value });
const failureResult = (error: unknown) => ({ isSuccess: false, isFailure: true, error });

const validationError = () => {
  const err = new ValidationError('Parámetros inválidos', 'page', 0);
  (err as any).toJSON = () => ({ fields: { page: 'debe ser >= 1' } });
  return err;
};

describe('AuditController', () => {
  let forList: any;
  let forProduct: any;
  let global: any;
  let controller: AuditController;

  beforeEach(() => {
    forList = { execute: jest.fn().mockResolvedValue(successResult({ entries: [], total: 0 })) };
    forProduct = { execute: jest.fn().mockResolvedValue(successResult({ entries: [], total: 0 })) };
    global = { execute: jest.fn().mockResolvedValue(successResult({ entries: [], total: 0 })) };
    controller = new AuditController(forList, forProduct, global);
  });

  describe('getListAuditHistory', () => {
    it('400 sin listId', async () => {
      const res = makeRes();
      await controller.getListAuditHistory(makeReq(), res);
      expect(res.statusCode).toBe(400);
      expect(res.body.message).toContain('lista');
      expect(forList.execute).not.toHaveBeenCalled();
    });

    it('200 con resultado del use case', async () => {
      const res = makeRes();
      await controller.getListAuditHistory(makeReq({ params: { listId: 'l1' } }), res);
      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe('success');
      expect(forList.execute).toHaveBeenCalledWith({ listId: 'l1' });
    });

    it('parsea y filtra query params válidos', async () => {
      const res = makeRes();
      await controller.getListAuditHistory(makeReq({
        params: { listId: 'l1' },
        query: {
          page: '2', pageSize: '25', changeType: 'UPDATE',
          changedByUserId: 'u1', startDate: '2025-01-01', endDate: '2025-12-31'
        }
      }), res);

      expect(forList.execute).toHaveBeenCalledWith(expect.objectContaining({
        listId: 'l1', page: 2, pageSize: 25, changeType: 'UPDATE',
        changedByUserId: 'u1',
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-12-31')
      }));
    });

    it('ignora query params inválidos (pageSize negativo pasa como entero)', async () => {
      const res = makeRes();
      await controller.getListAuditHistory(makeReq({
        params: { listId: 'l1' },
        query: { page: 'abc', pageSize: '-3', changeType: 'NOEXISTE', startDate: 'no-fecha' }
      }), res);

      // page/changeType/startDate se descartan; pageSize='-3' se parsea como -3
      // (el límite de negocio lo valida el use case)
      expect(forList.execute).toHaveBeenCalledWith({ listId: 'l1', pageSize: -3 });
    });

    it('ValidationError → 400 con toJSON', async () => {
      forList.execute.mockResolvedValue(failureResult(validationError()));
      const res = makeRes();
      await controller.getListAuditHistory(makeReq({ params: { listId: 'l1' } }), res);
      expect(res.statusCode).toBe(400);
      expect(res.body.errors).toEqual({ fields: { page: 'debe ser >= 1' } });
    });

    it('error genérico → 500', async () => {
      forList.execute.mockResolvedValue(failureResult(new Error('db')));
      const res = makeRes();
      await controller.getListAuditHistory(makeReq({ params: { listId: 'l1' } }), res);
      expect(res.statusCode).toBe(500);
    });
  });

  describe('getProductAuditHistory', () => {
    it('400 sin productId', async () => {
      const res = makeRes();
      await controller.getProductAuditHistory(makeReq(), res);
      expect(res.statusCode).toBe(400);
      expect(res.body.message).toContain('producto');
    });

    it('200 con producto y filtros', async () => {
      const res = makeRes();
      await controller.getProductAuditHistory(makeReq({
        params: { productId: 'p1' },
        query: { changeType: 'DELETE', page: '1' }
      }), res);
      expect(res.statusCode).toBe(200);
      expect(forProduct.execute).toHaveBeenCalledWith({
        productId: 'p1', page: 1, changeType: 'DELETE'
      });
    });

    it('ValidationError → 400 y genérico → 500', async () => {
      forProduct.execute.mockResolvedValue(failureResult(validationError()));
      const res = makeRes();
      await controller.getProductAuditHistory(makeReq({ params: { productId: 'p1' } }), res);
      expect(res.statusCode).toBe(400);

      forProduct.execute.mockResolvedValue(failureResult(new Error('x')));
      const res2 = makeRes();
      await controller.getProductAuditHistory(makeReq({ params: { productId: 'p1' } }), res2);
      expect(res2.statusCode).toBe(500);
    });
  });

  describe('getGlobalAuditHistoryRoute', () => {
    it('pasa entityType/entityId recortados', async () => {
      const res = makeRes();
      await controller.getGlobalAuditHistoryRoute(makeReq({
        query: { entityType: '  Lista  ', entityId: ' l9 ', page: '3' }
      }), res);

      expect(res.statusCode).toBe(200);
      expect(global.execute).toHaveBeenCalledWith(expect.objectContaining({
        entityType: 'Lista', entityId: 'l9', page: 3
      }));
    });

    it('sin filtros llama con objeto vacío', async () => {
      const res = makeRes();
      await controller.getGlobalAuditHistoryRoute(makeReq(), res);
      expect(global.execute).toHaveBeenCalledWith({});
    });

    it('ValidationError → 400 y genérico → 500', async () => {
      global.execute.mockResolvedValue(failureResult(validationError()));
      const res = makeRes();
      await controller.getGlobalAuditHistoryRoute(makeReq(), res);
      expect(res.statusCode).toBe(400);

      global.execute.mockResolvedValue(failureResult(new Error('x')));
      const res2 = makeRes();
      await controller.getGlobalAuditHistoryRoute(makeReq(), res2);
      expect(res2.statusCode).toBe(500);
    });
  });

  describe('getAdminAuditLogs', () => {
    it('200 con sobre {success, data} y filtros pasados al use case', async () => {
      const res = makeRes();
      await controller.getAdminAuditLogs(makeReq({
        query: {
          page: '2', pageSize: '20', entityType: 'Producto', changeType: 'UPDATE',
          changedByUserId: 'u1', startDate: '2025-01-01', endDate: '2025-12-31'
        }
      }), res);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(global.execute).toHaveBeenCalledWith(expect.objectContaining({
        page: 2, pageSize: 20, entityType: 'Producto', changeType: 'UPDATE',
        changedByUserId: 'u1',
        startDate: new Date('2025-01-01'),
        endDate: new Date('2025-12-31')
      }));
    });

    it('sin filtros llama con objeto vacío', async () => {
      const res = makeRes();
      await controller.getAdminAuditLogs(makeReq(), res);
      expect(res.statusCode).toBe(200);
      expect(global.execute).toHaveBeenCalledWith({});
    });

    it('ValidationError → 400 con success false y genérico → 500', async () => {
      global.execute.mockResolvedValue(failureResult(validationError()));
      const res = makeRes();
      await controller.getAdminAuditLogs(makeReq(), res);
      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errors).toEqual({ fields: { page: 'debe ser >= 1' } });

      global.execute.mockResolvedValue(failureResult(new Error('x')));
      const res2 = makeRes();
      await controller.getAdminAuditLogs(makeReq(), res2);
      expect(res2.statusCode).toBe(500);
      expect(res2.body.success).toBe(false);
    });
  });
});
