/**
 * Tests unitarios para PrismaBlueprintRepository (persistencia real)
 * Mockea el PrismaClient: CRUD, búsquedas paginadas y manejo de errores.
 */

import { PrismaBlueprintRepository } from '../../../../../src/infrastructure/persistence/repositories/PrismaBlueprintRepository';
import type { Result } from '../../../../../src/shared/result';
import { Blueprint } from '../../../../../src/domain/entities/Blueprint';

const unwrap = <T>(r: Result<T, Error>): T | null | undefined =>
  r.isSuccess ? (r as { value: T }).value : undefined;

const CONTENIDO = [{ nombre: 'Leche', cantidad: 6, notas: 'entera' }];

const PRISMA_BLUEPRINT = {
  id: 'bp1',
  nombre: 'Desayunos del mes',
  descripcion: 'Plantilla habitual',
  publico: false,
  contenido: CONTENIDO,
  creadoPorId: 'u1',
  fechaCreacion: new Date('2025-01-01'),
  fechaActualizacion: new Date('2025-01-02')
};

const makeBlueprint = (): Blueprint =>
  Blueprint.recrear('bp1', 'Desayunos del mes', 'Plantilla habitual', false, CONTENIDO, 'u1', new Date('2025-01-01'), new Date('2025-01-02'));

