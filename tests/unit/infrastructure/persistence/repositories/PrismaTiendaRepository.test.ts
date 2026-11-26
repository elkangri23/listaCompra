/**
 * Tests unitarios para PrismaTiendaRepository (persistencia real)
 * Mockea el PrismaClient: CRUD, search, stats, transacción y manejo de errores.
 */

import { PrismaTiendaRepository } from '../../../../../src/infrastructure/persistence/repositories/PrismaTiendaRepository';
import type { Result } from '../../../../../src/shared/result';
import { Tienda } from '../../../../../src/domain/entities/Tienda';

const unwrap = <T>(r: Result<T, Error>): T | null | undefined =>
  r.isSuccess ? (r as { value: T }).value : undefined;

const PRISMA_TIENDA = {
  id: 't1',
  nombre: 'Mercadona',
  direccion: null,
  telefono: null,
  sitioWeb: null,
  activa: true,
  fechaCreacion: new Date('2025-01-01'),
  fechaActualizacion: new Date('2025-01-02')
};

const makeTienda = (): Tienda => {
  const r = Tienda.create({ id: 't1', nombre: 'Mercadona' });
  if (r.isFailure) throw (r as any).value;
  return (r as { value: Tienda }).value;
};

describe('PrismaTiendaRepository', () => {
  let prisma: any;
  let repo: PrismaTiendaRepository;

  beforeEach(() => {
    prisma = {
      tienda: {
        create: jest.fn().mockResolvedValue(PRISMA_TIENDA),
        update: jest.fn().mockResolvedValue(PRISMA_TIENDA),
        findUnique: jest.fn().mockResolvedValue(PRISMA_TIENDA),
        findFirst: jest.fn().mockResolvedValue(PRISMA_TIENDA),
        findMany: jest.fn().mockResolvedValue([PRISMA_TIENDA]),
        count: jest.fn().mockResolvedValue(1),
        delete: jest.fn().mockResolvedValue(PRISMA_TIENDA)
      },
      categoria: {
        count: jest.fn().mockResolvedValue(3),
        findFirst: jest.fn().mockResolvedValue({ fechaCreacion: new Date('2025-01-03') }),
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 3 })
      },
      $transaction: jest.fn(async (fn: (tx: any) => Promise<any>) =>
        fn({
          tienda: { update: jest.fn().mockResolvedValue(PRISMA_TIENDA) },
          categoria: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) }
        })
      )
    };
    repo = new PrismaTiendaRepository(prisma);
  });

  it('save crea la tienda', async () => {
    const result = await repo.save(makeTienda());
    expect(unwrap(result)?.id).toBe('t1');
    expect(prisma.tienda.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ nombre: 'Mercadona' }) }));
  });

  it('update actualiza y devuelve la entidad', async () => {
    const result = await repo.update(makeTienda());
    expect(unwrap(result)?.id).toBe('t1');
    expect(prisma.tienda.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 't1' } }));
  });

  it('findById / findByNombre', async () => {
    expect(unwrap(await repo.findById('t1'))?.nombre).toBe('Mercadona');
    prisma.tienda.findUnique.mockResolvedValue(null);
    expect(unwrap(await repo.findByNombre('Mercadona'))).toBeNull();
    prisma.tienda.findUnique.mockResolvedValue(PRISMA_TIENDA);
    expect(unwrap(await repo.findByNombre('Mercadona'))?.id).toBe('t1');
  });

  it('findAll filtra activas por defecto', async () => {
    await repo.findAll(false);
    expect(prisma.tienda.findMany.mock.calls[0][0].where).toEqual({ activa: true });
    await repo.findAll(true);
    expect(prisma.tienda.findMany.mock.calls[1][0].where).toEqual({});
  });

  it('existsByNombre con y sin excludeId', async () => {
    expect(unwrap(await repo.existsByNombre('Mercadona'))).toBe(true);
    await repo.existsByNombre('Mercadona', 't1');
    const where = prisma.tienda.count.mock.calls[1][0].where;
    expect(where.id).toEqual({ not: 't1' });
  });

  describe('delete / activate', () => {
    it('delete borra', async () => {
      expect(unwrap(await repo.delete('t1'))).toBe(true);
      expect(prisma.tienda.delete).toHaveBeenCalledWith({ where: { id: 't1' } });
    });

    it('delete P2025 → "no existe"', async () => {
      prisma.tienda.delete.mockRejectedValue(Object.assign(new Error('no'), { code: 'P2025' }));
      expect((await repo.delete('t1') as { error: any }).error.message).toContain('no existe');
    });

    it('activate activa', async () => {
      prisma.tienda.update.mockResolvedValue({ ...PRISMA_TIENDA, activa: true });
      expect(unwrap(await repo.activate('t1'))?.activa).toBe(true);
      expect(prisma.tienda.update.mock.calls[0][0].data.activa).toBe(true);
    });

    it('activate P2025 y errores genéricos', async () => {
      prisma.tienda.update.mockRejectedValue(Object.assign(new Error('no'), { code: 'P2025' }));
      expect((await repo.activate('x') as { error: any }).error.message).toContain('no existe');
      prisma.tienda.update.mockRejectedValue(new Error('db'));
      expect((await repo.activate('x') as { error: any }).error.message).toContain('activar');
    });
  });

  describe('search', () => {
    it('aplica paginación', async () => {
      prisma.tienda.count.mockResolvedValue(20);
      const r = unwrap(await repo.search({ query: 'mer', limit: 5, offset: 10 }))!;
      expect(r.total).toBe(20);
      expect(r.tiendas).toHaveLength(1);
      expect(prisma.tienda.findMany.mock.calls[0][0].take).toBe(5);
      expect(prisma.tienda.findMany.mock.calls[0][0].skip).toBe(10);
    });

    it('errores como failure', async () => {
      prisma.tienda.count.mockRejectedValue(new Error('db'));
      expect((await repo.search({}) as { error: any }).error.message).toContain('búsqueda de tiendas');
    });
  });

  describe('categorías relacionadas', () => {
    it('findByIdWithCategories devuelve tienda y categorías', async () => {
      prisma.tienda.findUnique.mockResolvedValue({ ...PRISMA_TIENDA, categorias: [PRISMA_TIENDA] as any });
      const r = unwrap(await repo.findByIdWithCategories('t1'))!;
      expect(r.tienda.id).toBe('t1');
      // las "categorías" tienen forma de tienda: el mapeo devolverá array vacío si falla,
      // lo importante es la estructura
      expect(Array.isArray(r.categorias)).toBe(true);
      const opts = prisma.tienda.findUnique.mock.calls[0][0];
      expect(opts.include.categorias.where).toEqual({ activa: true });
    });

    it('findByIdWithCategories con inactivas y tienda inexistente', async () => {
      prisma.tienda.findUnique.mockResolvedValue({ ...PRISMA_TIENDA, categorias: [] });
      await repo.findByIdWithCategories('t1', true);
      expect(prisma.tienda.findUnique.mock.calls[0][0].include.categorias.where).toEqual({});
      prisma.tienda.findUnique.mockResolvedValue(null);
      expect(unwrap(await repo.findByIdWithCategories('t1'))).toBeNull();
    });

    it('countCategorias respeta onlyActive', async () => {
      expect(unwrap(await repo.countCategorias('t1'))).toBe(3);
      expect(prisma.categoria.count.mock.calls[0][0].where).toEqual({ tiendaId: 't1', activa: true });
      await repo.countCategorias('t1', false);
      expect(prisma.categoria.count.mock.calls[1][0].where).toEqual({ tiendaId: 't1' });
    });

    it('hasCategories según count', async () => {
      expect(unwrap(await repo.hasCategories('t1'))).toBe(true);
      prisma.categoria.count.mockResolvedValue(0);
      expect(unwrap(await repo.hasCategories('t1'))).toBe(false);
    });

    it('errores relacionados con categorías como failure', async () => {
      prisma.categoria.count.mockRejectedValue(new Error('db'));
      prisma.tienda.findUnique.mockRejectedValue(new Error('db'));
      expect((await repo.countCategorias('t1') as { error: any }).error.message).toContain('contar categorías');
      expect((await repo.hasCategories('t1') as { error: any }).error.message).toContain('tiene categorías');
      expect((await repo.findByIdWithCategories('t1') as { error: any }).error.message).toContain('con categorías');
    });
  });

  describe('getStats', () => {
    it('calcula totales, activas, inactivas y última categoría', async () => {
      prisma.categoria.count
        .mockResolvedValueOnce(5) // total
        .mockResolvedValueOnce(4); // activas
      const s = unwrap(await repo.getStats('t1'))!;
      expect(s).toEqual({
        totalCategorias: 5,
        categoriasActivas: 4,
        categoriasInactivas: 1,
        fechaUltimaCategoria: new Date('2025-01-03')
      });
    });

    it('sin categorías no incluye fechaUltimaCategoria', async () => {
      prisma.categoria.findFirst.mockResolvedValue(null);
      prisma.categoria.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);
      const s = unwrap(await repo.getStats('t1'))!;
      expect(s.fechaUltimaCategoria).toBeUndefined();
      expect(s.categoriasInactivas).toBe(0);
    });

    it('errores como failure', async () => {
      prisma.categoria.count.mockRejectedValue(new Error('db'));
      expect((await repo.getStats('t1') as { error: any }).error.message).toContain('estadísticas de la tienda');
    });
  });

  describe('getAllStats / getMostUsed', () => {
    it('getAllStats calcula por tienda', async () => {
      prisma.tienda.findMany.mockResolvedValue([
        { ...PRISMA_TIENDA, categorias: [
          { activa: true, fechaCreacion: new Date('2025-01-03') },
          { activa: false, fechaCreacion: new Date('2024-12-01') }
        ] }
      ]);
      const stats = unwrap(await repo.getAllStats())!;
      expect(stats).toHaveLength(1);
      const first = stats[0] as NonNullable<typeof stats[number]>;
      expect(first.totalCategorias).toBe(2);
      expect(first.categoriasActivas).toBe(1);
      expect(first.categoriasInactivas).toBe(1);
      expect(first.fechaUltimaCategoria).toEqual(new Date('2025-01-03'));
      expect(first.tienda.id).toBe('t1');
    });

    it('getMostUsed usa _count y limit', async () => {
      prisma.tienda.findMany.mockResolvedValue([{ ...PRISMA_TIENDA, _count: { categorias: 7 } }]);
      const r = unwrap(await repo.getMostUsed(3)) ?? [];
      expect(r[0]?.totalCategorias).toBe(7);
      const opts = prisma.tienda.findMany.mock.calls[0][0];
      expect(opts.take).toBe(3);
      expect(opts.orderBy).toEqual({ categorias: { _count: 'desc' } });
    });

    it('errores como failure', async () => {
      prisma.tienda.findMany.mockRejectedValue(new Error('db'));
      expect((await repo.getAllStats() as { error: any }).error.message).toContain('todas las tiendas');
      expect((await repo.getMostUsed(3) as { error: any }).error.message).toContain('más utilizadas');
    });
  });

  describe('deactivateWithCategories', () => {
    it('desactiva tienda y categorías en transacción', async () => {
      const r = unwrap(await repo.deactivateWithCategories('t1'))!;
      expect(r.tienda.id).toBe('t1');
      expect(r.categoriasDesactivadas).toBe(2);
    });

    it('P2025 y errores genéricos', async () => {
      prisma.$transaction.mockRejectedValue(Object.assign(new Error('no'), { code: 'P2025' }));
      expect((await repo.deactivateWithCategories('x') as { error: any }).error.message).toContain('no existe');
      prisma.$transaction.mockRejectedValue(new Error('tx fail'));
      expect((await repo.deactivateWithCategories('x') as { error: any }).error.message).toContain('desactivar');
    });
  });

  it('save/update/find errores como failure', async () => {
    prisma.tienda.create.mockRejectedValue(new Error('db'));
    prisma.tienda.update.mockRejectedValue(new Error('db'));
    prisma.tienda.findUnique.mockRejectedValue(new Error('db'));
    prisma.tienda.findFirst.mockRejectedValue(new Error('db'));
    prisma.tienda.findMany.mockRejectedValue(new Error('db'));
    prisma.tienda.count.mockRejectedValue(new Error('db'));
    expect((await repo.save(makeTienda()) as { error: any }).error.message).toContain('guardar la tienda');
    expect((await repo.update(makeTienda()) as { error: any }).error.message).toContain('actualizar la tienda');
    expect((await repo.findById('x') as { error: any }).error.message).toContain('por ID');
    expect((await repo.findByNombre('x') as { error: any }).error.message).toContain('por nombre');
    expect((await repo.findAll() as { error: any }).error.message).toContain('todas las tiendas');
    expect((await repo.existsByNombre('x') as { error: any }).error.message).toContain('existencia de tienda');
  });
});
