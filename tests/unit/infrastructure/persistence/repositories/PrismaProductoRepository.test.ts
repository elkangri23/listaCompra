/**
 * Tests unitarios para PrismaProductoRepository (persistencia real)
 * Mockea el PrismaClient: CRUD, filtros, resumen, agregados y manejo de errores.
 */

import { PrismaProductoRepository } from '../../../../../src/infrastructure/persistence/repositories/PrismaProductoRepository';
import type { Result } from '../../../../../src/shared/result';
import { Producto } from '../../../../../src/domain/entities/Producto';

const unwrap = <T>(r: Result<T, Error>): T | null | undefined => (r.isSuccess ? (r as { value: T | null }).value : undefined);

const PRISMA_PRODUCTO = {
  id: 'p1',
  nombre: 'Leche entera',
  descripcion: null,
  cantidad: 6,
  unidad: 'ud',
  precio: 4.5,
  comprado: false,
  urgente: false,
  listaId: 'l1',
  categoriaId: 'c1',
  creadoPorId: 'user-1',
  fechaCreacion: new Date('2025-01-01'),
  fechaActualizacion: new Date('2025-01-02'),
  fechaCompra: null
};

const makeProducto = (): Producto => {
  const r = Producto.create({ id: 'p1', nombre: 'Leche entera', listaId: 'l1', creadoPorId: 'user-1', cantidad: 6 });
  return (r as { isSuccess: true; value: Producto }).value;
};

function makePrisma(): any {
  return {
    producto: {
      findUnique: jest.fn().mockResolvedValue(PRISMA_PRODUCTO),
      findFirst: jest.fn().mockResolvedValue(PRISMA_PRODUCTO),
      findMany: jest.fn().mockResolvedValue([PRISMA_PRODUCTO]),
      create: jest.fn().mockResolvedValue(PRISMA_PRODUCTO),
      update: jest.fn().mockResolvedValue(PRISMA_PRODUCTO),
      updateMany: jest.fn().mockResolvedValue({ count: 3 }),
      delete: jest.fn().mockResolvedValue(PRISMA_PRODUCTO),
      deleteMany: jest.fn().mockResolvedValue({ count: 5 }),
      count: jest.fn().mockResolvedValue(6),
      aggregate: jest.fn().mockResolvedValue({ _sum: { precio: 27.5 } })
    }
  };
}

