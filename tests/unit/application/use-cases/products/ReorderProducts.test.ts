/**
 * Tests unitarios para ReorderProducts (PATCH /lists/:listaId/products/reorder).
 * Usa repositorios mockeados con entidades reales, más un bloque final con
 * los repositorios en memoria reales para verificar el orden aplicado.
 */

import { ReorderProducts } from '../../../../../src/application/use-cases/products/ReorderProducts';
import { Producto } from '../../../../../src/domain/entities/Producto';
import { Lista } from '../../../../../src/domain/entities/Lista';
import { InMemoryProductoRepository } from '../../../../../src/infrastructure/persistence/in-memory/InMemoryProductoRepository';
import { InMemoryListaRepository } from '../../../../../src/infrastructure/persistence/in-memory/InMemoryListaRepository';
import { InMemoryPermisoRepository } from '../../../../../src/infrastructure/persistence/in-memory/InMemoryPermisoRepository';

const successResult = <T>(value: T) => ({ isSuccess: true, isFailure: false, value });
const failureResult = (error: unknown) => ({ isSuccess: false, isFailure: true, error });

const makeProducto = (overrides: Record<string, unknown> = {}): Producto => {
  const r = Producto.create({
    id: 'p1',
    nombre: 'Leche',
    listaId: 'l1',
    creadoPorId: 'user-1',
    ...(overrides as any)
  });
  if (r.isFailure) throw (r as any).value;
  return (r as { value: Producto }).value;
};

const makeLista = (overrides: Record<string, unknown> = {}): Lista => {
  const r = Lista.create({
    id: 'l1',
    nombre: 'Semanal',
    propietarioId: 'user-1',
    ...(overrides as any)
  });
  if (r.isFailure) throw (r as any).value;
  return (r as { value: Lista }).value;
};

