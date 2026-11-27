import type { Request, Response } from 'express';
import { ProductController } from '../../../../../src/infrastructure/http/controllers/ProductController';
import { success, failure } from '../../../../../src/shared/result';
import { ValidationError } from '../../../../../src/application/errors/ValidationError';
import { UnauthorizedError } from '../../../../../src/application/errors/UnauthorizedError';
import { NotFoundError } from '../../../../../src/application/errors/NotFoundError';

describe('ProductController.reorderProductsInList', () => {
  const addProduct = { execute: jest.fn() } as any;
  const updateProduct = { execute: jest.fn() } as any;
  const markProductAsPurchased = { execute: jest.fn() } as any;
  const deleteProduct = { execute: jest.fn() } as any;
  const getProducts = { execute: jest.fn() } as any;
  const reorderProducts = { execute: jest.fn() } as any;
  const realTimeGateway = { publish: jest.fn() } as any;

  let controller: ProductController;

  beforeEach(() => {
    jest.resetAllMocks();
    controller = new ProductController(
      addProduct,
      updateProduct,
      markProductAsPurchased,
      deleteProduct,
      getProducts,
      reorderProducts,
      realTimeGateway
    );
  });

  const createResponse = () => {
    const res: Partial<Response> = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    return res as Response;
  };

  const createRequest = (overrides: Partial<Request> = {}) => {
    const baseUser = {
      id: 'user-1',
      userId: 'user-1',
      email: 'user1@test.com',
    };

    return {
      params: { listaId: 'list-1', ...(overrides.params as any) },
      body: overrides.body ?? {},
      user: (overrides as any).user ?? baseUser,
      ...overrides,
    } as unknown as Request;
  };

  it('200 con el sobre { success, data } y sin evento de tiempo real', async () => {
    const value = {
      listaId: 'list-1',
      productos: [{ id: 'p2', posicion: 1 }, { id: 'p1', posicion: 2 }],
      mensaje: '2 productos reordenados'
    };
    reorderProducts.execute.mockResolvedValue(success(value));
    const req = createRequest({
      body: { orden: [{ productoId: 'p2', posicion: 1 }, { productoId: 'p1', posicion: 2 }] }
    });
    const res = createResponse();

    await controller.reorderProductsInList(req as any, res);

    expect(reorderProducts.execute).toHaveBeenCalledWith(
      { listaId: 'list-1', orden: [{ productoId: 'p2', posicion: 1 }, { productoId: 'p1', posicion: 2 }] },
      'user-1'
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: value });
    expect(realTimeGateway.publish).not.toHaveBeenCalled();
  });

  it('401 sin usuario autenticado', async () => {
    const req = createRequest({ user: undefined } as any);
    const res = createResponse();

    await controller.reorderProductsInList(req as any, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(reorderProducts.execute).not.toHaveBeenCalled();
  });

  it('400 si el caso de uso devuelve ValidationError', async () => {
    reorderProducts.execute.mockResolvedValue(failure(ValidationError.create('El producto x no pertenece a la lista', 'orden', [])));
    const req = createRequest({ body: { orden: [{ productoId: 'x', posicion: 1 }] } });
    const res = createResponse();

    await controller.reorderProductsInList(req as any, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('403 si el caso de uso devuelve UnauthorizedError', async () => {
    reorderProducts.execute.mockResolvedValue(failure(new UnauthorizedError('No tienes permisos')));
    const req = createRequest({ body: { orden: [{ productoId: 'p1', posicion: 1 }] } });
    const res = createResponse();

    await controller.reorderProductsInList(req as any, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('404 si el caso de uso devuelve NotFoundError', async () => {
    reorderProducts.execute.mockResolvedValue(failure(new NotFoundError('Lista', 'list-1')));
    const req = createRequest({ body: { orden: [{ productoId: 'p1', posicion: 1 }] } });
    const res = createResponse();

    await controller.reorderProductsInList(req as any, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});