describe('PrismaBlueprintRepository', () => {
  let prisma: any;
  let repo: PrismaBlueprintRepository;

  beforeEach(() => {
    prisma = {
      blueprint: {
        upsert: jest.fn().mockResolvedValue(PRISMA_BLUEPRINT),
        findUnique: jest.fn().mockResolvedValue(PRISMA_BLUEPRINT),
        findMany: jest.fn().mockResolvedValue([PRISMA_BLUEPRINT]),
        count: jest.fn().mockResolvedValue(1),
        update: jest.fn().mockResolvedValue(PRISMA_BLUEPRINT),
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
        delete: jest.fn().mockResolvedValue(PRISMA_BLUEPRINT)
      }
    };
    repo = new PrismaBlueprintRepository(prisma);
  });

  describe('save / findById', () => {
    it('save hace upsert con contenido sanitizado', async () => {
      const result = await repo.save(makeBlueprint());
      expect(unwrap(result)?.id).toBe('bp1');
      expect(unwrap(result)?.productos).toHaveLength(1);
      expect(prisma.blueprint.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'bp1' },
          create: expect.objectContaining({ creadoPorId: 'u1', publico: false })
        })
      );
    });

    it('save con contenido no serializable (BigInt) devuelve failure', async () => {
      const bp = Blueprint.recrear('bp1', 'x', undefined, false, [{ nombre: 'x', cantidad: 1n } as any], 'u1', new Date(), new Date());
      const result = await repo.save(bp);
      expect(result.isFailure).toBe(true);
    });

    it('findById devuelve entidad o null', async () => {
      expect(unwrap(await repo.findById('bp1'))?.nombre).toBe('Desayunos del mes');
      prisma.blueprint.findUnique.mockResolvedValue(null);
      expect(unwrap(await repo.findById('x'))).toBeNull();
    });

    it('findById con error de BD devuelve failure', async () => {
      prisma.blueprint.findUnique.mockRejectedValue(new Error('db'));
      expect((await repo.findById('bp1') as { error: Error }).error.message).toContain('db');
    });
  });

  describe('findByUsuarioId / findActiveByUsuarioId', () => {
    it('findByUsuarioId pagina y calcula totalPages', async () => {
      prisma.blueprint.count.mockResolvedValue(21);
      const page = unwrap(await repo.findByUsuarioId('u1', { page: 2, limit: 10 }))!;
      expect(page.total).toBe(21);
      expect(page.page).toBe(2);
      expect(page.totalPages).toBe(3);
      expect(prisma.blueprint.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10, where: { creadoPorId: 'u1' } })
      );
    });

    it('findByUsuarioId aplica filtro de nombre', async () => {
      await repo.findByUsuarioId('u1', undefined, { nombre: 'des' } as any);
      expect(prisma.blueprint.findMany.mock.calls[0][0].where.nombre).toEqual(
        { contains: 'des', mode: 'insensitive' }
      );
    });

    it('findActiveByUsuarioId devuelve todas las del usuario', async () => {
      const r = unwrap(await repo.findActiveByUsuarioId('u1'))!;
      expect(r).toHaveLength(1);
      expect(prisma.blueprint.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { creadoPorId: 'u1' } })
      );
    });

    it('errores como failure', async () => {
      prisma.blueprint.findMany.mockRejectedValue(new Error('db'));
      expect((await repo.findByUsuarioId('u1') as { error: Error }).error).toBeDefined();
      expect((await repo.findActiveByUsuarioId('u1') as { error: Error }).error).toBeDefined();
    });
  });

  describe('findByNombre', () => {
    it('busca en nombre/descripción del usuario o públicos', async () => {
      const page = unwrap(await repo.findByNombre('des', 'u1'))!;
      expect(page.items).toHaveLength(1);
      const where = prisma.blueprint.findMany.mock.calls[0][0].where;
      expect(where.AND).toHaveLength(2);
    });

    it('errores como failure', async () => {
      prisma.blueprint.count.mockRejectedValue(new Error('db'));
      const result = await repo.findByNombre('x', 'y');
      expect(result.isFailure).toBe(true);
    });
  });

  describe('exists / count', () => {
    it('existsById según count', async () => {
      expect(unwrap(await repo.existsById('bp1'))).toBe(true);
      prisma.blueprint.count.mockResolvedValue(0);
      expect(unwrap(await repo.existsById('bp1'))).toBe(false);
    });

    it('existsByNombreAndUsuario con excludeId', async () => {
      expect(unwrap(await repo.existsByNombreAndUsuario('Desayunos del mes', 'u1'))).toBe(true);
      await repo.existsByNombreAndUsuario('x', 'u1', 'bp1');
      expect(prisma.blueprint.count.mock.calls[1][0].where.id).toEqual({ not: 'bp1' });
    });

    it('countByUsuarioId ignora onlyActive (el schema no tiene campo activo)', async () => {
      expect(unwrap(await repo.countByUsuarioId('u1'))).toBe(1);
      await repo.countByUsuarioId('u1', true);
      expect(prisma.blueprint.count.mock.calls[1][0].where).toEqual({ creadoPorId: 'u1' });
    });

    it('count/exists errores como failure', async () => {
      prisma.blueprint.count.mockRejectedValue(new Error('db'));
      expect((await repo.existsById('x') as { error: Error }).error).toBeDefined();
      expect((await repo.existsByNombreAndUsuario('x', 'y') as { error: Error }).error).toBeDefined();
      expect((await repo.countByUsuarioId('x') as { error: Error }).error).toBeDefined();
    });
  });

  describe('deleteById / findAll / deactivateAllByUsuarioId', () => {
    it('deleteById borra', async () => {
      expect((await repo.deleteById('bp1')).isSuccess).toBe(true);
      expect(prisma.blueprint.delete).toHaveBeenCalledWith({ where: { id: 'bp1' } });
    });

    it('findAll con filtros y paginación', async () => {
      prisma.blueprint.count.mockResolvedValue(2);
      const page = unwrap(await repo.findAll({ page: 1, limit: 5 }, { usuarioId: 'u1', nombre: 'des' } as any))!;
      expect(page.total).toBe(2);
      const where = prisma.blueprint.findMany.mock.calls[0][0].where;
      expect(where.creadoPorId).toBe('u1');
      expect(where.nombre).toBeDefined();
    });

    it('findAll sin filtros usa where vacío', async () => {
      await repo.findAll();
      expect(prisma.blueprint.findMany.mock.calls[0][0].where).toEqual({});
    });

    it('deactivateAllByUsuarioId es no-op y devuelve success', async () => {
      const r = await repo.deactivateAllByUsuarioId('u1');
      expect(r.isSuccess).toBe(true);
      expect(prisma.blueprint.updateMany).not.toHaveBeenCalled();
    });

    it('deleteById/findAll errores como failure', async () => {
      prisma.blueprint.delete.mockRejectedValue(new Error('db'));
      prisma.blueprint.findMany.mockRejectedValue(new Error('db'));
      expect((await repo.deleteById('x') as { error: Error }).error).toBeDefined();
      expect((await repo.findAll() as { error: Error }).error).toBeDefined();
    });
  });
});