describe('ReorderProducts', () => {
  let productoRepo: any;
  let listaRepo: any;
  let permisoRepo: any;
  let useCase: ReorderProducts;

  const productos = [makeProducto(), makeProducto({ id: 'p2', nombre: 'Pan' }), makeProducto({ id: 'p3', nombre: 'Huevos' })];

  beforeEach(() => {
    productoRepo = {
      findByList: jest.fn().mockResolvedValue(successResult({
        items: productos, total: 3, page: 1, limit: 3, totalPages: 1
      })),
      updateOrden: jest.fn().mockImplementation(async (_listaId: string, orden: any) =>
        successResult(orden.map((o: any) => ({ id: o.productoId, posicion: o.posicion })))
      )
    };
    listaRepo = {
      findById: jest.fn().mockResolvedValue(successResult(makeLista()))
    };
    permisoRepo = {
      findUniqueByUsuarioAndLista: jest.fn().mockResolvedValue(null)
    };
    useCase = new ReorderProducts(productoRepo, listaRepo, permisoRepo);
  });

  it('reordena la lista completa del propietario y devuelve las posiciones', async () => {
    const r = (await useCase.execute(
      { listaId: 'l1', orden: [{ productoId: 'p2', posicion: 1 }, { productoId: 'p1', posicion: 2 }, { productoId: 'p3', posicion: 3 }] },
      'user-1'
    )) as any;

    expect(r.isSuccess).toBe(true);
    expect(r.value.listaId).toBe('l1');
    expect(r.value.productos).toEqual([
      { id: 'p2', posicion: 1 },
      { id: 'p1', posicion: 2 },
      { id: 'p3', posicion: 3 }
    ]);
    expect(r.value.mensaje).toContain('3 productos reordenados');
    expect(productoRepo.updateOrden).toHaveBeenCalledWith('l1', [
      { productoId: 'p2', posicion: 1 },
      { productoId: 'p1', posicion: 2 },
      { productoId: 'p3', posicion: 3 }
    ]);
  });

  it('normaliza huecos y deja después los productos no incluidos', async () => {
    const r = (await useCase.execute(
      { listaId: 'l1', orden: [{ productoId: 'p2', posicion: 1 }, { productoId: 'p1', posicion: 3 }] },
      'user-1'
    )) as any;

    expect(r.isSuccess).toBe(true);
    // Hueco en la posición 2 -> se cierra; p3 (no incluido) queda después.
    expect(productoRepo.updateOrden).toHaveBeenCalledWith('l1', [
      { productoId: 'p2', posicion: 1 },
      { productoId: 'p1', posicion: 2 },
      { productoId: 'p3', posicion: 3 }
    ]);
  });

  it('producto de otra lista -> ValidationError sin cambiar nada', async () => {
    const r = (await useCase.execute(
      { listaId: 'l1', orden: [{ productoId: 'p1', posicion: 1 }, { productoId: 'p-otra', posicion: 2 }] },
      'user-1'
    )) as any;

    expect(r.isFailure).toBe(true);
    expect(r.error.message).toContain('no pertenece a la lista');
    expect(productoRepo.updateOrden).not.toHaveBeenCalled();
  });

  it('lista inexistente -> NotFoundError', async () => {
    listaRepo.findById.mockResolvedValue(successResult(null));
    const r = (await useCase.execute(
      { listaId: 'l1', orden: [{ productoId: 'p1', posicion: 1 }] },
      'user-1'
    )) as any;

    expect(r.isFailure).toBe(true);
    expect(r.error.message).toContain('no encontrado');
    expect(productoRepo.updateOrden).not.toHaveBeenCalled();
  });

  it('sin permisos (ni propietario ni colaborador) -> UnauthorizedError', async () => {
    listaRepo.findById.mockResolvedValue(successResult(makeLista({ propietarioId: 'otro' })));
    const r = (await useCase.execute(
      { listaId: 'l1', orden: [{ productoId: 'p1', posicion: 1 }] },
      'user-1'
    )) as any;

    expect(r.isFailure).toBe(true);
    expect(r.error.message).toContain('No tienes permisos');
    expect(productoRepo.updateOrden).not.toHaveBeenCalled();
  });

  it('colaborador con permiso de escritura puede reordenar', async () => {
    listaRepo.findById.mockResolvedValue(successResult(makeLista({ propietarioId: 'otro' })));
    permisoRepo.findUniqueByUsuarioAndLista.mockResolvedValue({
      tipoPermiso: { canWrite: () => true }
    });
    const r = (await useCase.execute(
      { listaId: 'l1', orden: [{ productoId: 'p1', posicion: 1 }, { productoId: 'p2', posicion: 2 }, { productoId: 'p3', posicion: 3 }] },
      'user-1'
    )) as any;

    expect(r.isSuccess).toBe(true);
    expect(productoRepo.updateOrden).toHaveBeenCalled();
  });

  it('colaborador solo lectura -> UnauthorizedError', async () => {
    listaRepo.findById.mockResolvedValue(successResult(makeLista({ propietarioId: 'otro' })));
    permisoRepo.findUniqueByUsuarioAndLista.mockResolvedValue({
      tipoPermiso: { canWrite: () => false }
    });
    const r = (await useCase.execute(
      { listaId: 'l1', orden: [{ productoId: 'p1', posicion: 1 }] },
      'user-1'
    )) as any;

    expect(r.isFailure).toBe(true);
    expect(r.error.message).toContain('No tienes permisos');
    expect(productoRepo.updateOrden).not.toHaveBeenCalled();
  });

  it('orden vacío -> ValidationError', async () => {
    const r = (await useCase.execute({ listaId: 'l1', orden: [] }, 'user-1')) as any;
    expect(r.isFailure).toBe(true);
    expect(r.error.message).toContain('al menos un producto');
    expect(productoRepo.updateOrden).not.toHaveBeenCalled();
  });

  it('producto duplicado -> ValidationError sin cambios', async () => {
    const r = (await useCase.execute(
      { listaId: 'l1', orden: [{ productoId: 'p1', posicion: 1 }, { productoId: 'p1', posicion: 2 }] },
      'user-1'
    )) as any;

    expect(r.isFailure).toBe(true);
    expect(r.error.message).toContain('más de una vez');
    expect(productoRepo.updateOrden).not.toHaveBeenCalled();
  });

  it('posición duplicada -> ValidationError sin cambios', async () => {
    const r = (await useCase.execute(
      { listaId: 'l1', orden: [{ productoId: 'p1', posicion: 1 }, { productoId: 'p2', posicion: 1 }] },
      'user-1'
    )) as any;

    expect(r.isFailure).toBe(true);
    expect(r.error.message).toContain('posición 1 aparece más de una vez');
    expect(productoRepo.updateOrden).not.toHaveBeenCalled();
  });

  it('posición 0 o no entera -> ValidationError', async () => {
    const r1 = (await useCase.execute(
      { listaId: 'l1', orden: [{ productoId: 'p1', posicion: 0 }] },
      'user-1'
    )) as any;
    const r2 = (await useCase.execute(
      { listaId: 'l1', orden: [{ productoId: 'p1', posicion: 1.5 }] },
      'user-1'
    )) as any;
    expect(r1.isFailure).toBe(true);
    expect(r2.isFailure).toBe(true);
    expect(productoRepo.updateOrden).not.toHaveBeenCalled();
  });

  it('lista inactiva -> ValidationError', async () => {
    listaRepo.findById.mockResolvedValue(successResult(makeLista({ activa: false })));
    const r = (await useCase.execute(
      { listaId: 'l1', orden: [{ productoId: 'p1', posicion: 1 }] },
      'user-1'
    )) as any;

    expect(r.isFailure).toBe(true);
    expect(r.error.message).toContain('inactiva');
    expect(productoRepo.updateOrden).not.toHaveBeenCalled();
  });

  it('error al cargar los productos propagado sin cambios', async () => {
    productoRepo.findByList.mockResolvedValue(failureResult(new Error('db')));
    const r = (await useCase.execute(
      { listaId: 'l1', orden: [{ productoId: 'p1', posicion: 1 }] },
      'user-1'
    )) as any;

    expect(r.isFailure).toBe(true);
    expect(productoRepo.updateOrden).not.toHaveBeenCalled();
  });
});

