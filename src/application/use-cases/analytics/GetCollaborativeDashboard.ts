/**
 * Caso de uso: Dashboard de análisis colaborativo (CU-31)
 * Combina métricas, patrones e insights accionables
 */

import type { Result } from '@shared/result';
import { success, failure } from '@shared/result';
import type {
  IAnalyticsRepository,
  CollaborativeDashboardData,
} from '@application/ports/repositories/IAnalyticsRepository';
import type {
  CollaborativeDashboardResponseDto,
  GetCollaborativeDashboardDto,
  DashboardInsightDto,
} from '@application/dto/analytics/CollaborativeDashboardDto';
import { ValidationError } from '@application/errors/ValidationError';

export class GetCollaborativeDashboard {
  constructor(
    private readonly analyticsRepository: IAnalyticsRepository
  ) {}

  async execute(
    dto: GetCollaborativeDashboardDto
  ): Promise<Result<CollaborativeDashboardResponseDto, ValidationError | Error>> {
    if (!dto.userId || dto.userId.trim().length === 0) {
      return failure(ValidationError.create(
        'El identificador del usuario es requerido para generar el dashboard',
        'userId',
        dto.userId
      ));
    }

    const options = dto.timeRange ? { timeRange: dto.timeRange } : undefined;

    const dashboardResult = await this.analyticsRepository.getCollaborativeDashboard(
      dto.userId,
      options
    );

    if (dashboardResult.isFailure) {
      return failure(dashboardResult.error);
    }

    const insights = this.generateInsights(dashboardResult.value);

    return success({
      ...dashboardResult.value,
      insights,
      generatedAt: new Date().toISOString()
    });
  }

  private generateInsights(data: CollaborativeDashboardData): DashboardInsightDto[] {
    const insights: DashboardInsightDto[] = [];
    const { summary, collaboration, patterns } = data;

    if (summary.totalLists === 0) {
      insights.push({
        title: 'Crea tu primera lista',
        description: 'Aún no tienes listas creadas. Crea una lista y comparte con tu equipo para empezar a colaborar.',
        severity: 'info',
        metric: 'totalLists'
      });
      return insights;
    }

    if (summary.sharedLists > 0) {
      const participationRate = summary.totalCollaborators > 0
        ? (collaboration.leaderboard.length / summary.totalCollaborators) * 100
        : 0;

      if (participationRate >= 70) {
        insights.push({
          title: 'Colaboración saludable',
          description: 'La mayoría de tus colaboradores participan activamente agregando o completando productos.',
          severity: 'success',
          metric: 'totalCollaborators'
        });
      } else if (summary.totalCollaborators > 0) {
        insights.push({
          title: 'Activa a tu equipo',
          description: 'Tienes colaboradores asignados pero pocos participan. Comparte avances y asigna productos para aumentar la colaboración.',
          severity: 'warning',
          metric: 'totalCollaborators'
        });
      }
    } else {
      insights.push({
        title: 'Comparte tus listas',
        description: 'Ninguna de tus listas está compartida. Invita a otras personas para coordinar compras en conjunto.',
        severity: 'info',
        metric: 'sharedLists'
      });
    }

    if (summary.completionRate >= 80) {
      insights.push({
        title: 'Excelente seguimiento de compras',
        description: 'Más del 80% de los productos de tus listas están completados. ¡Buen trabajo!',
        severity: 'success',
        metric: 'completionRate'
      });
    } else if (summary.completionRate < 50 && summary.totalProducts > 0) {
      insights.push({
        title: 'Revisa productos pendientes',
        description: 'Menos de la mitad de los productos han sido comprados. Prioriza los pendientes y asigna responsables.',
        severity: 'warning',
        metric: 'completionRate'
      });
    }

    if (summary.urgentProducts > 0) {
      const severity = summary.urgentProducts >= 5 ? 'critical' : 'warning';
      insights.push({
        title: 'Productos urgentes por atender',
        description: `Tienes ${summary.urgentProducts} productos marcados como urgentes. Coordina al equipo para resolverlos cuanto antes.`,
        severity,
        metric: 'urgentProducts'
      });
    }

    if (summary.averagePurchaseTimeHours && summary.averagePurchaseTimeHours > 72) {
      insights.push({
        title: 'Compras demoradas',
        description: 'Los productos tardan más de 3 días en comprarse. Evalúa reasignar responsables o ajustar prioridades.',
        severity: 'warning',
        metric: 'averagePurchaseTimeHours'
      });
    }

    if (collaboration.leaderboard.length > 0) {
      const [topContributor] = collaboration.leaderboard;
      if (topContributor) {
        insights.push({
          title: 'Colaborador destacado',
          description: `${topContributor.displayName} agregó ${topContributor.itemsAdded} productos recientemente. Reconoce su aporte para mantener la motivación del equipo.`,
          severity: 'info',
          metric: 'leaderboard'
        });
      }
    }

    if (patterns.topCategories.length > 0) {
      const [topCategory] = patterns.topCategories;
      if (topCategory) {
        insights.push({
          title: 'Categoría de mayor consumo',
          description: `La categoría "${topCategory.name}" concentra la mayor parte de tus compras. Evalúa crear automatizaciones o listas recurrentes.`,
          severity: 'info',
          metric: 'topCategories'
        });
      }
    }

    if (patterns.peakPurchaseDay && patterns.peakPurchaseDay.purchases >= 3) {
      insights.push({
        title: 'Día pico de compras',
        description: `El día con más compras es ${patterns.peakPurchaseDay.day}. Aprovecha para planificar recordatorios y asignaciones previas a esa fecha.`,
        severity: 'info',
        metric: 'peakPurchaseDay'
      });
    }

    if (patterns.weeklyActivity.length > 0) {
      const recentWeek = patterns.weeklyActivity[patterns.weeklyActivity.length - 1];
      if (recentWeek && recentWeek.purchases === 0 && summary.pendingProducts > 0) {
        insights.push({
          title: 'Pocas compras esta semana',
          description: 'No se registraron compras en la última semana pese a tener productos pendientes. Coordina revisiones rápidas con tu equipo.',
          severity: 'warning',
          metric: 'weeklyActivity'
        });
      }
    }

    return insights;
  }
}
