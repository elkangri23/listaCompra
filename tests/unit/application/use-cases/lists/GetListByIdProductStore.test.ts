/**
 * Tests unitarios para GetListById, DeleteProduct y CreateStore.
 * Repos y outbox mockeados con entidades reales.
 */

import { GetListById } from '../../../../../src/application/use-cases/lists/GetListById';
import { DeleteProduct } from '../../../../../src/application/use-cases/products/DeleteProduct';
import { CreateStore } from '../../../../../src/application/use-cases/stores/CreateStore';
import { Lista } from '../../../../../src/domain/entities/Lista';
import { Producto } from '../../../../../src/domain/entities/Producto';

const successResult = <T>(value: T) => ({ isSuccess: true, isFailure: false, value });
const failureResult = (error: unknown) => ({ isSuccess: false, isFailure: true, error });

const makeLista = (propietarioId = 'user-1'): Lista => {
  const r = Lista.create({ id: 'l1', nombre: 'Semanal', propietarioId });
  if (r.isFailure) throw (r as any).value;
  return (r as { value: Lista }).value;
};

const makeProducto = (creadoPorId = 'user-1'): Producto => {
  const r = Producto.create({ id: 'p1', nombre: 'Leche', listaId: 'l1', creadoPorId, cantidad: 2 });
  if (r.isFailure) throw (r as any).value;
  return (r as { value: Producto }).value;
};

describe('GetListById', () => {
  let listaRepo: any;
  let permisoRepo: any;
  let useCase: GetListById;

  beforeEach(() => {
    listaRepo = { findById: jest.fn().mockResolvedValue(successResult(makeLista())) };
    permisoRepo = { hasPermission: jest.fn().mockResolvedValue(false) };
    useCase = new GetListById(listaRepo, permisoRepo);
  });

  it('propietario obtiene la lista', async () => {
    const r = (await useCase.execute({ id: 'l1' }, 'user-1')) as any;
    expect(r.isSuccess).toBe(true);
    expect(r.value.id).toBe('l1');
    expect(r.value.propietarioId).toBe('user-1');
  });

  it('validaciones de ids vacíos', async () => {
    const r1 = (await useCase.execute({ id: '' }, 'user-1')) as any;
    const r2 = (await useCase.execute({ id: 'l1' }, '')) as any;
    expect(r1.error.message).toContain('lista');
    expect(r2.error.message).toContain('usuario');
  });

  it('404 lista inexistente', async () => {
    listaRepo.findById.mockResolvedValue(successResult(null));
    const r = (await useCase.execute({ id: 'x' }, 'user-1')) as any;
    expect(r.error.message).toContain('no encontrad');
  });

  it('unauthorized sin permisos de colaborador', async () => {
    const r = (await useCase.execute({ id: 'l1' }, 'intruso')) as any;
    expect(r.error.message).toContain('No tienes permisos');
  });

  it('colaborador con permiso accede', async () => {
    permisoRepo.hasPermission.mockResolvedValue(true);
    const r = (await useCase.execute({ id: 'l1' }, 'colab')) as any;
    expect(r.isSuccess).toBe(true);
  });

  it('fallo de hasPermission → unauthorized', async () => {
    permisoRepo.hasPermission = jest.fn().mockRejectedValue(new Error('db'));
    const r = (await useCase.execute({ id: 'l1' }, 'colab')) as any;
    expect(r.error.message).toContain('No tienes permisos');
  });

  it('funciona sin permisoRepository inyectado', async () => {
    const useCaseSinPermisos = new GetListById(listaRepo);
    const r = (await useCaseSinPermisos.execute({ id: 'l1' }, 'intruso')) as any;
    expect(r.error.message).toContain('No tienes permisos');
  });
});

