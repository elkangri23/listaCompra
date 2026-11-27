/**
 * Tests unitarios para UpdateProduct, GetProducts, MarkProductAsPurchased
 * y DeleteStore. Usa repositorios y outbox mockeados con entidades reales.
 */

import { UpdateProduct } from '../../../../../src/application/use-cases/products/UpdateProduct';
import { GetProducts } from '../../../../../src/application/use-cases/products/GetProducts';
import { MarkProductAsPurchased } from '../../../../../src/application/use-cases/products/MarkProductAsPurchased';
import { DeleteStore } from '../../../../../src/application/use-cases/stores/DeleteStore';
import { Producto } from '../../../../../src/domain/entities/Producto';
import { Lista } from '../../../../../src/domain/entities/Lista';
import { Tienda } from '../../../../../src/domain/entities/Tienda';

const successResult = <T>(value: T) => ({ isSuccess: true, isFailure: false, value });
const failureResult = (error: unknown) => ({ isSuccess: false, isFailure: true, error });
const unwrapAny = (r: any) => (r.isSuccess ? r.value : r.error);

const makeProducto = (overrides: Record<string, unknown> = {}): Producto => {
  const r = Producto.create({
    id: 'p1',
    nombre: 'Leche',
    listaId: 'l1',
    creadoPorId: 'user-1',
    cantidad: 2,
    ...(overrides as any)
  });
  if (r.isFailure) throw (r as any).value;
  return (r as { value: Producto }).value;
};

const makeLista = (propietarioId = 'user-1'): Lista => {
  const r = Lista.create({ id: 'l1', nombre: 'Semanal', propietarioId });
  if (r.isFailure) throw (r as any).value;
  return (r as { value: Lista }).value;
};

describe('UpdateProduct', () => {
  let repo: any;
  let outbox: any;
  let useCase: UpdateProduct;

  beforeEach(() => {
    repo = {
      findById: jest.fn().mockResolvedValue(successResult(makeProducto())),
      save: jest.fn().mockImplementation(async (p: Producto) => successResult(p))
    };
    outbox = { saveEvent: jest.fn().mockResolvedValue(undefined) };
    useCase = new UpdateProduct(repo, outbox);
  });

  it('actualiza nombre, cantidad y urgente y publica evento', async () => {
    const r = (await useCase.execute('p1', { nombre: 'Leche Deslactosada', cantidad: 4, urgente: true }, 'user-1')) as any;
    expect(r.isSuccess).toBe(true);
    expect(r.value.nombre).toBe('Leche Deslactosada');
    expect(r.value.cantidad).toBe(4);
    expect(r.value.urgente).toBe(true);
    expect(repo.save).toHaveBeenCalled();
    expect(outbox.saveEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventData: expect.objectContaining({
          changedFields: expect.arrayContaining(['nombre', 'cantidad', 'urgente'])
        })
      })
    );
  });

  it('400 (ValidationError) sin productoId / usuarioId / campos', async () => {
    const r1 = (await useCase.execute('', { nombre: 'x' }, 'user-1')) as any;
    const r2 = (await useCase.execute('p1', { nombre: 'x' }, '')) as any;
    const r3 = (await useCase.execute('p1', {}, 'user-1')) as any;
    expect(r1.error.message).toContain('ID del producto');
    expect(r2.error.message).toContain('ID del usuario');
    expect(r3.error.message).toContain('al menos un campo');
  });

  it('404 (NotFoundError) si no existe', async () => {
    repo.findById.mockResolvedValue(successResult(null));
    const r = (await useCase.execute('p1', { nombre: 'x' }, 'user-1')) as any;
    expect(r.error.message).toContain('no encontrado');
  });

  it('unauthorized si no puede modificar', async () => {
    repo.findById.mockResolvedValue(successResult(makeProducto({ creadoPorId: 'otro' })));
    const r = (await useCase.execute('p1', { nombre: 'x' }, 'user-1')) as any;
    expect(r.error.message).toContain('No tienes permisos');
  });

  it('nombre vacío produce failure (sin campos efectivos)', async () => {
    const r = (await useCase.execute('p1', { nombre: '' }, 'user-1')) as any;
    expect(r.isFailure).toBe(true);
  });

  it('categoriaId null quita la categoría del producto', async () => {
    repo.findById.mockResolvedValue(successResult(makeProducto({ categoriaId: 'c1' })));
    const r = (await useCase.execute('p1', { categoriaId: null }, 'user-1')) as any;
    expect(r.isSuccess).toBe(true);
    expect(r.value.categoriaId).toBeUndefined();
    const saved = repo.save.mock.calls[0][0] as Producto;
    expect(saved.categoriaId).toBeNull();
    expect(outbox.saveEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventData: expect.objectContaining({
          changedFields: expect.arrayContaining(['categoriaId'])
        })
      })
    );
  });

  it('precio inválido → ValidationError', async () => {
    const r = (await useCase.execute('p1', { precio: -5 }, 'user-1')) as any;
    expect(r.isFailure).toBe(true);
  });

  it('error al guardar propagado', async () => {
    repo.save.mockResolvedValue(failureResult(new Error('db')));
    const r = (await useCase.execute('p1', { nombre: 'X' }, 'user-1')) as any;
    expect(r.isFailure).toBe(true);
  });
});