describe('ReorderProducts con repositorios en memoria', () => {
  it('el reorden persiste y findByList devuelve el nuevo orden', async () => {
    const productoRepo = new InMemoryProductoRepository();
    const listaRepo = new InMemoryListaRepository();
    const permisoRepo = new InMemoryPermisoRepository();
    const useCase = new ReorderProducts(productoRepo, listaRepo, permisoRepo);

    const lista = makeLista();
    await listaRepo.save(lista);
    const base = new Date('2026-11-27T10:00:00.000Z');
    for (const [i, id] of ['p1', 'p2', 'p3'].entries()) {
      const p = makeProducto({
        id,
        nombre: `Producto ${id}`,
        fechaCreacion: new Date(base.getTime() + i * 1000)
      });
      await productoRepo.save(p);
    }

    const r = (await useCase.execute(
      { listaId: 'l1', orden: [{ productoId: 'p3', posicion: 1 }, { productoId: 'p1', posicion: 2 }, { productoId: 'p2', posicion: 3 }] },
      'user-1'
    )) as any;
    expect(r.isSuccess).toBe(true);

    const listados = (await productoRepo.findByList('l1')) as any;
    expect(listados.value.items.map((p: Producto) => p.id)).toEqual(['p3', 'p1', 'p2']);
    expect(listados.value.items.map((p: Producto) => p.orden)).toEqual([1, 2, 3]);

    // Un producto nuevo (orden 0) aparece primero, como antes del reorden
    // (el listado desempata por fechaCreacion DESC entre los sin orden).
    const nuevo = makeProducto({ id: 'p4', nombre: 'Nuevo', fechaCreacion: new Date('2026-11-27T11:00:00.000Z') });
    await productoRepo.save(nuevo);
    const listados2 = (await productoRepo.findByList('l1')) as any;
    expect(listados2.value.items.map((p: Producto) => p.id)).toEqual(['p4', 'p3', 'p1', 'p2']);
  });
});