describe('DeleteProduct', () => {
  let repo: any;
  let outbox: any;
  let useCase: DeleteProduct;

  beforeEach(() => {
    repo = {
      findById: jest.fn().mockResolvedValue(successResult(makeProducto())),
      deleteById: jest.fn().mockResolvedValue(successResult(true))
    };
    outbox = { saveEvent: jest.fn().mockResolvedValue(undefined) };
    useCase = new DeleteProduct(repo, outbox);
  });

  it('elimina y publica evento con valor eliminado', async () => {
    const r = (await useCase.execute('p1', { permanente: true }, 'user-1')) as any;
    expect(r.isSuccess).toBe(true);
    expect(r.value.eliminado).toBe(true);
    expect(r.value.permanente).toBe(true);
    expect(r.value.listaId).toBe('l1');
    expect(repo.deleteById).toHaveBeenCalledWith('p1');
    expect(outbox.saveEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventData: expect.objectContaining({ deletedByUserId: 'user-1' })
      })
    );
  });

  it('permanente por defecto true si no viene en dto', async () => {
    const r = (await useCase.execute('p1', {} as any, 'user-1')) as any;
    expect(r.value.permanente).toBe(true);
  });

  it('validaciones de ids', async () => {
    const r1 = (await useCase.execute('', { permanente: true }, 'user-1')) as any;
    const r2 = (await useCase.execute('p1', { permanente: true }, '')) as any;
    expect(r1.error.message).toContain('ID del producto');
    expect(r2.error.message).toContain('ID del usuario');
  });

  it('404 si no existe', async () => {
    repo.findById.mockResolvedValue(successResult(null));
    const r = (await useCase.execute('p1', {}, 'user-1')) as any;
    expect(r.error.message).toContain('no encontrado');
  });

  it('unauthorized sin permisos', async () => {
    repo.findById.mockResolvedValue(successResult(makeProducto('otro')));
    const r = (await useCase.execute('p1', {}, 'user-1')) as any;
    expect(r.error.message).toContain('No tienes permisos');
  });

  it('error al eliminar propagado', async () => {
    repo.deleteById = jest.fn().mockResolvedValue(failureResult(new Error('db')));
    const r = (await useCase.execute('p1', {}, 'user-1')) as any;
    expect(r.isFailure).toBe(true);
  });
});

describe('CreateStore (CU-26)', () => {
  let repo: any;
  let useCase: CreateStore;

  beforeEach(() => {
    repo = {
      existsByNombre: jest.fn().mockResolvedValue(successResult(false)),
      save: jest.fn().mockImplementation(async (t: any) => successResult(t))
    };
    useCase = new CreateStore(repo);
  });

  it('crea tienda nueva', async () => {
    const r = (await useCase.execute({ nombre: 'Mercadona', direccion: 'c/ Falsa 123' })) as any;
    expect(r.isSuccess).toBe(true);
    expect(r.value.nombre).toBe('Mercadona');
    expect(r.value.direccion).toBe('c/ Falsa 123');
    expect(r.value.totalCategorias).toBe(0);
    expect(repo.save).toHaveBeenCalled();
  });

  it('409 si el nombre ya existe', async () => {
    repo.existsByNombre.mockResolvedValue(successResult(true));
    const r = (await useCase.execute({ nombre: 'Mercadona' })) as any;
    expect(r.isFailure).toBe(true);
    expect(r.error.rule).toBe('TIENDA_DUPLICADA');
  });

  it('nombre vacío → error de la entidad', async () => {
    const r = (await useCase.execute({ nombre: '' })) as any;
    expect(r.isFailure).toBe(true);
  });

  it('error del repositorio propagado', async () => {
    repo.existsByNombre.mockResolvedValue(failureResult(new Error('db')));
    const r = (await useCase.execute({ nombre: 'X' })) as any;
    expect(r.isFailure).toBe(true);

    repo.existsByNombre.mockResolvedValue(successResult(false));
    repo.save.mockResolvedValue(failureResult(new Error('db')));
    const r2 = (await useCase.execute({ nombre: 'X' })) as any;
    expect(r2.isFailure).toBe(true);
  });
});
