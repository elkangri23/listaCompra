/**
 * Tests unitarios para BlueprintController (CU-22)
 */

import { BlueprintController } from '../../../../../src/infrastructure/http/controllers/BlueprintController';
import { ValidationError } from '../../../../../src/application/errors/ValidationError';
import { NotFoundError } from '../../../../../src/application/errors/NotFoundError';
import { UnauthorizedError } from '../../../../../src/application/errors/UnauthorizedError';

const makeReq = (overrides: any = {}): any => ({
  body: {},
  params: {},
  query: {},
  user: { id: 'user-1', email: 'u@test.local', rol: 'USUARIO' },
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

const ok = (value: unknown) => ({ isSuccess: true, getValue: () => value, getError: () => null });
const ko = (error: Error) => ({ isSuccess: false, getValue: () => null, getError: () => error });

const makeBlueprint = (overrides: Record<string, unknown> = {}) => ({
  id: 'bp-1', nombre: 'Compra semanal', descripcion: null, publico: true,
  productos: [{ nombre: 'Leche' }], fechaCreacion: new Date(),
  fechaActualizacion: new Date(), creadoPorId: 'user-1', ...overrides
});

describe('BlueprintController (CU-22)', () => {
  let createBlueprintUseCase: any;
  let createListFromBlueprintUseCase: any;
  let blueprintRepository: any;
  let controller: BlueprintController;

  beforeEach(() => {
    createBlueprintUseCase = { execute: jest.fn() };
    createListFromBlueprintUseCase = { execute: jest.fn() };
    blueprintRepository = {
      findByUsuarioId: jest.fn(),
      findById: jest.fn(),
      findByTermino: jest.fn(),
      findPublicos: jest.fn()
    };
    controller = new BlueprintController(createBlueprintUseCase, createListFromBlueprintUseCase, blueprintRepository);
  });

  describe('crear', () => {
    it('sin autenticación → 401', async () => {
      const res = makeRes();
      await controller.crear(makeReq({ user: undefined }), res);

      expect(res.statusCode).toBe(401);
    });

    it('sin nombre o productos → 400', async () => {
      const res = makeRes();
      await controller.crear(makeReq({ body: {} }), res);

      expect(res.statusCode).toBe(400);
      expect(createBlueprintUseCase.execute).not.toHaveBeenCalled();
    });

    it('crea blueprint y devuelve 201 (mapea notas → descripcion)', async () => {
      createBlueprintUseCase.execute.mockResolvedValue(ok({ id: 'bp-1', nombre: 'Semana' }));

      const res = makeRes();
      await controller.crear(makeReq({
        body: { nombre: 'Semana', productos: [{ nombre: 'Leche', notas: 'Entera', cantidad: 2 }] }
      }), res);

      expect(res.statusCode).toBe(201);
      expect(createBlueprintUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          nombre: 'Semana',
          productos: [expect.objectContaining({ nombre: 'Leche', descripcion: 'Entera', cantidad: 2 })]
        }),
        'user-1'
      );
    });

    it('ValidationError del use case → 400', async () => {
      createBlueprintUseCase.execute.mockResolvedValue(ko(new ValidationError('bad', 'nombre', '')));

      const res = makeRes();
      await controller.crear(makeReq({ body: { nombre: 'x', productos: [{}] } }), res);

      expect(res.statusCode).toBe(400);
    });
  });

  describe('obtenerPorUsuario', () => {
    it('devuelve blueprints resumidos', async () => {
      blueprintRepository.findByUsuarioId.mockResolvedValue(ok({ items: [makeBlueprint()] }));

      const res = makeRes();
      await controller.obtenerPorUsuario(makeReq(), res);

      expect(res.statusCode).toBe(0); // res.json sin status
      expect(res.body.blueprints).toHaveLength(1);
      expect(res.body.blueprints[0].productosCount).toBe(1);
      expect(res.body.blueprints[0].creadoPorId).toBe('user-1');
    });

    it('sin auth → 401', async () => {
      const res = makeRes();
      await controller.obtenerPorUsuario(makeReq({ user: undefined }), res);

      expect(res.statusCode).toBe(401);
    });
  });

  describe('obtenerPorId', () => {
    it('sin id → 400', async () => {
      const res = makeRes();
      await controller.obtenerPorId(makeReq(), res);

      expect(res.statusCode).toBe(400);
    });

    it('no encontrado → 404', async () => {
      blueprintRepository.findById.mockResolvedValue(ok(null));

      const res = makeRes();
      await controller.obtenerPorId(makeReq({ params: { id: 'bp-x' } }), res);

      expect(res.statusCode).toBe(404);
    });

    it('privado de otro usuario → 403', async () => {
      blueprintRepository.findById.mockResolvedValue(ok(makeBlueprint({ publico: false, creadoPorId: 'otro' })));

      const res = makeRes();
      await controller.obtenerPorId(makeReq({ params: { id: 'bp-1' } }), res);

      expect(res.statusCode).toBe(403);
    });

    it('público o propio → 200 con productos', async () => {
      blueprintRepository.findById.mockResolvedValue(ok(makeBlueprint({ publico: false })));

      const res = makeRes();
      await controller.obtenerPorId(makeReq({ params: { id: 'bp-1' } }), res);

      expect(res.body.productos).toHaveLength(1);
    });
  });

  describe('crearListaDesdeBlueprint', () => {
    it('sin nombreLista → 400', async () => {
      const res = makeRes();
      await controller.crearListaDesdeBlueprint(makeReq({ params: { id: 'bp-1' }, body: {} }), res);

      expect(res.statusCode).toBe(400);
    });

    it('crea lista → 201', async () => {
      createListFromBlueprintUseCase.execute.mockResolvedValue(ok({ listaId: 'l1', productos: 5 }));

      const res = makeRes();
      await controller.crearListaDesdeBlueprint(makeReq({ params: { id: 'bp-1' }, body: { nombreLista: 'Nueva' } }), res);

      expect(res.statusCode).toBe(201);
      expect(res.body.listaId).toBe('l1');
    });

    it('NotFoundError → 404, UnauthorizedError → 403', async () => {
      createListFromBlueprintUseCase.execute.mockResolvedValueOnce(ko(new NotFoundError('Blueprint', 'bp-1')));
      const res1 = makeRes();
      await controller.crearListaDesdeBlueprint(makeReq({ params: { id: 'bp-1' }, body: { nombreLista: 'N' } }), res1);
      expect(res1.statusCode).toBe(404);

      createListFromBlueprintUseCase.execute.mockResolvedValueOnce(ko(new UnauthorizedError('no')));
      const res2 = makeRes();
      await controller.crearListaDesdeBlueprint(makeReq({ params: { id: 'bp-1' }, body: { nombreLista: 'N' } }), res2);
      expect(res2.statusCode).toBe(403);
    });
  });
});
