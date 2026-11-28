/**
 * Repositorio en memoria de métricas del panel de administración.
 * Misma semántica que PrismaAdminMetricsRepository, para el entorno de
 * tests (NODE_ENV=test), donde el container usa repos en memoria y no
 * hay PrismaClient. Calcula los agregados a partir de los repositorios
 * en memoria de usuarios, listas, productos, invitaciones y permisos.
 */

import type {
  IAdminMetricsRepository,
  MetricsDayCount,
  MetricsFunnelCounts,
  MetricsMonthCount,
} from '../../../application/ports/repositories/IAdminMetricsRepository';
import type { IUsuarioRepository } from '../../../application/ports/repositories/IUsuarioRepository';
import type { IListaRepository } from '../../../application/ports/repositories/IListaRepository';
import type { IProductoRepository } from '../../../application/ports/repositories/IProductoRepository';
import type { IInvitacionRepository } from '../../../application/ports/repositories/IInvitacionRepository';
import type { IPermisoRepository } from '../../../application/ports/repositories/IPermisoRepository';
import type { Usuario } from '@domain/entities/Usuario';
import type { Lista } from '@domain/entities/Lista';
import type { Producto } from '@domain/entities/Producto';

const PAGE_SIZE = 10000;

function dateKeyUTC(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function monthKeyUTC(d: Date): string {
  return d.toISOString().slice(0, 7);
}

function bucketByDay(dates: Date[], since: Date): MetricsDayCount[] {
  const counts = new Map<string, number>();
  for (const date of dates) {
    if (date < since) {
      continue;
    }
    const key = dateKeyUTC(date);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, count]) => ({ date, count }));
}

function bucketByMonth(dates: Date[], since: Date): MetricsMonthCount[] {
  const counts = new Map<string, number>();
  for (const date of dates) {
    if (date < since) {
      continue;
    }
    const key = monthKeyUTC(date);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([month, count]) => ({ month, count }));
}

export class InMemoryAdminMetricsRepository implements IAdminMetricsRepository {
  constructor(
    private readonly usuarioRepository: IUsuarioRepository,
    private readonly listaRepository: IListaRepository,
    private readonly productoRepository: IProductoRepository,
    private readonly invitacionRepository: IInvitacionRepository,
    private readonly permisoRepository: IPermisoRepository
  ) {}

  private async allUsers(): Promise<Usuario[]> {
    const result = await this.usuarioRepository.findAll({
      page: 1,
      limit: PAGE_SIZE,
    });
    if (result.isFailure) {
      throw result.error;
    }
    return result.value.data;
  }

  private async allLists(): Promise<Lista[]> {
    const users = await this.allUsers();
    const lists: Lista[] = [];
    for (const user of users) {
      const result = await this.listaRepository.findByOwner(
        user.id,
        {},
        { page: 1, limit: PAGE_SIZE }
      );
      if (result.isFailure) {
        throw result.error;
      }
      lists.push(...result.value.items);
    }
    return lists;
  }

  private async allProducts(): Promise<Producto[]> {
    const lists = await this.allLists();
    const products: Producto[] = [];
    for (const list of lists) {
      const result = await this.productoRepository.findByList(
        list.id,
        {},
        { page: 1, limit: PAGE_SIZE }
      );
      if (result.isFailure) {
        throw result.error;
      }
      products.push(...result.value.items);
    }
    return products;
  }

  async countUsers(): Promise<number> {
    return (await this.allUsers()).length;
  }

  async countVerifiedUsers(): Promise<number> {
    return (await this.allUsers()).filter((u) => u.emailVerificado).length;
  }

  async countLists(): Promise<number> {
    return (await this.allLists()).length;
  }

  async countProducts(): Promise<number> {
    return (await this.allProducts()).length;
  }

  async countCategorizedProducts(): Promise<number> {
    return (await this.allProducts()).filter((p) => p.categoriaId !== null)
      .length;
  }

  async registrationsByDay(since: Date): Promise<MetricsDayCount[]> {
    const users = await this.allUsers();
    return bucketByDay(
      users.map((u) => u.fechaCreacion),
      since
    );
  }

  async registrationsByMonth(since: Date): Promise<MetricsMonthCount[]> {
    const users = await this.allUsers();
    return bucketByMonth(
      users.map((u) => u.fechaCreacion),
      since
    );
  }

  async listsByDay(since: Date): Promise<MetricsDayCount[]> {
    const lists = await this.allLists();
    return bucketByDay(
      lists.map((l) => l.fechaCreacion),
      since
    );
  }

  async productsByDay(since: Date): Promise<MetricsDayCount[]> {
    const products = await this.allProducts();
    return bucketByDay(
      products.map((p) => p.fechaCreacion),
      since
    );
  }

  async funnelCounts(): Promise<MetricsFunnelCounts> {
    const users = await this.allUsers();
    const lists = await this.allLists();
    const products = await this.allProducts();

    const ownersWithList = new Set(lists.map((l) => l.propietarioId));
    const creatorsWithProduct = new Set(products.map((p) => p.creadoPorId));

    const sharedOwners = new Set<string>();
    for (const list of lists) {
      const [invitations, permissions] = await Promise.all([
        this.invitacionRepository.findByListaId(list.id),
        this.permisoRepository.findByListaId(list.id),
      ]);
      if (invitations.length > 0 || permissions.length > 0) {
        sharedOwners.add(list.propietarioId);
      }
    }

    return {
      registered: users.length,
      verified: users.filter((u) => u.emailVerificado).length,
      withList: ownersWithList.size,
      withProduct: creatorsWithProduct.size,
      shared: sharedOwners.size,
    };
  }
}
