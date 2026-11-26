/**
 * Tests unitarios para PrismaCategoriaRepository (persistencia real)
 * Mockea el PrismaClient: CRUD, filtros, search, getMostUsed y manejo de errores.
 */

import { PrismaCategoriaRepository } from '../../../../../src/infrastructure/persistence/repositories/PrismaCategoriaRepository';
import type { Result } from '../../../../../src/shared/result';
import { Categoria } from '../../../../../src/domain/entities/Categoria';

const unwrap = <T>(r: Result<T, Error>): T | null | undefined =>
  r.isSuccess ? (r as { value: T }).value : undefined;

const PRISMA_CATEGORIA = {
  id: 'c1',
  nombre: 'Lácteos',
  descripcion: null,
  color: '#FFFFFF',
  icono: null,
  tiendaId: 't1',
  activa: true,
  fechaCreacion: new Date('2025-01-01'),
  fechaActualizacion: new Date('2025-01-02')
};

const makeCategoria = (): Categoria => {
  const r = Categoria.create({ id: 'c1', nombre: 'Lácteos', color: '#FFFFFF', tiendaId: 't1' });
  if (r.isFailure) throw (r as any).value;
  return (r as { value: Categoria }).value;
};

describe('PrismaCategoriaRepository', () => {
  let prisma: any;
  let repo: PrismaCategoriaRepository;

  beforeEach(() => {
    prisma = {
      categoria: {
        create: jest.fn().mockResolvedValue(PRISMA_CATEGORIA),
        update: jest.fn().mockResolvedValue(PRISMA_CATEGORIA),
        findUnique: jest.fn().mockResolvedValue(PRISMA_CATEGORIA),
        findFirst: jest.fn().mockResolvedValue(PRISMA_CATEGORIA),
        findMany: jest.fn().mockResolvedValue([PRISMA_CATEGORIA]),
        count: jest.fn().mockResolvedValue(1),
        delete: jest.fn().mockResolvedValue(PRISMA_CATEGORIA)
      }
    };
    repo = new PrismaCategoriaRepository(prisma);
  });

  it('save crea la categoría', async () => {
    const result = await repo.save(makeCategoria());
    expect(unwrap(result)?.id).toBe('c1');
    expect(prisma.categoria.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ nombre: 'Lácteos' }) })
    );
  });

  it('save devuelve InvalidValueError en fallo de BD', async () => {
    prisma.categoria.create.mockRejectedValue(new Error('db'));
    const result = await repo.save(makeCategoria());
    expect(result.isFailure).toBe(true);
    expect((result as { error: any }).error.message).toContain('guardar');
  });

  it('update actualiza y devuelve la entidad', async () => {
    const result = await repo.update(makeCategoria());
    expect(unwrap(result)?.id).toBe('c1');
    expect(prisma.categoria.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'c1' } })
    );
  });

  it('findById devuelve entidad o null', async () => {
    expect(unwrap(await repo.findById('c1'))?.nombre).toBe('Lácteos');
    prisma.categoria.findUnique.mockResolvedValue(null);
    expect(unwrap(await repo.findById('x'))).toBeNull();
  });

  describe('findByTienda / findAll', () => {
    it('findByTienda sin incluir inactivas', async () => {
      await repo.findByTienda('t1', false);
      expect(prisma.categoria.findMany.mock.calls[0][0].where).toEqual({ tiendaId: 't1', activa: true });
    });

    it('findByTienda(true) y.findById.(undefined) usan criteria globales', async () => {
      await repo.findByTienda('t1', true);
      expect(prisma.categoria.findMany.mock.calls[0][0].where).toEqual({ tiendaId: 't1' });
    });

    it('findAll sin includeInactive filtra activas', async () => {
      await repo.findAll(false);
      expect(prisma.categoria.findMany.mock.calls[0][0].where).toEqual({ activa: true });
      await repo.findAll(true);
      expect(prisma.categoria.findMany.mock.calls[1][0].where).toEqual({});
    });

    it('errores como failure', async () => {
      prisma.categoria.findMany.mockRejectedValue(new Error('db'));
      expect((await repo.findByTienda('t1') as { error: any }).error.message).toContain('por tienda');
      expect((await repo.findAll() as { error: any }).error.message).toContain('todas las categorías');
    });
  });

  describe('findByNombre / findByColor', () => {
    it('findByNombre usa contains insensitive', async () => {
      await repo.findByNombre('lác', 't1');
      expect(prisma.categoria.findMany.mock.calls[0][0].where).toEqual(
        expect.objectContaining({ nombre: { contains: 'lác', mode: 'insensitive' }, tiendaId: 't1' })
      );
    });

    it('findByColor usa contains insensitive', async () => {
      await repo.findByColor('#fff', null);
      const where = prisma.categoria.findMany.mock.calls[0][0].where;
      expect(where.tiendaId).toBeNull();
      expect(where.color).toBe('#fff');
    });

    it('errores como failure', async () => {
      prisma.categoria.findMany.mockRejectedValue(new Error('db'));
      expect((await repo.findByNombre('x') as { error: any }).error.message).toContain('por nombre');
      expect((await repo.findByColor('x') as { error: any }).error.message).toContain('por color');
    });
  });

  describe('existsByNombreAndTienda / countByTienda', () => {
    it('existsByNombreAndTienda true/false según count', async () => {
      expect(unwrap(await repo.existsByNombreAndTienda('Lácteos', 't1'))).toBe(true);
      prisma.categoria.count.mockResolvedValue(0);
      expect(unwrap(await repo.existsByNombreAndTienda('Lácteos', 't1'))).toBe(false);
    });

    it('existsByNombreAndTienda con excludeId excluye la propia categoría', async () => {
      await repo.existsByNombreAndTienda('Lácteos', 't1', 'c1');
      const where = prisma.categoria.count.mock.calls[0][0].where;
      expect(where.id).toEqual({ not: 'c1' });
    });

    it('is undefined no todasas tienda null pasa a where', async () => {
      await repo.existsByNombreAndTienda('Lácteos', null);
      expect(prisma.categoria.count.mock.calls[0][0].where.tiendaId).toBeNull();
    });

    it('countByTienda devuelve el total', async () => {
      expect(unwrap(await repo.countByTienda('t1'))).toBe(1);
      expect(prisma.categoria.count).toHaveBeenCalledWith({ where: { tiendaId: 't1' } });
    });

    it('errores como failure', async () => {
      prisma.categoria.count.mockRejectedValue(new Error('db'));
      expect((await repo.existsByNombreAndTienda('x', null) as { error: any }).error.message).toContain('existencia');
      expect((await repo.countByTienda(null) as { error: any }).error.message).toContain('contar');
    });
  });

  describe('delete', () => {
    it('borra y devuelve true', async () => {
      const result = await repo.delete('c1');
      expect(unwrap(result)).toBe(true);
      expect(prisma.categoria.delete).toHaveBeenCalledWith({ where: { id: 'c1' } });
    });

    it('código P2025 → "La categoría no existe"', async () => {
      const err = Object.assign(new Error('no'), { code: 'P2025' });
      prisma.categoria.delete.mockRejectedValue(err);
      const result = await repo.delete('c1');
      expect((result as { error: any }).error.message).toContain('no existe');
    });

    it('otros errores → genérico', async () => {
      prisma.categoria.delete.mockRejectedValue(new Error('fk'));
      const result = await repo.delete('c1');
      expect((result as { error: any }).error.message).toContain('eliminar');
    });
  });

  describe('search', () => {
    it('aplica paginación y devuelve total', async () => {
      prisma.categoria.count.mockResolvedValue(12);
      const r = unwrap(await repo.search({ query: 'lác', limit: 5, offset: 10, activa: true }))!;
      expect(r.total).toBe(12);
      expect(r.categorias).toHaveLength(1);
      const opts = prisma.categoria.findMany.mock.calls[0][0];
      expect(opts.take).toBe(5);
      expect(opts.skip).toBe(10);
    });

    it('sin limit/offset no aplica take/skip', async () => {
      await repo.search({});
      const opts = prisma.categoria.findMany.mock.calls[0][0];
      expect(opts.take).toBeUndefined();
      expect(opts.skip).toBeUndefined();
    });

    it('errores como failure', async () => {
      prisma.categoria.count.mockRejectedValue(new Error('db'));
      const result = await repo.search({});
      expect((result as { error: any }).error.message).toBeDefined();
    });
  });

  describe('getMostUsed / moveToTienda', () => {
    it('getMostUsed ordena por conteo de productos y aplica limit', async () => {
      await repo.getMostUsed(5, 't1');
      const opts = prisma.categoria.findMany.mock.calls[0][0];
      expect(opts.take).toBe(5);
      expect(opts.orderBy).toEqual({ productos: { _count: 'desc' } });
      expect(opts.where).toEqual({ tiendaId: 't1' });
    });

    it('getMostUsed sin tiendaId usa orden global', async () => {
      await repo.getMostUsed(10);
      expect(prisma.categoria.findMany.mock.calls[0][0].where).toEqual({});
    });

    it('moveToTienda actualiza tiendaId', async () => {
      const result = await repo.moveToTienda('c1', 't2');
      expect(unwrap(result)?.id).toBe('c1');
      expect(prisma.categoria.update.mock.calls[0][0].data.tiendaId).toBe('t2');
    });

    it('moveToTienda P2025 y errores genéricos', async () => {
      prisma.categoria.update.mockRejectedValue(Object.assign(new Error('no'), { code: 'P2025' }));
      expect((await repo.moveToTienda('c1', 't2') as { error: any }).error.message).toContain('no existe');
      prisma.categoria.update.mockRejectedValue(new Error('fk'));
      expect((await repo.moveToTienda('c1', 't2') as { error: any }).error.message.toLowerCase()).toContain('categoría');
    });

    it('getMostUsed errores como failure', async () => {
      prisma.categoria.findMany.mockRejectedValue(new Error('db'));
      expect((await repo.getMostUsed(5) as { error: any }).error.message).toContain('más utilizadas');
    });
  });
});
