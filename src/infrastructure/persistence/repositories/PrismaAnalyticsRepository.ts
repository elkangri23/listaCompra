/**
 * Implementación Prisma del repositorio de analíticas colaborativas (CU-31)
 */

import type { Prisma, PrismaClient } from '@prisma/client';
import { success, failure, type Result } from '@shared/result';
import type {
  IAnalyticsRepository,
  DashboardAnalyticsOptions,
  CollaborativeDashboardData,
  CollaborationLeaderboardEntry,
  CollaborationListMetric,
  CategoryPatternMetric,
  WeeklyActivityPoint,
} from '@application/ports/repositories/IAnalyticsRepository';

export class PrismaAnalyticsRepository implements IAnalyticsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getCollaborativeDashboard(
    userId: string,
    options?: DashboardAnalyticsOptions
  ): Promise<Result<CollaborativeDashboardData, Error>> {
    try {
      const { startDate, endDate } = options?.timeRange ?? {};

      const productWhere: Prisma.ProductoWhereInput = {
        lista: { propietarioId: userId }
      };

      if (startDate || endDate) {
        productWhere.fechaCreacion = {};
        if (startDate) {
          productWhere.fechaCreacion.gte = startDate;
        }
        if (endDate) {
          productWhere.fechaCreacion.lte = endDate;
        }
      }

      const [lists, products] = await Promise.all([
        this.prisma.lista.findMany({
          where: { propietarioId: userId },
          select: {
            id: true,
            nombre: true,
            activa: true,
            fechaActualizacion: true,
            permisos: { select: { usuarioId: true } }
          }
        }),
        this.prisma.producto.findMany({
          where: productWhere,
          select: {
            id: true,
            comprado: true,
            urgente: true,
            fechaCreacion: true,
            fechaCompra: true,
            listaId: true,
            creadoPorId: true,
            categoriaId: true,
            categoria: { select: { nombre: true } }
          }
        })
      ]);

      const collaboratorIds = new Set<string>();
      const listCollaboratorCounts = new Map<string, number>();
      const sharedListMetrics: CollaborationListMetric[] = [];

      for (const list of lists) {
        const collaborators = list.permisos
          .map(permiso => permiso.usuarioId)
          .filter(id => id && id !== userId);

        collaborators.forEach(id => collaboratorIds.add(id));
        const collaboratorCount = collaborators.length;
        listCollaboratorCounts.set(list.id, collaboratorCount);

        if (collaboratorCount > 0) {
          sharedListMetrics.push({
            listId: list.id,
            name: list.nombre,
            collaborators: collaboratorCount,
            completionRate: 0,
            lastUpdated: list.fechaActualizacion.toISOString()
          });
        }
      }

      const totalProducts = products.length;
      let purchasedProducts = 0;
      let urgentProducts = 0;

      const purchaseDurations: number[] = [];
      const categoryMap = new Map<string, CategoryPatternMetric>();
      const contributions = new Map<string, { items: number; purchases: number }>();
      const contributorIds = new Set<string>();
      const listTotals = new Map<string, { total: number; purchased: number }>();
      const weeklyActivity = new Map<string, WeeklyActivityPoint>();
      const purchaseDayMap = new Map<number, number>();

      for (const product of products) {
        if (product.urgente) {
          urgentProducts++;
        }

        const listStat = listTotals.get(product.listaId) || { total: 0, purchased: 0 };
        listStat.total++;

        const isSharedList = (listCollaboratorCounts.get(product.listaId) || 0) > 0;

        const creationWeekKey = this.formatWeek(product.fechaCreacion);
        const creationWeek = weeklyActivity.get(creationWeekKey) || {
          week: creationWeekKey,
          additions: 0,
          purchases: 0,
          sharedListInteractions: 0
        };
        creationWeek.additions++;
        if (isSharedList) {
          creationWeek.sharedListInteractions++;
        }
        weeklyActivity.set(creationWeekKey, creationWeek);

        if (product.comprado) {
          purchasedProducts++;
          listStat.purchased++;

          if (product.fechaCompra) {
            const purchaseDuration = product.fechaCompra.getTime() - product.fechaCreacion.getTime();
            if (purchaseDuration > 0) {
              purchaseDurations.push(purchaseDuration);
            }

            const purchaseWeekKey = this.formatWeek(product.fechaCompra);
            const purchaseWeek = weeklyActivity.get(purchaseWeekKey) || {
              week: purchaseWeekKey,
              additions: 0,
              purchases: 0,
              sharedListInteractions: 0
            };
            purchaseWeek.purchases++;
            if (isSharedList) {
              purchaseWeek.sharedListInteractions++;
            }
            weeklyActivity.set(purchaseWeekKey, purchaseWeek);

            const dayIndex = product.fechaCompra.getDay();
            purchaseDayMap.set(dayIndex, (purchaseDayMap.get(dayIndex) || 0) + 1);
          }
        }

        listTotals.set(product.listaId, listStat);

        if (product.creadoPorId) {
          const contribution = contributions.get(product.creadoPorId) || { items: 0, purchases: 0 };
          contribution.items++;
          if (product.comprado) {
            contribution.purchases++;
          }
          contributions.set(product.creadoPorId, contribution);
          contributorIds.add(product.creadoPorId);
        }

        const categoryKey = product.categoriaId || 'uncategorized';
        const categoryMetric = categoryMap.get(categoryKey) || {
          categoryId: product.categoriaId || null,
          name: product.categoria?.nombre || 'Sin categoría',
          purchased: 0,
          pending: 0
        };
        if (product.comprado) {
          categoryMetric.purchased++;
        } else {
          categoryMetric.pending++;
        }
        categoryMap.set(categoryKey, categoryMetric);
      }

      for (const sharedMetric of sharedListMetrics) {
        const totals = listTotals.get(sharedMetric.listId) || { total: 0, purchased: 0 };
        sharedMetric.completionRate = totals.total > 0
          ? Math.round((totals.purchased / totals.total) * 100)
          : 0;
      }

      const leaderboard = await this.buildLeaderboard(contributions, contributorIds);

      const topCategories = Array.from(categoryMap.values())
        .sort((a, b) => b.purchased - a.purchased || b.pending - a.pending)
        .slice(0, 5);

      const weeklyActivityPoints = Array.from(weeklyActivity.values())
        .sort((a, b) => a.week.localeCompare(b.week))
        .slice(-8);

      const peakPurchaseDay = this.getPeakPurchaseDay(purchaseDayMap);

      const averagePurchaseTimeHours = purchaseDurations.length > 0
        ? Number((purchaseDurations.reduce((sum, duration) => sum + duration, 0) / purchaseDurations.length / (1000 * 60 * 60)).toFixed(2))
        : null;

      const summary: CollaborativeDashboardData['summary'] = {
        totalLists: lists.length,
        activeLists: lists.filter(list => list.activa).length,
        sharedLists: sharedListMetrics.length,
        totalCollaborators: collaboratorIds.size,
        totalProducts,
        purchasedProducts,
        pendingProducts: totalProducts - purchasedProducts,
        urgentProducts,
        completionRate: totalProducts > 0 ? Math.round((purchasedProducts / totalProducts) * 100) : 0,
        averagePurchaseTimeHours
      };

      const collaboration: CollaborativeDashboardData['collaboration'] = {
        activeCollaborators: collaboratorIds.size,
        leaderboard,
        sharedLists: sharedListMetrics.sort((a, b) => b.collaborators - a.collaborators)
      };

      const patterns: CollaborativeDashboardData['patterns'] = {
        topCategories,
        weeklyActivity: weeklyActivityPoints,
        ...(peakPurchaseDay ? { peakPurchaseDay } : {})
      };

      return success({
        summary,
        collaboration,
        patterns
      });
    } catch (error) {
      return failure(new Error(`Error al construir el dashboard colaborativo: ${error instanceof Error ? error.message : String(error)}`));
    }
  }

  private async buildLeaderboard(
    contributions: Map<string, { items: number; purchases: number }>,
    contributorIds: Set<string>
  ): Promise<CollaborationLeaderboardEntry[]> {
    if (contributorIds.size === 0) {
      return [];
    }

    const users = await this.prisma.usuario.findMany({
      where: { id: { in: Array.from(contributorIds) } },
      select: { id: true, nombre: true, apellidos: true, email: true }
    });
    const userMap = new Map(users.map(user => [user.id, user]));

    return Array.from(contributions.entries())
      .map(([userId, stats]) => {
        const user = userMap.get(userId);
        const displayName = user
          ? [user.nombre, user.apellidos].filter(Boolean).join(' ') || user.email || 'Colaborador'
          : 'Colaborador';

        const entry: CollaborationLeaderboardEntry = {
          userId,
          displayName,
          itemsAdded: stats.items,
          purchasesCompleted: stats.purchases
        };

        if (user?.email) {
          entry.email = user.email;
        }

        return entry;
      })
      .sort((a, b) => b.itemsAdded - a.itemsAdded || b.purchasesCompleted - a.purchasesCompleted)
      .slice(0, 5);
  }

  private formatWeek(date: Date): string {
    const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNumber = utcDate.getUTCDay() || 7;
    utcDate.setUTCDate(utcDate.getUTCDate() + 4 - dayNumber);
    const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
    const weekNumber = Math.ceil((((utcDate.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `${utcDate.getUTCFullYear()}-W${weekNumber.toString().padStart(2, '0')}`;
  }

  private getPeakPurchaseDay(purchaseDayMap: Map<number, number>): { day: string; purchases: number } | undefined {
    if (purchaseDayMap.size === 0) {
      return undefined;
    }

    const days = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    let peakDay: { day: string; purchases: number } | undefined;

    for (const [dayIndex, purchases] of purchaseDayMap.entries()) {
      if (!peakDay || purchases > peakDay.purchases) {
        const dayName = days[dayIndex] ?? days[0] ?? 'domingo';
        peakDay = { day: dayName, purchases };
      }
    }

    return peakDay;
  }
}
