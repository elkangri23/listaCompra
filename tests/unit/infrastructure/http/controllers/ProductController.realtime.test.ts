import { Request, Response } from 'express';
import { ProductController } from '../../../../../src/infrastructure/http/controllers/ProductController';
import { success, failure } from '../../../../../src/shared/result';
import { ValidationError } from '../../../../../src/application/errors/ValidationError';

describe('ProductController realtime events', () => {
  const addProduct = { execute: jest.fn() } as any;
  const updateProduct = { execute: jest.fn() } as any;
  const markProductAsPurchased = { execute: jest.fn() } as any;
  const deleteProduct = { execute: jest.fn() } as any;
  const getProducts = { execute: jest.fn() } as any;
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
      params: { listaId: 'list-1', productId: 'product-1', ...(overrides.params as any) },
      body: overrides.body ?? {},
      user: (overrides as any).user ?? baseUser,
      ...overrides,
    } as unknown as Request;
  };

  it('publica PRODUCT_ADDED cuando un producto se crea exitosamente', async () => {
    const req = createRequest({
      body: {
        nombre: 'Manzanas',
        cantidad: 2,
      },
    });
    const res = createResponse();

    addProduct.execute.mockResolvedValue(success({
      id: 'product-1',
      listaId: 'list-1',
      nombre: 'Manzanas',
      cantidad: 2,
      comprado: false,
      urgente: false,
      creadoPorId: 'user-1',
      fechaCreacion: new Date().toISOString(),
      fechaActualizacion: new Date().toISOString(),
    }));

    await controller.addProductToList(req as any, res);

    expect(realTimeGateway.publish).toHaveBeenCalledWith(expect.objectContaining({
      listId: 'list-1',
      type: 'PRODUCT_ADDED',
      actorId: 'user-1',
    }));
  });

  it('no publica evento cuando la creación falla', async () => {
    const req = createRequest({
      body: {
        nombre: '',
      },
    });
    const res = createResponse();

    addProduct.execute.mockResolvedValue(
      failure(ValidationError.create('Nombre requerido', 'nombre', ''))
    );

    await controller.addProductToList(req as any, res);

    expect(realTimeGateway.publish).not.toHaveBeenCalled();
  });

  it('publica PRODUCT_UPDATED cuando un producto se actualiza', async () => {
    const req = createRequest({
      body: {
        nombre: 'Manzanas verdes',
      },
    });
    const res = createResponse();

    updateProduct.execute.mockResolvedValue(success({
      id: 'product-1',
      listaId: 'list-1',
      nombre: 'Manzanas verdes',
      cantidad: 2,
      comprado: false,
      urgente: false,
      creadoPorId: 'user-1',
      fechaCreacion: new Date().toISOString(),
      fechaActualizacion: new Date().toISOString(),
    }));

    await controller.updateProductInList(req as any, res);

    expect(realTimeGateway.publish).toHaveBeenCalledWith(expect.objectContaining({
      listId: 'list-1',
      type: 'PRODUCT_UPDATED',
      actorId: 'user-1',
    }));
  });

  it('publica PRODUCT_MARKED cuando un producto se marca como comprado', async () => {
    const req = createRequest({
      body: {
        comprado: true,
      },
    });
    const res = createResponse();

    markProductAsPurchased.execute.mockResolvedValue(success({
      id: 'product-1',
      listaId: 'list-1',
      nombre: 'Manzanas',
      comprado: true,
      fechaActualizacion: new Date().toISOString(),
      mensaje: 'Producto marcado como comprado exitosamente',
    }));

    await controller.markProductAsPurchased(req as any, res);

    expect(realTimeGateway.publish).toHaveBeenCalledWith(expect.objectContaining({
      listId: 'list-1',
      type: 'PRODUCT_MARKED',
      actorId: 'user-1',
    }));
  });

  it('publica PRODUCT_DELETED cuando un producto se elimina', async () => {
    const req = createRequest();
    const res = createResponse();

    deleteProduct.execute.mockResolvedValue(success({
      id: 'product-1',
      listaId: 'list-1',
      eliminado: true,
      permanente: true,
      fechaEliminacion: new Date().toISOString(),
      mensaje: 'Producto eliminado exitosamente',
    }));

    await controller.deleteProductFromList(req as any, res);

    expect(realTimeGateway.publish).toHaveBeenCalledWith(expect.objectContaining({
      listId: 'list-1',
      type: 'PRODUCT_DELETED',
      actorId: 'user-1',
    }));
  });
});