describe('GetProducts', () => {
  let productoRepo: any;
  let listaRepo: any;
  let permisoRepo: any;
  let useCase: GetProducts;

  beforeEach(() => {
    productoRepo = {
      findByList: jest.fn().mockResolvedValue(successResult({
        items: [makeProducto({ precio: 2.5 })], total: 1, page: 1, limit: 20, totalPages: 1
      })),
      getResumenByList: jest.fn().mockResolvedValue(successResult({
        comprados: 2, pendientes: 3, urgentes: 1, valorTotal: 7.5
      }))
    };
    listaRepo = { findById: jest.fn().mockResolvedValue(successResult(makeLista())) };
    permisoRepo = { hasPermission: jest.fn().mockResolvedValue(false) };
    useCase = new GetProducts(productoRepo, listaRepo, permisoRepo);
  });

  it('devuelve items + resumen para el propietario', async () => {
    const r = (await useCase.execute({ listaId: 'l1' }, 'user-1')) as any;
    expect(r.isSuccess).toBe(true);
    expect(r.value.items).toHaveLength(1);
    expect(r.value.resumen).toEqual({ comprados: 2, pendientes: 3, urgentes: 1, valorTotal: 7.5 });
    expect(productoRepo.findByList).toHaveBeenCalledWith('l1', {}, { page: 1, limit: 20 });
  });

  it('limit máximo 100 y page mínima 1', async () => {
    (await useCase.execute({ listaId: 'l1', limit: 500 }, 'user-1')) as any;
    expect(productoRepo.findByList).toHaveBeenCalledWith('l1', {}, { page: 1, limit: 100 });

    const r = (await useCase.execute({ listaId: 'l1', page: -1 }, 'user-1')) as any;
    expect(r.isFailure).toBe(true);
  });

  it('validaciones básicas: usuario/lista vacíos', async () => {
    const r1 = (await useCase.execute({ listaId: 'l1' }, '')) as any;
    const r2 = (await useCase.execute({ listaId: '' }, 'user-1')) as any;
    expect(r1.error.message).toContain('usuario');
    expect(r2.error.message).toContain('lista');
  });

  it('404 lista inexistente', async () => {
    listaRepo.findById.mockResolvedValue(successResult(null));
    const r = (await useCase.execute({ listaId: 'x' }, 'user-1')) as any;
    expect(r.error.message).toContain('no encontrado');
  });

  it('unauthorized si no es propietario ni colaborador', async () => {
    const r = (await useCase.execute({ listaId: 'l1' }, 'intruso')) as any;
    expect(r.error.message).toContain('No tienes permisos');
  });

  it('colaborador con permiso accede', async () => {
    permisoRepo.hasPermission.mockResolvedValue(true);
    const r = (await useCase.execute({ listaId: 'l1' }, 'colab')) as any;
    expect(r.isSuccess).toBe(true);
  });

  it('aplica filtros al repositorio', async () => {
    (await useCase.execute({ listaId: 'l1', comprado: false, urgente: true, categoriaId: 'c1', busqueda: 'leche' }, 'user-1')) as any;
    expect(productoRepo.findByList).toHaveBeenCalledWith('l1', {
      comprado: false, urgente: true, categoriaId: 'c1', busqueda: 'leche'
    }, { page: 1, limit: 20 });
  });

  it('error del repositorio propagado', async () => {
    productoRepo.findByList.mockResolvedValue(failureResult(new Error('db')));
    const r = (await useCase.execute({ listaId: 'l1' }, 'user-1')) as any;
    expect(r.isFailure).toBe(true);
  });
});

