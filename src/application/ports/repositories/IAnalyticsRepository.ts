/**
 * Puerto para repositorio de analíticas colaborativas
 * Expone métricas avanzadas para el dashboard (CU-31)
 */

import type { Result } from '@shared/result';

export interface DashboardTimeRange {
  startDate?: Date;
  endDate?: Date;
}

export interface DashboardAnalyticsOptions {
  timeRange?: DashboardTimeRange;
}

export interface DashboardSummaryMetrics {
  totalLists: number;
  activeLists: number;
  sharedLists: number;
  totalCollaborators: number;
  totalProducts: number;
  purchasedProducts: number;
  pendingProducts: number;
  urgentProducts: number;
  completionRate: number;
  averagePurchaseTimeHours: number | null;
}

export interface CollaborationListMetric {
  listId: string;
  name: string;
  collaborators: number;
  completionRate: number;
  lastUpdated: string;
}

export interface CollaborationLeaderboardEntry {
  userId: string;
  displayName: string;
  email?: string;
  itemsAdded: number;
  purchasesCompleted: number;
}

export interface CollaborationMetrics {
  activeCollaborators: number;
  leaderboard: CollaborationLeaderboardEntry[];
  sharedLists: CollaborationListMetric[];
}

export interface CategoryPatternMetric {
  categoryId: string | null;
  name: string;
  purchased: number;
  pending: number;
}

export interface WeeklyActivityPoint {
  week: string;
  additions: number;
  purchases: number;
  sharedListInteractions: number;
}

export interface DashboardPatternMetrics {
  topCategories: CategoryPatternMetric[];
  weeklyActivity: WeeklyActivityPoint[];
  peakPurchaseDay?: {
    day: string;
    purchases: number;
  };
}

export interface CollaborativeDashboardData {
  summary: DashboardSummaryMetrics;
  collaboration: CollaborationMetrics;
  patterns: DashboardPatternMetrics;
}

export interface IAnalyticsRepository {
  /**
   * Obtiene datos agregados para el dashboard colaborativo del usuario
   */
  getCollaborativeDashboard(
    userId: string,
    options?: DashboardAnalyticsOptions
  ): Promise<Result<CollaborativeDashboardData, Error>>;
}
