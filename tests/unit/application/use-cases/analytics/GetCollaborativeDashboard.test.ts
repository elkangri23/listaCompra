import { GetCollaborativeDashboard } from '../../../../../src/application/use-cases/analytics/GetCollaborativeDashboard';
import { ValidationError } from '../../../../../src/application/errors/ValidationError';
import type { IAnalyticsRepository, CollaborativeDashboardData } from '../../../../../src/application/ports/repositories/IAnalyticsRepository';
import { success, failure } from '../../../../../src/shared/result';

describe('GetCollaborativeDashboard', () => {
  let analyticsRepository: jest.Mocked<IAnalyticsRepository>;
  let useCase: GetCollaborativeDashboard;

  beforeEach(() => {
    analyticsRepository = {
      getCollaborativeDashboard: jest.fn()
    } as unknown as jest.Mocked<IAnalyticsRepository>;

    useCase = new GetCollaborativeDashboard(analyticsRepository);
  });

  it('debería fallar si no se proporciona userId', async () => {
    const result = await useCase.execute({ userId: '' });

    expect(result.isFailure).toBe(true);
    if (result.isFailure) {
      expect(result.error).toBeInstanceOf(ValidationError);
      expect((result.error as ValidationError).field).toBe('userId');
    }
  });

  it('debería generar insights a partir de los datos colaborativos', async () => {
    const dashboardData: CollaborativeDashboardData = {
      summary: {
        totalLists: 3,
        activeLists: 3,
        sharedLists: 1,
        totalCollaborators: 2,
        totalProducts: 5,
        purchasedProducts: 2,
        pendingProducts: 3,
        urgentProducts: 2,
        completionRate: 40,
        averagePurchaseTimeHours: 80
      },
      collaboration: {
        activeCollaborators: 2,
        leaderboard: [
          { userId: 'u1', displayName: 'Ana', itemsAdded: 3, purchasesCompleted: 2 }
        ],
        sharedLists: []
      },
      patterns: {
        topCategories: [
          { categoryId: 'cat1', name: 'Frutas', purchased: 3, pending: 1 }
        ],
        weeklyActivity: [
          { week: '2024-W10', additions: 1, purchases: 0, sharedListInteractions: 0 }
        ],
        peakPurchaseDay: { day: 'lunes', purchases: 4 }
      }
    };

    analyticsRepository.getCollaborativeDashboard.mockResolvedValue(success(dashboardData));

    const result = await useCase.execute({ userId: 'user-123' });

    expect(result.isSuccess).toBe(true);
    if (result.isSuccess) {
      const insightTitles = result.value.insights.map(insight => insight.title);
      expect(insightTitles).toEqual(expect.arrayContaining([
        'Activa a tu equipo',
        'Revisa productos pendientes',
        'Productos urgentes por atender',
        'Compras demoradas',
        'Colaborador destacado',
        'Categoría de mayor consumo',
        'Día pico de compras',
        'Pocas compras esta semana'
      ]));
      expect(result.value.generatedAt).toBeTruthy();
    }
  });

  it('debería propagar errores del repositorio', async () => {
    analyticsRepository.getCollaborativeDashboard.mockResolvedValue(
      failure(new Error('Repository failure'))
    );

    const result = await useCase.execute({ userId: 'user-123' });

    expect(result.isFailure).toBe(true);
    if (result.isFailure) {
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error.message).toContain('Repository failure');
    }
  });
});
