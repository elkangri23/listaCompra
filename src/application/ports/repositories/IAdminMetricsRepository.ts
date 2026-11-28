/**
 * Puerto para las métricas del panel de administración (fase 7).
 *
 * Agregados reales sobre usuarios, listas, productos, invitaciones y
 * permisos. Las series por día/mes solo devuelven los días/meses con
 * datos (el caso de uso rellena los ceros); las fechas son UTC.
 */

export interface MetricsDayCount {
  /** Fecha UTC YYYY-MM-DD. */
  date: string;
  count: number;
}

export interface MetricsMonthCount {
  /** Mes UTC YYYY-MM. */
  month: string;
  count: number;
}

export interface MetricsFunnelCounts {
  /** Usuarios totales. */
  registered: number;
  /** Usuarios con email verificado. */
  verified: number;
  /** Usuarios con al menos una lista propia. */
  withList: number;
  /** Usuarios con al menos un producto creado (creadoPorId). */
  withProduct: number;
  /**
   * Usuarios con al menos una lista propia que tenga al menos una
   * invitación o un permiso (colaborador).
   */
  shared: number;
}

export interface IAdminMetricsRepository {
  /** Total de usuarios registrados. */
  countUsers(): Promise<number>;

  /** Usuarios con email verificado. */
  countVerifiedUsers(): Promise<number>;

  /** Total de listas. */
  countLists(): Promise<number>;

  /** Total de productos. */
  countProducts(): Promise<number>;

  /** Productos con categoría asignada (categoriaId no nulo). */
  countCategorizedProducts(): Promise<number>;

  /** Registros por día desde `since` (inclusive, UTC). */
  registrationsByDay(since: Date): Promise<MetricsDayCount[]>;

  /** Registros por mes desde `since` (inclusive, UTC). */
  registrationsByMonth(since: Date): Promise<MetricsMonthCount[]>;

  /** Listas creadas por día desde `since` (inclusive, UTC). */
  listsByDay(since: Date): Promise<MetricsDayCount[]>;

  /** Productos creados por día desde `since` (inclusive, UTC). */
  productsByDay(since: Date): Promise<MetricsDayCount[]>;

  /** Conteos del embudo (cada tramo es subconjunto del anterior). */
  funnelCounts(): Promise<MetricsFunnelCounts>;
}
