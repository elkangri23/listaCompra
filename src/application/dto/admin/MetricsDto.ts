/**
 * DTOs del panel de administración, pestaña Métricas (fase 7).
 *
 * Contrato exacto de GET /admin/metrics/overview. Todas las series
 * temporales vienen con ceros rellenados (nunca null en los arrays) y
 * las fechas son UTC (YYYY-MM-DD para días, YYYY-MM para meses).
 */

// ===========================================================================
// Overview: GET /admin/metrics/overview
// ===========================================================================

export interface MetricsDayCountDto {
  /** Fecha UTC YYYY-MM-DD. */
  date: string;
  count: number;
}

export interface MetricsMonthCountDto {
  /** Mes UTC YYYY-MM. */
  month: string;
  count: number;
}

export interface MetricsTotalsDto {
  users: number;
  verifiedUsers: number;
  /** % de usuarios verificados (0-100, 1 decimal). */
  verifiedPct: number;
  lists: number;
  products: number;
  categorizedProducts: number;
  /** % de productos con categoría (0-100, 1 decimal). */
  categorizedPct: number;
}

export interface MetricsGrowthDto {
  /** Registros por día, últimos 30 días (con ceros). */
  registrationsByDay: MetricsDayCountDto[];
  /** Registros por mes, últimos 12 meses (con ceros). */
  registrationsByMonth: MetricsMonthCountDto[];
  /** Listas creadas por día, últimos 30 días (con ceros). */
  listsByDay: MetricsDayCountDto[];
  /** Productos creados por día, últimos 30 días (con ceros). */
  productsByDay: MetricsDayCountDto[];
  totals: MetricsTotalsDto;
}

export interface MetricsFunnelDto {
  /** Usuarios totales. */
  registered: number | null;
  /** Usuarios con email verificado. */
  verified: number | null;
  /** Usuarios con al menos una lista propia. */
  withList: number | null;
  /** Usuarios con al menos un producto creado. */
  withProduct: number | null;
  /** Usuarios con al menos una lista propia compartida (invitación o permiso). */
  shared: number | null;
  /**
   * Motivo cuando algún tramo no se pudo calcular (entonces todos los
   * tramos llegan como null). Nunca se inventa un conteo.
   */
  reason?: string;
}

export interface MetricsActivityDto {
  /** Emails distintos con login correcto por día, últimos 30 días (con ceros). */
  activeUsersByDay: MetricsDayCountDto[];
  /**
   * Retención por cohortes: NO calculable con sentido con la base
   * actual (sin última conexión por usuario y cohortes demasiado
   * pequeñas), así que `available` es siempre false con el motivo.
   * Nunca se inventa un %.
   */
  retention: {
    available: false;
    reason: string;
  };
}

export interface MetricsBackupLastCreatedDto {
  id: string;
  filename: string;
  sizeBytes: number;
  /** Fecha ISO de creación. */
  createdAt: string;
  /** Horas desde su creación (1 decimal). */
  ageHours: number;
}

export interface MetricsBackupHealthDto {
  /** Última copia en estado CREATED, o null si no hay ninguna. */
  lastCreated: MetricsBackupLastCreatedDto | null;
  /** true si no hay ninguna copia CREATED en >24 h (o no hay ninguna). */
  stale: boolean;
  /** Motivo cuando está stale o no se pudo consultar; null en caso contrario. */
  reason: string | null;
}

export interface MetricsAiUsageDayDto {
  /** Fecha UTC YYYY-MM-DD. */
  date: string;
  total: number;
  success: number;
}

export interface MetricsAiUsage7dDto {
  total: number;
  success: number;
  failed: number;
  cached: number;
  /** Últimos 7 días (con ceros). */
  byDay: MetricsAiUsageDayDto[];
}

export interface AdminMetricsOverviewDto {
  growth: MetricsGrowthDto;
  funnel: MetricsFunnelDto;
  activity: MetricsActivityDto;
  backupHealth: MetricsBackupHealthDto;
  aiUsage7d: MetricsAiUsage7dDto;
}
