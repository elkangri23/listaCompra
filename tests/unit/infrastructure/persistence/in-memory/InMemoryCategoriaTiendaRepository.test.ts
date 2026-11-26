/**
 * Tests unitarios para InMemoryCategoriaRepository e InMemoryTiendaRepository
 * (dobles para testing sin BD).
 */

import { InMemoryCategoriaRepository } from '../../../../../src/infrastructure/persistence/in-memory/InMemoryCategoriaRepository';
import { InMemoryTiendaRepository } from '../../../../../src/infrastructure/persistence/in-memory/InMemoryTiendaRepository';
import { Categoria } from '../../../../../src/domain/entities/Categoria';
import { Tienda } from '../../../../../src/domain/entities/Tienda';

const unwrap = <T>(r: { isSuccess: boolean; value?: T }): T => r.value as T;

const makeCategoria = (id: string, opts: { tiendaId?: string | null; inactiva?: boolean } = {}): Categoria => {
  const r = Categoria.create({
    id,
    nombre: `Cat ${id}`,
    color: '#FF0000',
    ...(opts.tiendaId !== undefined && opts.tiendaId !== null ? { tiendaId: opts.tiendaId } : {})
  });
  if (r.isFailure) throw (r as any).value;
  const cat = (r as { value: Categoria }).value;
  if (opts.inactiva) cat.desactivar();
  return cat;
};

const makeTienda = (id: string, inactiva = false): Tienda => {
  const r = Tienda.create({ id, nombre: `Tienda ${id}` });
  if (r.isFailure) throw (r as any).value;
  const t = (r as { value: Tienda }).value;
  if (inactiva) t.desactivar();
  return t;
};

describe('InMemoryCategoriaRepository', () => {
  let repo: InMemoryCategoriaRepository;

  beforeEach(() => {
    repo = new InMemoryCategoriaRepository();
  });

  it('save/update/findById roundtrip', async () => {
    const cat = makeCategoria('c1');
    await repo.save(cat);
    expect(unwrap(await repo.findById('c1'))?.id).toBe('c1');

    cat.desactivar();
    await repo.update(cat);
    expect(unwrap(await repo.findById('c1'))?.activa).toBe(false);

    expect(unwrap(await repo.findById('nope'))).toBeNull();
  });

  it('findByTienda filtra por tienda e inactivas', async () => {
    await repo.save(makeCategoria('c1', { tiendaId: 't1' }));
    await repo.save(makeCategoria('c2', { tiendaId: 't1', inactiva: true }));
    await repo.save(makeCategoria('c3', { tiendaId: null }));

    const activasT1 = unwrap(await repo.findByTienda('t1'));
    expect(activasT1.map(c => c.id)).toEqual(['c1']);

    const todasT1 = unwrap(await repo.findByTienda('t1', true));
    expect(todasT1).toHaveLength(2);

    const sinTienda = unwrap(await repo.findByTienda(null));
    expect(sinTienda.map(c => c.id)).toEqual(['c3']);
  });

  it('findAll filtra activas salvo includeInactive', async () => {
    await repo.save(makeCategoria('c1'));
    await repo.save(makeCategoria('c2', { inactiva: true }));
    expect(unwrap(await repo.findAll())).toHaveLength(1);
    expect(unwrap(await repo.findAll(true))).toHaveLength(2);
  });

  it('findByNombre y findByColor con y sin tienda', async () => {
    await repo.save(makeCategoria('c1', { tiendaId: 't1' }));
    await repo.save(makeCategoria('c2', { tiendaId: 't2' }));

    expect(unwrap(await repo.findByNombre('cat c1'))).toHaveLength(1);
    expect(unwrap(await repo.findByNombre('cat c1', 't2'))).toHaveLength(0);
    expect(unwrap(await repo.findByColor('#FF0000'))).toHaveLength(2);
    expect(unwrap(await repo.findByColor('#FF0000', 't1'))).toHaveLength(1);
  });

  it('existsByNombreAndTienda con excludeId', async () => {
    await repo.save(makeCategoria('c1', { tiendaId: 't1' }));
    expect(unwrap(await repo.existsByNombreAndTienda('cat c1', 't1'))).toBe(true);
    expect(unwrap(await repo.existsByNombreAndTienda('cat c1', 't1', 'c1'))).toBe(false);
    expect(unwrap(await repo.existsByNombreAndTienda('cat c1', 't2'))).toBe(false);
  });

  it('delete devuelve si existía', async () => {
    await repo.save(makeCategoria('c1'));
    expect(unwrap(await repo.delete('c1'))).toBe(true);
    expect(unwrap(await repo.delete('c1'))).toBe(false);
  });

  it('countByTienda y search', async () => {
    await repo.save(makeCategoria('c1', { tiendaId: 't1' }));
    await repo.save(makeCategoria('c2', { tiendaId: null }));
    expect(unwrap(await repo.countByTienda('t1'))).toBe(1);
    const search = unwrap(await repo.search());
    expect(search.total).toBe(2);
  });

  it('getStats agrega por color', async () => {
    await repo.save(makeCategoria('c1'));
    await repo.save(makeCategoria('c2', { inactiva: true }));
    const stats = unwrap(await repo.getStats());
    expect(stats).toEqual({
      total: 2, activas: 1, inactivas: 1,
      porColor: { '#FF0000': 2 }
    });
  });

  it('moveToTienda devuelve la entidad, getMostUsed vacío, deactivateByTienda cuenta', async () => {
    await repo.save(makeCategoria('c1', { tiendaId: 't1' }));
    expect(unwrap(await repo.moveToTienda('c1', 't2'))?.id).toBe('c1');
    expect(unwrap(await repo.getMostUsed())).toEqual([]);
    expect(unwrap(await repo.deactivateByTienda('t1'))).toBe(1);
  });
});

