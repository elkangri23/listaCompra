/**
 * Tests unitarios para PrismaAdminMetricsRepository (fase 7).
 * Mockea el PrismaClient, como el resto de repositorios Prisma: el
 * delegado `aIUsageEvent` no interviene aquí (el uso de IA lo lee el
 * caso de uso desde IAIUsageEventRepository), pero las series por día
 * usan `$queryRaw` con `to_char(... AT TIME ZONE 'UTC', ...)` porque
 * `groupBy` de Prisma agrupa por el timestamp exacto, no por día.
 */

import { PrismaAdminMetricsRepository } from '../../../../../src/infrastructure/persistence/repositories/PrismaAdminMetricsRepository';

describe('PrismaAdminMetricsRepository', () => {
  let prisma: any;
  let queryRaw: jest.Mock;
  let repo: PrismaAdminMetricsRepository;

  beforeEach(() => {
    queryRaw = jest.fn(async (strings: TemplateStringsArray) => {
      const sql = strings.join('?');
      if (sql.includes('FROM listas l')) {
        return [{ withList: 3, withProduct: 2, shared: 1 }];
      }
      return [{ date: '2026-11-28', count: 2 }];
    });
    prisma = {
      $queryRaw: queryRaw,
      usuario: { count: jest.fn().mockResolvedValue(4) },
      lista: { count: jest.fn().mockResolvedValue(5) },
      producto: { count: jest.fn().mockResolvedValue(10) },
    };
    repo = new PrismaAdminMetricsRepository(prisma);
  });

  it('countUsers y countVerifiedUsers usan el delegado usuario con el filtro correcto', async () => {
    expect(await repo.countUsers()).toBe(4);
    expect(prisma.usuario.count).toHaveBeenCalledWith();
    expect(await repo.countVerifiedUsers()).toBe(4);
    expect(prisma.usuario.count).toHaveBeenCalledWith({
      where: { emailVerificado: true },
    });
  });

  it('countLists, countProducts y countCategorizedProducts usan sus delegados', async () => {
    expect(await repo.countLists()).toBe(5);
    expect(prisma.lista.count).toHaveBeenCalledWith();
    expect(await repo.countProducts()).toBe(10);
    expect(await repo.countCategorizedProducts()).toBe(10);
    expect(prisma.producto.count).toHaveBeenCalledWith({
      where: { categoriaId: { not: null } },
    });
  });

  it('registrationsByDay agrupa por día UTC y pasa el since como parámetro', async () => {
    const since = new Date('2026-10-30T00:00:00.000Z');
    const rows = await repo.registrationsByDay(since);

    expect(rows).toEqual([{ date: '2026-11-28', count: 2 }]);
    const strings = queryRaw.mock.calls[0]?.[0] as TemplateStringsArray;
    const sql = strings.join('?');
    expect(sql).toContain('FROM usuarios');
    expect(sql).toContain('YYYY-MM-DD');
    expect(sql).toContain('AT TIME ZONE');
    expect(queryRaw.mock.calls[0]?.[1]).toBe(since);
  });

  it('registrationsByMonth agrupa por mes UTC', async () => {
    const rows = await repo.registrationsByMonth(
      new Date('2025-12-01T00:00:00.000Z')
    );

    expect(rows).toEqual([{ date: '2026-11-28', count: 2 }]);
    const strings = queryRaw.mock.calls[0]?.[0] as TemplateStringsArray;
    expect(strings.join('?')).toContain('YYYY-MM');
  });

  it('listsByDay y productsByDay consultan sus tablas', async () => {
    await repo.listsByDay(new Date('2026-10-30T00:00:00.000Z'));
    const listsSql = (queryRaw.mock.calls[0]?.[0] as TemplateStringsArray).join('?');
    expect(listsSql).toContain('FROM listas');

    await repo.productsByDay(new Date('2026-10-30T00:00:00.000Z'));
    const productsSql = (queryRaw.mock.calls[1]?.[0] as TemplateStringsArray).join('?');
    expect(productsSql).toContain('FROM productos');
  });

  it('funnelCounts combina los DISTINCT y los totales de usuarios', async () => {
    const funnel = await repo.funnelCounts();

    expect(funnel).toEqual({
      registered: 4,
      verified: 4,
      withList: 3,
      withProduct: 2,
      shared: 1,
    });
    const strings = queryRaw.mock.calls[0]?.[0] as TemplateStringsArray;
    const sql = strings.join('?');
    expect(sql).toContain('COUNT(DISTINCT "propietarioId")');
    expect(sql).toContain('COUNT(DISTINCT "creadoPorId")');
    expect(sql).toContain('invitaciones');
    expect(sql).toContain('permisos');
  });

  it('funnelCounts sin listas devuelve ceros en los tramos de listas/productos', async () => {
    queryRaw.mockResolvedValueOnce([]);
    const funnel = await repo.funnelCounts();

    expect(funnel).toEqual({
      registered: 4,
      verified: 4,
      withList: 0,
      withProduct: 0,
      shared: 0,
    });
  });
});
