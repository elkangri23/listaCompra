/**
 * DTOs para el dashboard colaborativo de análisis (CU-31)
 */

import type {
  CollaborativeDashboardData,
  DashboardAnalyticsOptions
} from '@application/ports/repositories/IAnalyticsRepository';

export interface GetCollaborativeDashboardDto extends DashboardAnalyticsOptions {
  userId: string;
}

export type CollaborativeDashboardResponseDto = CollaborativeDashboardData & {
  insights: DashboardInsightDto[];
  generatedAt: string;
};

export interface DashboardInsightDto {
  title: string;
  description: string;
  severity: 'info' | 'success' | 'warning' | 'critical';
  metric?: string;
}