describe('PrismaProductoRepository', () => {
  let prisma: any;
  let repo: PrismaProductoRepository;

  beforeEach(() => {
    prisma = makePrisma();
    repo = new PrismaProductoRepository(prisma);
  });

  describe('save', () => {
    it('crea cuando no existe', async () => {
      prisma.producto.findUnique.mockResolvedValue(null);
      const result = await repo.save(makeProducto());
      expect(unwrap(result)?.id).toBe('p1');
      expect(prisma.producto.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ listaId: 'l1', creadoPorId: 'user-1' }) })
      );
      expect(prisma.producto.update).not.toHaveBeenCalled();
    });

    it('actualiza cuando ya existe', async () => {
      const result = await repo.save(makeProducto());
      expect(unwrap(result)?.id).toBe('p1');
      expect(prisma.producto.update).toHaveBeenCalled();
      expect(prisma.producto.create).not.toHaveBeenCalled();
    });

    it('devuelve failure en error de BD', async () => {
      prisma.producto.findUnique.mockRejectedValue(new Error('DB'));
      const result = await repo.save(makeProducto());
      expect((result as { error: Error }).error.message).toContain('guardar producto');
    });
  });

  describe('findById / findByIdAndList', () => {
    it('findById devuelve entidad o null', async () => {
      expect(unwrap(await repo.findById('p1'))?.nombre).toBe('Leche entera');
      prisma.producto.findUnique.mockResolvedValue(null);
      expect(unwrap(await repo.findById('nope'))).toBeNull();
    });

    it('findByIdAndList filtra por lista', async () => {
      expect(unwrap(await repo.findByIdAndList('p1', 'l1'))?.id).toBe('p1');
      expect(prisma.producto.findFirst).toHaveBeenCalledWith({ where: { id: 'p1', listaId: 'l1' } });
    });

    it('errores como failure', async () => {
      prisma.producto.findUnique.mockRejectedValue(new Error('x'));
      prisma.producto.findFirst.mockRejectedValue(new Error('x'));
      expect((await repo.findById('p1') as { error: Error }).error.message).toContain('por ID');
      expect((await repo.findByIdAndList('p1', 'l1') as { error: Error }).error.message).toContain('ID y lista');
    });
  });

  describe('findByList', () => {
    it('devuelve paginación calculada', async () => {
      prisma.producto.count.mockResolvedValue(15);
      const page = unwrap(
        await repo.findByList('l1', undefined, { page: 2, limit: 10 } as { page: number; limit: number })
      )!;
      expect(page.items).toHaveLength(1);
      expect(page.total).toBe(15);
      expect(page.page).toBe(2);
      expect(page.totalPages).toBe(2);
      expect(prisma.producto.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 10, take: 10 }));
    });

    it('sin paginación el limit es el total y 1 página', async () => {
      const page = unwrap(await repo.findByList('l1'))!;
      expect(page.totalPages).toBe(1);
      expect(page.limit).toBe(6);
    });

    it('aplica filtros', async () => {
      await repo.findByList('l1', { comprado: false, urgente: true, categoriaId: 'c1', busqueda: 'leche' } as any);
      const where = prisma.producto.findMany.mock.calls[0][0].where;
      expect(where).toMatchObject({ listaId: 'l1', comprado: false, urgente: true, categoriaId: 'c1' });
      expect(where.OR).toEqual(expect.any(Array));
    });

    it('mapeo fallido o error de BD devuelto como failure', async () => {
      prisma.producto.findMany.mockResolvedValue([{ ...PRISMA_PRODUCTO, nombre: '' } as any]);
      expect((await repo.findByList('l1')).isFailure).toBe(true);
      jest.clearAllMocks();
      prisma = makePrisma();
      prisma.producto.findMany.mockRejectedValue(new Error('db'));
      repo = new PrismaProductoRepository(prisma);
      expect((await repo.findByList('l1') as { error: Error }).error.message).toContain('por lista');
    });
  });

  describe('findByNameAndList / findByCategory / findUrgentByUser', () => {
    it('findByNameAndList usa contains insensitive', async () => {
      const productos = unwrap(await repo.findByNameAndList('leche', 'l1'))!;
      expect(productos).toHaveLength(1);
      expect(prisma.producto.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { listaId: 'l1', nombre: { contains: 'leche', mode: 'insensitive' } } })
      );
    });

    it('findByCategory mapea los resultados', async () => {
      const productos = unwrap(await repo.findByCategory('c1')) ?? [];
      expect(productos[0]?.id).toBe('p1');
    });

    it('findUrgentByUser busca no comprados con acceso del usuario', async () => {
      await repo.findUrgentByUser('user-1');
      const where = prisma.producto.findMany.mock.calls[0][0].where;
      expect(where).toMatchObject({ urgente: true, comprado: false });
      expect(where.lista.OR).toEqual(expect.any(Array));
    });

    it('errores como failure', async () => {
      prisma.producto.findMany.mockRejectedValue(new Error('db'));
      expect((await repo.findByNameAndList('x', 'y') as { error: Error }).error.message).toContain('por nombre');
      expect((await repo.findByCategory('x') as { error: Error }).error.message).toContain('categoría');
      expect((await repo.findUrgentByUser('x') as { error: Error }).error.message).toContain('urgentes');
    });
  });

  describe('resumen y agregados', () => {
    it('getResumenByList calcula comprados/pendientes/urgentes/valorTotal', async () => {
      // 6 productos totales, 2 comprados (count llamado en orden: comprados=2, urgentes=3)
      prisma.producto.count
        .mockResolvedValueOnce(2) // comprados
        .mockResolvedValueOnce(3) // urgentes
        .mockResolvedValueOnce(6); // countByList
      const resumen = unwrap(await repo.getResumenByList('l1'))!;
      expect(resumen).toEqual({ comprados: 2, pendientes: 4, urgentes: 3, valorTotal: 27.5 });
    });

    it('getResumenByList trata NaN de aggregate como 0', async () => {
      prisma.producto.aggregate.mockResolvedValue({ _sum: { precio: null } });
      prisma.producto.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(5);
      const resumen = unwrap(await repo.getResumenByList('l1'))!;
      expect(resumen.valorTotal).toBe(0);
    });

    it('getResumenByList failure si countByList falla', async () => {
      prisma.producto.count
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(3)
        .mockRejectedValueOnce(new Error('db'));
      const result = await repo.getResumenByList('l1');
      expect(result.isFailure).toBe(true);
    });

    it('getResumenByList devuelve failure en error global', async () => {
      prisma.producto.aggregate.mockRejectedValue(new Error('db'));
      expect((await repo.getResumenByList('l1') as { error: Error }).error.message).toContain('resumen de productos');
    });
  });

  describe('operaciones masivas', () => {
    it('markAllAsPurchased devuelve count', async () => {
      expect(unwrap(await repo.markAllAsPurchased('l1', true))).toBe(3);
      expect(prisma.producto.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: { comprado: true, fechaCompra: expect.any(Date) } })
      );
    });

    it('deleteAllByList devuelve count', async () => {
      expect(unwrap(await repo.deleteAllByList('l1'))).toBe(5);
      expect(prisma.producto.deleteMany).toHaveBeenCalledWith({ where: { listaId: 'l1' } });
    });

    it('markAllAsPurchased(false) pone fechaCompra null', async () => {
      await repo.markAllAsPurchased('l1', false);
      expect(prisma.producto.updateMany.mock.calls[0][0].data.fechaCompra).toBeNull();
    });

    it('updateMany/deleteMany errores como failure', async () => {
      prisma.producto.updateMany.mockRejectedValue(new Error('db'));
      prisma.producto.deleteMany.mockRejectedValue(new Error('db'));
      expect((await repo.markAllAsPurchased('l1', true) as { error: Error }).error.message).toContain('marcar productos');
      expect((await repo.deleteAllByList('l1') as { error: Error }).error.message).toContain('eliminar productos');
    });
  });

  describe('deleteById / existsById / countByList', () => {
    it('deleteById borra', async () => {
      expect((await repo.deleteById('p1')).isSuccess).toBe(true);
      expect(prisma.producto.delete).toHaveBeenCalledWith({ where: { id: 'p1' } });
    });

    it('existsById según count', async () => {
      expect(unwrap(await repo.existsById('p1'))).toBe(true);
      prisma.producto.findUnique.mockResolvedValue(null);
      expect(unwrap(await repo.existsById('p1'))).toBe(false);
    });

    it('countByList devuelve el total', async () => {
      expect(unwrap(await repo.countByList('l1'))).toBe(6);
      expect(prisma.producto.count).toHaveBeenCalledWith({ where: { listaId: 'l1' } });
    });

    it('errores como failure', async () => {
      prisma.producto.delete.mockRejectedValue(new Error('db'));
      prisma.producto.findUnique.mockRejectedValue(new Error('db'));
      prisma.producto.count.mockRejectedValue(new Error('db'));
      expect((await repo.deleteById('p1') as { error: Error }).error.message).toContain('eliminar producto');
      expect((await repo.existsById('p1') as { error: Error }).error.message).toContain('existencia del producto');
      expect((await repo.countByList('x') as { error: Error }).error.message).toContain('contar productos');
    });
  });
});
