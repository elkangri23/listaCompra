/**
 * Tests unitarios para PrismaListaRepository (persistencia real)
 * Mockea el PrismaClient: CRUD, filtros, paginación, orden y manejo de errores.
 */

import { PrismaListaRepository } from '../../../../../src/infrastructure/persistence/repositories/PrismaListaRepository';
import type { Result } from '../../../../../src/shared/result';
import { Lista } from '../../../../../src/domain/entities/Lista';

const unwrap = <T>(r: Result<T, Error>): T | null | undefined => (r.isSuccess ? (r as { value: T | null }).value : undefined);

const PRISMA_LISTA = {
  id: 'l1',
  nombre: 'Compras semanales',
  descripcion: 'Lo de cada semana',
  tiendaId: null,
  propietarioId: 'user-1',
  activa: true,
  fechaCreacion: new Date('2025-01-01'),
  fechaActualizacion: new Date('2025-01-02')
};

const makeLista = (): Lista => {
  const r = Lista.create({ id: 'l1', nombre: 'Compras semanales', propietarioId: 'user-1', descripcion: 'Lo de cada semana' });
  return (r as { isSuccess: true; value: Lista }).value;
};

describe('PrismaListaRepository', () => {
  let prisma: any;
  let repo: PrismaListaRepository;

  beforeEach(() => {
    prisma = {
      lista: {
        upsert: jest.fn().mockResolvedValue(PRISMA_LISTA),
        findUnique: jest.fn().mockResolvedValue(PRISMA_LISTA),
        findFirst: jest.fn().mockResolvedValue(PRISMA_LISTA),
        findMany: jest.fn().mockResolvedValue([PRISMA_LISTA]),
        count: jest.fn().mockResolvedValue(1),
        update: jest.fn().mockResolvedValue({ ...PRISMA_LISTA, activa: false }),
        delete: jest.fn().mockResolvedValue(PRISMA_LISTA)
      }
    };
    repo = new PrismaListaRepository(prisma);
  });

  describe('save', () => {
    it('hace upsert con los datos de persistencia', async () => {
      const lista = makeLista();
      const result = await repo.save(lista);

      expect(result.isSuccess).toBe(true);
      expect(unwrap(result)?.id).toBe('l1');
      expect(prisma.lista.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'l1' },
          update: expect.objectContaining({ nombre: 'Compras semanales' }),
          create: expect.objectContaining({ propietarioId: 'user-1' })
        })
      );
    });

    it('propaga error de base de datos como Result failure', async () => {
      prisma.lista.upsert.mockRejectedValue(new Error('DB down'));
      const result = await repo.save(makeLista());
      expect(result.isSuccess).toBe(false);
      expect(result.isFailure).toBe(true);
      expect((result as { error: Error }).error.message).toContain('Error al guardar lista');
    });
  });

  describe('findById', () => {
    it('devuelve la entidad cuando existe', async () => {
      const result = await repo.findById('l1');
      expect(unwrap(result)?.nombre).toBe('Compras semanales');
      expect(prisma.lista.findUnique).toHaveBeenCalledWith({ where: { id: 'l1' } });
    });

    it('devuelve success(null) cuando no existe', async () => {
      prisma.lista.findUnique.mockResolvedValue(null);
      const result = await repo.findById('nope');
      expect(result.isSuccess).toBe(true);
      expect(unwrap(result)).toBeNull();
    });

    it('devuelve failure en error de BD', async () => {
      prisma.lista.findUnique.mockRejectedValue(new Error('timeout'));
      const result = await repo.findById('l1');
      expect(result.isFailure).toBe(true);
      expect((result as { error: Error }).error.message).toContain('por ID');
    });
  });

  describe('findByIdAndOwner / findByNameAndOwner', () => {
    it('findByIdAndOwner usa findFirst con id y propietario', async () => {
      const result = await repo.findByIdAndOwner('l1', 'user-1');
      expect(unwrap(result)?.id).toBe('l1');
      expect(prisma.lista.findFirst).toHaveBeenCalledWith({ where: { id: 'l1', propietarioId: 'user-1' } });
    });

    it('findByIdAndOwner devuelve null si de otro propietario', async () => {
      prisma.lista.findFirst.mockResolvedValue(null);
      expect(unwrap(await repo.findByIdAndOwner('l1', 'otro'))).toBeNull();
    });

    it('findByNameAndOwner filtra por nombre y propietario', async () => {
      const result = await repo.findByNameAndOwner('Compras semanales', 'user-1');
      expect(unwrap(result)?.id).toBe('l1');
      expect(prisma.lista.findFirst).toHaveBeenCalledWith({ where: { nombre: 'Compras semanales', propietarioId: 'user-1' } });
    });

    it('errores de contexto devueltos como failure', async () => {
      prisma.lista.findFirst.mockRejectedValue(new Error('boom'));
      const r1 = await repo.findByIdAndOwner('l1', 'user-1');
      expect((r1 as { error: Error }).error.message).toContain('ID y propietario');
      const r2 = await repo.findByNameAndOwner('x', 'y');
      expect((r2 as { error: Error }).error.message).toContain('nombre y propietario');
    });
  });

  describe('findByOwner', () => {
    it('paginación por defecto y mapeo de items', async () => {
      const result = await repo.findByOwner('user-1');
      const page = unwrap(result)!;
      expect(page.items).toHaveLength(1);
      expect(page.total).toBe(1);
      expect(page.page).toBe(1);
      expect(page.limit).toBe(10);
      expect(page.totalPages).toBe(1);
      expect(prisma.lista.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 0, take: 10 }));
    });

    it('aplica limit máximo de 100 y calcula skip', async () => {
      prisma.lista.count.mockResolvedValue(250);
      await repo.findByOwner(
        'user-1',
        undefined,
        { page: 3, limit: 500 } as { page: number; limit: number }
      );
      expect(prisma.lista.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 200, take: 100 }));
    });

    it('aplica filtro activa y búsqueda de texto', async () => {
      await repo.findByOwner('user-1', { activa: true, busqueda: 'compras' } as any);
      expect(prisma.lista.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          propietarioId: 'user-1',
          activa: true,
          OR: expect.any(Array)
        })
      }));
    });

    it('aplica filtros de fechas', async () => {
      const desde = new Date('2025-01-01');
      const hasta = new Date('2025-06-30');
      await repo.findByOwner('user-1', { fechaCreacionDesde: desde, fechaActualizacionHasta: hasta } as any);
      const where = prisma.lista.findMany.mock.calls[0][0].where;
      expect(where.fechaCreacion).toEqual({ gte: desde });
      expect(where.fechaActualizacion).toEqual({ lte: hasta });
    });

    it('ignore filtros de tiendaId hasta migración', async () => {
      await repo.findByOwner('user-1', { tiendaId: 't1' } as any);
      expect(prisma.lista.findMany.mock.calls[0][0].where.tiendaId).toBeUndefined();
    });

    it('buildOrderBy por defecto fechaActualizacion desc, y funciona con sort válido', async () => {
      await repo.findByOwner('user-1', undefined, { page: 1, limit: 10 } as any, [{ field: 'nombre', direction: 'asc' } as any]);
      expect(prisma.lista.findMany.mock.calls[0][0].orderBy).toEqual([{ nombre: 'asc' }]);

      jest.clearAllMocks();
      await repo.findByOwner('user-1', undefined, undefined, [{ field: 'activa', direction: 'desc' } as any]);
      expect(prisma.lista.findMany.mock.calls[0][0].orderBy).toEqual([{ activa: 'desc' }]);
    });

    it('sort con campo desconocido cae al orden por defecto', async () => {
      await repo.findByOwner('user-1', undefined, undefined, [{ field: 'inexistente', direction: 'asc' } as any]);
      expect(prisma.lista.findMany.mock.calls[0][0].orderBy).toEqual([{ fechaActualizacion: 'desc' }]);
    });

    it('devuelve failure si el mapeo de dominio falla', async () => {
      prisma.lista.findMany.mockResolvedValue([{ ...PRISMA_LISTA, nombre: '' } as any]);
      const result = await repo.findByOwner('user-1');
      expect(result.isFailure).toBe(true);
    });

    it('devuelve failure en error de BD', async () => {
      prisma.lista.count.mockRejectedValue(new Error('count traits'));
      // Promise.all fallará por el count
      const result = await repo.findByOwner('user-1');
      expect(result.isFailure).toBe(true);
      expect((result as { error: Error }).error.message).toContain('propietario');
    });
  });

  describe('deleteById / hardDelete / updateActiveStatus', () => {
    it('deleteById hace soft delete (update activa=false)', async () => {
      const result = await repo.deleteById('l1');
      expect(result.isSuccess).toBe(true);
      expect(prisma.lista.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'l1' }, data: expect.objectContaining({ activa: false }) })
      );
    });

    it('hardDelete borra y devuelve true', async () => {
      const result = await repo.hardDelete('l1');
      expect(unwrap(result)).toBe(true);
      expect(prisma.lista.delete).toHaveBeenCalledWith({ where: { id: 'l1' } });
    });

    it('hardDelete devuelve failure en error', async () => {
      prisma.lista.delete.mockRejectedValue(new Error('fk constraint'));
      const result = await repo.hardDelete('l1');
      expect((result as { error: Error }).error.message).toContain('permanentemente');
    });

    it('updateActiveStatus actualiza con el valor dado', async () => {
      const result = await repo.updateActiveStatus('l1', false);
      expect(result.isSuccess).toBe(true);
      expect(prisma.lista.update.mock.calls[0][0].data.activa).toBe(false);
    });

    it('deleteById devuelve failure en error de BD', async () => {
      prisma.lista.update.mockRejectedValue(new Error('no connect'));
      const result = await repo.deleteById('l1');
      expect((result as { error: Error }).error.message).toContain('Error al eliminar lista');
    });
  });

  describe('exists / count', () => {
    it('existsById true cuando count>0', async () => {
      expect(unwrap(await repo.existsById('l1'))).toBe(true);
      prisma.lista.count.mockResolvedValue(0);
      expect(unwrap(await repo.existsById('l1'))).toBe(false);
    });

    it('existsByNameAndOwner usa count con nombre y propietario', async () => {
      expect(unwrap(await repo.existsByNameAndOwner('Compras semanales', 'user-1'))).toBe(true);
      expect(prisma.lista.count).toHaveBeenCalledWith({ where: { nombre: 'Compras semanales', propietarioId: 'user-1' } });
    });

    it('countByOwner filtra solo activas', async () => {
      expect(unwrap(await repo.countByOwner('user-1'))).toBe(1);
      expect(prisma.lista.count).toHaveBeenCalledWith({ where: { propietarioId: 'user-1', activa: true } });
    });

    it('count/exists devuelven failure en error de BD', async () => {
      prisma.lista.count.mockRejectedValue(new Error('err'));
      prisma.lista.update.mockRejectedValue(new Error('err'));
      expect((await repo.existsById('x') as { error: Error }).error.message).toContain('existencia de lista');
      expect((await repo.existsByNameAndOwner('x', 'y') as { error: Error }).error.message).toContain('por nombre');
      expect((await repo.countByOwner('x') as { error: Error }).error.message).toContain('contar listas');
      expect((await repo.updateActiveStatus('x', true) as { error: Error }).error.message).toContain('estado de lista');
    });
  });
});
