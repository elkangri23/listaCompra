import { PrismaAnalyticsRepository } from '../../../../../src/infrastructure/persistence/repositories/PrismaAnalyticsRepository';
import type { CollaborativeDashboardData } from '../../../../../src/application/ports/repositories/IAnalyticsRepository';

describe('PrismaAnalyticsRepository', () => {
  const createPrismaMock = () => ({
    lista: { findMany: jest.fn() },
    producto: { findMany: jest.fn() },
    usuario: { findMany: jest.fn() }
  });

  const ownerId = 'owner-1';
  const collaboratorId = 'collab-1';

  it('debería agregar correctamente los datos del dashboard', async () => {
    const prismaMock = createPrismaMock();

    const updatedAt = new Date('2024-03-10T10:00:00Z');
    prismaMock.lista.findMany.mockResolvedValue([
      {
        id: 'list-1',
        nombre: 'Compra semanal',
        activa: true,
        fechaActualizacion: updatedAt,
        permisos: [{ usuarioId: collaboratorId }]
      },
      {
        id: 'list-2',
        nombre: 'Fiesta',
        activa: false,
        fechaActualizacion: new Date('2024-03-05T08:00:00Z'),
        permisos: []
      }
    ]);

    prismaMock.producto.findMany.mockResolvedValue([
      {
        id: 'p-1',
        comprado: true,
        urgente: false,
        fechaCreacion: new Date('2024-03-01T09:00:00Z'),
        fechaCompra: new Date('2024-03-03T09:00:00Z'),
        listaId: 'list-1',
        creadoPorId: collaboratorId,
        categoriaId: 'cat-frutas',
        categoria: { nombre: 'Frutas' }
      },
      {
        id: 'p-2',
        comprado: false,
        urgente: true,
        fechaCreacion: new Date('2024-03-04T09:30:00Z'),
        fechaCompra: null,
        listaId: 'list-1',
        creadoPorId: collaboratorId,
        categoriaId: 'cat-frutas',
        categoria: { nombre: 'Frutas' }
      },
      {
        id: 'p-3',
        comprado: true,
        urgente: false,
        fechaCreacion: new Date('2024-03-05T09:00:00Z'),
        fechaCompra: new Date('2024-03-08T09:00:00Z'),
        listaId: 'list-2',
        creadoPorId: ownerId,
        categoriaId: 'cat-bebidas',
        categoria: { nombre: 'Bebidas' }
      }
    ]);

    prismaMock.usuario.findMany.mockResolvedValue([
      {
        id: collaboratorId,
        nombre: 'Ana',
        apellidos: 'Pérez',
        email: 'ana@example.com'
      },
      {
        id: ownerId,
        nombre: 'Carlos',
        apellidos: 'López',
        email: 'carlos@example.com'
      }
    ]);

    const repository = new PrismaAnalyticsRepository(prismaMock as any);
    const result = await repository.getCollaborativeDashboard(ownerId);

    expect(result.isSuccess).toBe(true);
    if (result.isSuccess) {
      const dashboard = result.value as CollaborativeDashboardData;

      expect(dashboard.summary).toEqual({
        totalLists: 2,
        activeLists: 1,
        sharedLists: 1,
        totalCollaborators: 1,
        totalProducts: 3,
        purchasedProducts: 2,
        pendingProducts: 1,
        urgentProducts: 1,
        completionRate: 67,
        averagePurchaseTimeHours: 60
      });

      expect(dashboard.collaboration.sharedLists).toHaveLength(1);
      expect(dashboard.collaboration.sharedLists[0]).toEqual({
        listId: 'list-1',
        name: 'Compra semanal',
        collaborators: 1,
        completionRate: 50,
        lastUpdated: updatedAt.toISOString()
      });

      expect(dashboard.collaboration.leaderboard).toHaveLength(2);
      expect(dashboard.collaboration.leaderboard[0]).toMatchObject({
        userId: collaboratorId,
        itemsAdded: 2,
        purchasesCompleted: 1,
        displayName: 'Ana Pérez'
      });

      expect(dashboard.patterns.topCategories[0]).toMatchObject({
        name: 'Frutas',
        purchased: 1,
        pending: 1
      });
      expect(dashboard.patterns.weeklyActivity.length).toBeGreaterThan(0);
    }
  });

  it('debería aplicar filtros de fecha al consultar productos', async () => {
    const prismaMock = createPrismaMock();
    prismaMock.lista.findMany.mockResolvedValue([]);
    prismaMock.producto.findMany.mockResolvedValue([]);
    prismaMock.usuario.findMany.mockResolvedValue([]);

    const repository = new PrismaAnalyticsRepository(prismaMock as any);

    const startDate = new Date('2024-03-01T00:00:00Z');
    const endDate = new Date('2024-03-31T23:59:59Z');

    const result = await repository.getCollaborativeDashboard(ownerId, {
      timeRange: { startDate, endDate }
    });

    expect(result.isSuccess).toBe(true);
    expect(prismaMock.producto.findMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        lista: { propietarioId: ownerId },
        fechaCreacion: { gte: startDate, lte: endDate }
      }),
      select: expect.any(Object)
    });
  });

  it('debería devolver un error cuando Prisma lanza una excepción', async () => {
    const prismaMock = createPrismaMock();
    prismaMock.lista.findMany.mockRejectedValue(new Error('DB error'));
    prismaMock.producto.findMany.mockResolvedValue([]);
    prismaMock.usuario.findMany.mockResolvedValue([]);

    const repository = new PrismaAnalyticsRepository(prismaMock as any);
    const result = await repository.getCollaborativeDashboard(ownerId);

    expect(result.isFailure).toBe(true);
    if (result.isFailure) {
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error.message).toContain('DB error');
    }
  });
});