describe('MarkProductAsPurchased', () => {
  let repo: any;
  let outbox: any;
  let useCase: MarkProductAsPurchased;

  beforeEach(() => {
    repo = {
      findById: jest.fn().mockResolvedValue(successResult(makeProducto())),
      save: jest.fn().mockImplementation(async (p: Producto) => successResult(p))
    };
    outbox = { saveEvent: jest.fn().mockResolvedValue(undefined) };
    useCase = new MarkProductAsPurchased(repo, outbox);
  });

  it('marca como comprado y publica evento con fechaCompra', async () => {
    const r = (await useCase.execute('p1', { comprado: true }, 'user-1')) as any;
    expect(r.isSuccess).toBe(true);
    expect(r.value.comprado).toBe(true);
    expect(r.value.fechaCompra).toBeTruthy();
    expect(r.value.mensaje).toContain('comprado');
    expect(outbox.saveEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventData: expect.objectContaining({
          changedFields: expect.arrayContaining(['comprado'])
        })
      })
    );
  });

  it('desmarca y quita fechaCompra', async () => {
    const producto = makeProducto();
    producto.marcarComoComprado();
    repo.findById.mockResolvedValue(successResult(producto));

    const r = (await useCase.execute('p1', { comprado: false }, 'user-1')) as any;
    expect(r.value.comprado).toBe(false);
    expect(r.value.fechaCompra).toBeUndefined();
  });

  it('validaciones: id, usuario y comprado requerido', async () => {
    const r1 = (await useCase.execute('', { comprado: true }, 'user-1')) as any;
    const r2 = (await useCase.execute('p1', { comprado: true }, '')) as any;
    const r3 = (await useCase.execute('p1', {} as any, 'user-1')) as any;
    expect(r1.error.message).toContain('ID del producto');
    expect(r2.error.message).toContain('ID del usuario');
    expect(r3.error.message).toContain('comprado');
  });

  it('404 si no existe', async () => {
    repo.findById.mockResolvedValue(successResult(null));
    const r = (await useCase.execute('p1', { comprado: true }, 'user-1')) as any;
    expect(r.error.message).toContain('no encontrado');
  });

  it('unauthorized sin permisos', async () => {
    repo.findById.mockResolvedValue(successResult(makeProducto({ creadoPorId: 'otro' })));
    const r = (await useCase.execute('p1', { comprado: true }, 'user-1')) as any;
    expect(r.error.message).toContain('No tienes permisos');
  });

  it('si ya está en ese estado → ValidationError', async () => {
    const producto = makeProducto();
    producto.marcarComoComprado();
    repo.findById.mockResolvedValue(successResult(producto));

    const r = (await useCase.execute('p1', { comprado: true }, 'user-1')) as any;
    expect(r.isFailure).toBe(true);
    expect(r.error.message).toContain('ya está marcado como comprado');
  });

  it('error al guardar propagado', async () => {
    repo.save.mockResolvedValue(failureResult(new Error('db')));
    const r = (await useCase.execute('p1', { comprado: true }, 'user-1')) as any;
    expect(r.isFailure).toBe(true);
  });
});

describe('DeleteStore', () => {
  let repo: any;
  let useCase: DeleteStore;

  beforeEach(() => {
    repo = {
      findById: jest.fn().mockResolvedValue(successResult(makeTienda())),
      hasCategories: jest.fn().mockResolvedValue(successResult(false)),
      getStats: jest.fn().mockResolvedValue(successResult({ totalCategorias: 3 })),
      delete: jest.fn().mockResolvedValue(successResult(true))
    };
    useCase = new DeleteStore(repo);
  });

  const makeTienda = (): Tienda => {
    const r = Tienda.create({ id: 't1', nombre: 'Mercadona' });
    if (r.isFailure) throw (r as any).value;
    return (r as { value: Tienda }).value;
  };

  it('elimina tienda sin categorías', async () => {
    const r = (await useCase.execute({ id: 't1' })) as any;
    expect(r.isSuccess).toBe(true);
    expect(unwrapAny(r)).toBe(true);
    expect(repo.delete).toHaveBeenCalledWith('t1');
  });

  it('404 (InvalidValueError) si no existe', async () => {
    repo.findById.mockResolvedValue(successResult(null));
    const r = (await useCase.execute({ id: 'x' })) as any;
    expect(r.error.message).toContain('no existe');
  });

  it('409 con categorías asociadas y número en el mensaje', async () => {
    repo.hasCategories.mockResolvedValue(successResult(true));
    repo.getStats.mockResolvedValue(successResult({ totalCategorias: 5 }));

    const r = (await useCase.execute({ id: 't1' })) as any;
    expect(r.isFailure).toBe(true);
    expect(r.error.rule).toBe('TIENDA_CON_CATEGORIAS');
    expect(r.error.message).toContain('5 categoría(s)');
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it('409 sin stats muestra "algunas"', async () => {
    repo.hasCategories.mockResolvedValue(successResult(true));
    repo.getStats.mockResolvedValue(failureResult(new Error('stats')));

    const r = (await useCase.execute({ id: 't1' })) as any;
    expect(r.error.message).toContain('algunas categoría(s)');
  });

  it('errores del repositorio propagados', async () => {
    repo.findById.mockResolvedValue(failureResult(new Error('db')));
    expect((await useCase.execute({ id: 'x' })).isFailure).toBe(true);

    repo.findById.mockResolvedValue(successResult(makeTienda()));
    repo.hasCategories.mockResolvedValue(failureResult(new Error('db')));
    expect((await useCase.execute({ id: 't1' })).isFailure).toBe(true);

    repo.hasCategories.mockResolvedValue(successResult(false));
    repo.delete.mockResolvedValue(failureResult(new Error('db')));
    expect((await useCase.execute({ id: 't1' })).isFailure).toBe(true);
  });
});
