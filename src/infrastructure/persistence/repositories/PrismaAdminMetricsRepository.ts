/**
 * Repositorio de métricas del panel de administración usando Prisma
 * (fase 7).
 *
 * Nota: el cliente Prisma se recibe como `unknown` y se proyecta a los
 * delegados en vez de importar `PrismaClient` (mismo patrón que
 * PrismaAIUsageEventRepository, fase 3): en local no se puede ejecutar
 * `prisma generate` y el cliente generado no incluye todavía los modelos
 * nuevos, así que el import tipado rompería la compilación local. En CI
 * `prisma migrate deploy` + generate crean los delegados reales.
 *
 * Las series por día/mes se agrupan en SQL con `to_char(... AT TIME ZONE
 * 'UTC', ...)` porque Prisma `groupBy` agrupa por el timestamp exacto,
 * no por día. Los `COUNT(*)` llevan `::int`: sin el cast, Postgres
 * devuelve bigint y Prisma lo entrega como bigint, no como number.
 *
 * Tablas y columnas según prisma/schema.prisma: usuarios (fechaCreacion,
 * emailVerificado), listas (propietarioId, fechaCreacion), productos
 * (categoriaId, creadoPorId, fechaCreacion), invitaciones (listaId),
 * permisos (listaId).
 */

import type {
  IAdminMetricsRepository,
  MetricsDayCount,
  MetricsFunnelCounts,
  MetricsMonthCount,
} from '../../../application/ports/repositories/IAdminMetricsRepository';

interface RawQueryClient {
  $queryRaw<T>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
}

interface UsuarioCountDelegate {
  count(args?: { where?: { emailVerificado?: boolean } }): Promise<number>;
}

interface ListaCountDelegate {
  count(): Promise<number>;
}

interface ProductoCountDelegate {
  count(args?: { where?: { categoriaId?: { not: null } } }): Promise<number>;
}

interface FunnelRow {
  withList: number;
  withProduct: number;
  shared: number;
}

export class PrismaAdminMetricsRepository implements IAdminMetricsRepository {
  private readonly raw: RawQueryClient;
  private readonly usuario: UsuarioCountDelegate;
  private readonly lista: ListaCountDelegate;
  private readonly producto: ProductoCountDelegate;

  constructor(prisma: unknown) {
    const client = prisma as {
      $queryRaw: RawQueryClient['$queryRaw'];
      usuario: UsuarioCountDelegate;
      lista: ListaCountDelegate;
      producto: ProductoCountDelegate;
    };
    this.raw = { $queryRaw: client.$queryRaw.bind(client) };
    this.usuario = client.usuario;
    this.lista = client.lista;
    this.producto = client.producto;
  }

  async countUsers(): Promise<number> {
    return this.usuario.count();
  }

  async countVerifiedUsers(): Promise<number> {
    return this.usuario.count({ where: { emailVerificado: true } });
  }

  async countLists(): Promise<number> {
    return this.lista.count();
  }

  async countProducts(): Promise<number> {
    return this.producto.count();
  }

  async countCategorizedProducts(): Promise<number> {
    return this.producto.count({ where: { categoriaId: { not: null } } });
  }

  async registrationsByDay(since: Date): Promise<MetricsDayCount[]> {
    return this.raw.$queryRaw<MetricsDayCount[]>`
      SELECT to_char("fechaCreacion" AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS date,
             COUNT(*)::int AS count
      FROM usuarios
      WHERE "fechaCreacion" >= ${since}
      GROUP BY 1
      ORDER BY 1`;
  }

  async registrationsByMonth(since: Date): Promise<MetricsMonthCount[]> {
    return this.raw.$queryRaw<MetricsMonthCount[]>`
      SELECT to_char("fechaCreacion" AT TIME ZONE 'UTC', 'YYYY-MM') AS month,
             COUNT(*)::int AS count
      FROM usuarios
      WHERE "fechaCreacion" >= ${since}
      GROUP BY 1
      ORDER BY 1`;
  }

  async listsByDay(since: Date): Promise<MetricsDayCount[]> {
    return this.raw.$queryRaw<MetricsDayCount[]>`
      SELECT to_char("fechaCreacion" AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS date,
             COUNT(*)::int AS count
      FROM listas
      WHERE "fechaCreacion" >= ${since}
      GROUP BY 1
      ORDER BY 1`;
  }

  async productsByDay(since: Date): Promise<MetricsDayCount[]> {
    return this.raw.$queryRaw<MetricsDayCount[]>`
      SELECT to_char("fechaCreacion" AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS date,
             COUNT(*)::int AS count
      FROM productos
      WHERE "fechaCreacion" >= ${since}
      GROUP BY 1
      ORDER BY 1`;
  }

  async funnelCounts(): Promise<MetricsFunnelCounts> {
    const [rows, registered, verified] = await Promise.all([
      this.raw.$queryRaw<FunnelRow[]>`
        SELECT
          (SELECT COUNT(DISTINCT "propietarioId")::int FROM listas) AS "withList",
          (SELECT COUNT(DISTINCT "creadoPorId")::int FROM productos) AS "withProduct",
          (SELECT COUNT(DISTINCT l."propietarioId")::int FROM listas l
            WHERE EXISTS (SELECT 1 FROM invitaciones i WHERE i."listaId" = l.id)
               OR EXISTS (SELECT 1 FROM permisos p WHERE p."listaId" = l.id)) AS shared`,
      this.countUsers(),
      this.countVerifiedUsers(),
    ]);
    const row = rows[0] ?? { withList: 0, withProduct: 0, shared: 0 };
    return {
      registered,
      verified,
      withList: row.withList,
      withProduct: row.withProduct,
      shared: row.shared,
    };
  }
}