describe('InMemoryTiendaRepository', () => {
  let repo: InMemoryTiendaRepository;

  beforeEach(() => {
    repo = new InMemoryTiendaRepository();
  });

  it('save/update/findById/findByNombre', async () => {
    await repo.save(makeTienda('t1'));
    expect(unwrap(await repo.findById('t1'))?.nombre).toBe('Tienda t1');
    expect(unwrap(await repo.findByNombre('tienda T1'))?.id).toBe('t1');
    expect(unwrap(await repo.findById('x'))).toBeNull();
    expect(unwrap(await repo.findByNombre('x'))).toBeNull();
  });

  it('findAll filtra inactivas', async () => {
    await repo.save(makeTienda('t1'));
    await repo.save(makeTienda('t2', true));
    expect(unwrap(await repo.findAll())).toHaveLength(1);
    expect(unwrap(await repo.findAll(true))).toHaveLength(2);
  });

  it('existsByNombre con excludeId', async () => {
    await repo.save(makeTienda('t1'));
    expect(unwrap(await repo.existsByNombre('Tienda t1'))).toBe(true);
    expect(unwrap(await repo.existsByNombre('Tienda t1', 't1'))).toBe(false);
  });

  it('delete', async () => {
    await repo.save(makeTienda('t1'));
    expect(unwrap(await repo.delete('t1'))).toBe(true);
    expect(unwrap(await repo.delete('t1'))).toBe(false);
  });

  it('search / findByIdWithCategories / findAllWithCategories', async () => {
    await repo.save(makeTienda('t1'));
    expect(unwrap(await repo.search()).total).toBe(1);
    const withCats = unwrap(await repo.findByIdWithCategories('t1'));
    expect(withCats?.tienda.id).toBe('t1');
    expect(withCats?.categorias).toEqual([]);
    expect(unwrap(await repo.findByIdWithCategories('x'))).toBeNull();
    expect(unwrap(await repo.findAllWithCategories())).toHaveLength(1);
  });

  it('stubs devuelven valores por defecto', async () => {
    expect(unwrap(await repo.countCategorias())).toBe(0);
    expect(unwrap(await repo.hasCategories())).toBe(false);
    expect(unwrap(await repo.getStats())).toEqual({
      totalCategorias: 0, categoriasActivas: 0, categoriasInactivas: 0
    });
    expect(unwrap(await repo.getMostUsed())).toEqual([]);
  });

  it('getAllStats y deactivateWithCategories', async () => {
    await repo.save(makeTienda('t1'));
    const all = unwrap(await repo.getAllStats()) ?? [];
    expect(all[0]?.tienda.id).toBe('t1');

    const deact = unwrap(await repo.deactivateWithCategories('t1'));
    expect(deact.tienda.id).toBe('t1');
    expect(deact.categoriasDesactivadas).toBe(0);

    const missing = await repo.deactivateWithCategories('x');
    expect((missing as any).value).toBeNull();
  });

  it('activate devuelve la tienda', async () => {
    await repo.save(makeTienda('t1', true));
    expect(unwrap(await repo.activate('t1'))?.id).toBe('t1');
    expect(unwrap(await repo.activate('x'))).toBeUndefined();
  });
});
