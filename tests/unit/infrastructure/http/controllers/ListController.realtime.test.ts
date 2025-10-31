import { Request, Response } from 'express';
import { ListController } from '../../../../../src/infrastructure/http/controllers/ListController';
import { success } from '../../../../../src/shared/result';
import { ValidationError } from '../../../../../src/application/errors/ValidationError';

describe('ListController realtime integration', () => {
  let controller: ListController;
  const createList = { execute: jest.fn() } as any;
  const getUserLists = { execute: jest.fn() } as any;
  const updateList = { execute: jest.fn() } as any;
  const deleteList = { execute: jest.fn() } as any;
  const getListById = { execute: jest.fn() } as any;
  const realTimeGateway = { publish: jest.fn(), subscribe: jest.fn() } as any;

  beforeEach(() => {
    jest.resetAllMocks();
    controller = new ListController(
      createList,
      getUserLists,
      updateList,
      deleteList,
      getListById,
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

  it('publica evento LIST_CREATED al crear una lista', async () => {
    const req = {
      body: { nombre: 'Compra semanal' },
      user: { id: 'user-1' }
    } as unknown as Request;
    const res = createResponse();

    createList.execute.mockResolvedValue(success({
      id: 'list-1',
      nombre: 'Compra semanal',
      propietarioId: 'user-1',
      activa: true,
      fechaCreacion: new Date().toISOString(),
      fechaActualizacion: new Date().toISOString(),
    }));

    await controller.create(req, res);

    expect(realTimeGateway.publish).toHaveBeenCalledWith(expect.objectContaining({
      listId: 'list-1',
      type: 'LIST_CREATED',
      actorId: 'user-1',
    }));
  });

  it('suscribe al usuario a eventos SSE cuando stream es exitoso', async () => {
    const req = {
      params: { id: 'list-2' },
      user: { id: 'user-2' }
    } as unknown as Request;
    const res = createResponse();

    getListById.execute.mockResolvedValue(success({
      id: 'list-2',
      nombre: 'Lista compartida',
      propietarioId: 'user-2',
      activa: true,
      fechaCreacion: new Date().toISOString(),
      fechaActualizacion: new Date().toISOString(),
    }));

    await controller.stream(req as any, res);

    expect(realTimeGateway.subscribe).toHaveBeenCalledWith('list-2', 'user-2', res);
  });

  it('responde con error si la validación falla en stream', async () => {
    const req = {
      params: { id: 'list-3' },
      user: { id: 'user-3' }
    } as unknown as Request;
    const res = createResponse();

    getListById.execute.mockResolvedValue({
      isFailure: true,
      isSuccess: false,
      error: ValidationError.create('Error', 'field', 'value')
    });

    await controller.stream(req as any, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
    expect(realTimeGateway.subscribe).not.toHaveBeenCalled();
  });
});
