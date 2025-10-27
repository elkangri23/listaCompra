/**
 * Implementación del repositorio de tiendas usando Prisma
 */

import type { PrismaClient } from '@prisma/client';
import type { Result } from '@shared/result';
import { success, failure } from '@shared/result';
import { InvalidValueError, BusinessRuleViolationError } from '@domain/errors/DomainError';
import type { Tienda } from '@domain/entities/Tienda';
import type { Categoria } from '@domain/entities/Categoria';
import type { ITiendaRepository } from '@application/ports/repositories/ITiendaRepository';
import { TiendaMapper } from '../mappers/TiendaMapper';
import { CategoriaMapper } from '../mappers/CategoriaMapper';

export class PrismaTiendaRepository implements ITiendaRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(tienda: Tienda): Promise<Result<Tienda, InvalidValueError | BusinessRuleViolationError>> {
    try {
      const data = TiendaMapper.toPrismaCreate(tienda);
      const created = await this.prisma.tienda.create({
        data,
      });

      return success(TiendaMapper.toDomain(created));
    } catch (error) {
      return failure(new InvalidValueError(
        'Error al guardar la tienda',
        'database',
        error
      ));
    }
  }

  async update(tienda: Tienda): Promise<Result<Tienda, InvalidValueError | BusinessRuleViolationError>> {
    try {
      const data = TiendaMapper.toPrismaUpdate(tienda);
      const updated = await this.prisma.tienda.update({
        where: { id: tienda.id },
        data,
      });

      return success(TiendaMapper.toDomain(updated));
    } catch (error) {
      return failure(new InvalidValueError(
        'Error al actualizar la tienda',
        'database',
        error
      ));
    }
  }

  async findById(id: string): Promise<Result<Tienda | null, InvalidValueError>> {
    try {
      const tienda = await this.prisma.tienda.findUnique({
        where: { id },
      });

      if (!tienda) {
        return success(null);
      }

      return success(TiendaMapper.toDomain(tienda));
    } catch (error) {
      return failure(new InvalidValueError(
        'Error al buscar la tienda por ID',
        'id',
        id
      ));
    }
  }

  async findByNombre(nombre: string): Promise<Result<Tienda | null, InvalidValueError>> {
    try {
      const tienda = await this.prisma.tienda.findUnique({
        where: { nombre },
      });

      if (!tienda) {
        return success(null);
      }

      return success(TiendaMapper.toDomain(tienda));
    } catch (error) {
      return failure(new InvalidValueError(
        'Error al buscar la tienda por nombre',
        'nombre',
        nombre
      ));
    }
  }

  async findAll(includeInactive = false): Promise<Result<Tienda[], InvalidValueError>> {
    try {
      const where = includeInactive ? {} : { activa: true };

      const tiendas = await this.prisma.tienda.findMany({
        where,
        orderBy: TiendaMapper.toPrismaOrderBy(),
      });

      return success(TiendaMapper.toDomainArray(tiendas));
    } catch (error) {
      return failure(new InvalidValueError(
        'Error al buscar todas las tiendas',
        'query',
        'findAll'
      ));
    }
  }

  async existsByNombre(nombre: string, excludeId?: string): Promise<Result<boolean, InvalidValueError>> {
    try {
      const where: any = { nombre };

      if (excludeId) {
        where.id = {
          not: excludeId,
        };
      }

      const count = await this.prisma.tienda.count({
        where,
      });

      return success(count > 0);
    } catch (error) {
      return failure(new InvalidValueError(
        'Error al verificar existencia de tienda',
        'nombre',
        nombre
      ));
    }
  }

  async delete(id: string): Promise<Result<boolean, InvalidValueError | BusinessRuleViolationError>> {
    try {
      await this.prisma.tienda.delete({
        where: { id },
      });

      return success(true);
    } catch (error: any) {
      if (error.code === 'P2025') {
        return failure(new InvalidValueError(
          'La tienda no existe',
          'id',
          id
        ));
      }

      if (error.code === 'P2003') {
        return failure(new BusinessRuleViolationError(
          'No se puede eliminar la tienda porque tiene categorías asociadas',
          'TIENDA_CON_CATEGORIAS'
        ));
      }

      return failure(new InvalidValueError(
        'Error al eliminar la tienda',
        'database',
        error
      ));
    }
  }

  async search(filters: {
    query?: string;
    activa?: boolean;
    hasWebsite?: boolean;
    hasPhysicalLocation?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<Result<{ tiendas: Tienda[]; total: number; }, InvalidValueError>> {
    try {
      const where = TiendaMapper.toPrismaWhereInput(filters);

      const queryOptions: any = {
        where,
        orderBy: TiendaMapper.toPrismaOrderBy(),
      };

      if (filters.limit) {
        queryOptions.take = filters.limit;
      }

      if (filters.offset) {
        queryOptions.skip = filters.offset;
      }

      const [tiendas, total] = await Promise.all([
        this.prisma.tienda.findMany(queryOptions),
        this.prisma.tienda.count({ where }),
      ]);

      return success({
        tiendas: TiendaMapper.toDomainArray(tiendas),
        total,
      });
    } catch (error) {
      return failure(new InvalidValueError(
        'Error en la búsqueda de tiendas',
        'search',
        filters
      ));
    }
  }

  async findByIdWithCategories(id: string, includeInactiveCategories = false): Promise<Result<{
    tienda: Tienda;
    categorias: Categoria[];
  } | null, InvalidValueError>> {
    try {
      const result = await this.prisma.tienda.findUnique({
        where: { id },
        include: {
          categorias: {
            where: includeInactiveCategories ? {} : { activa: true },
            orderBy: { nombre: 'asc' },
          },
        },
      });

      if (!result) {
        return success(null);
      }

      return success({
        tienda: TiendaMapper.toDomain(result),
        categorias: CategoriaMapper.toDomainArray(result.categorias),
      });
    } catch (error) {
      return failure(new InvalidValueError(
        'Error al buscar tienda con categorías',
        'id',
        id
      ));
    }
  }

  async findAllWithCategories(includeInactive = false): Promise<Result<Array<{
    tienda: Tienda;
    categorias: Categoria[];
  }>, InvalidValueError>> {
    try {
      const where = includeInactive ? {} : { activa: true };

      const results = await this.prisma.tienda.findMany({
        where,
        include: {
          categorias: {
            where: includeInactive ? {} : { activa: true },
            orderBy: { nombre: 'asc' },
          },
        },
        orderBy: TiendaMapper.toPrismaOrderBy(),
      });

      return success(
        results.map(result => ({
          tienda: TiendaMapper.toDomain(result),
          categorias: CategoriaMapper.toDomainArray(result.categorias),
        }))
      );
    } catch (error) {
      return failure(new InvalidValueError(
        'Error al buscar tiendas con categorías',
        'query',
        'findAllWithCategories'
      ));
    }
  }

  async countCategorias(tiendaId: string, onlyActive = true): Promise<Result<number, InvalidValueError>> {
    try {
      const where: any = { tiendaId };
      
      if (onlyActive) {
        where.activa = true;
      }

      const count = await this.prisma.categoria.count({
        where,
      });

      return success(count);
    } catch (error) {
      return failure(new InvalidValueError(
        'Error al contar categorías de la tienda',
        'tiendaId',
        tiendaId
      ));
    }
  }

  async hasCategories(tiendaId: string): Promise<Result<boolean, InvalidValueError>> {
    try {
      const count = await this.prisma.categoria.count({
        where: { tiendaId },
      });

      return success(count > 0);
    } catch (error) {
      return failure(new InvalidValueError(
        'Error al verificar si la tienda tiene categorías',
        'tiendaId',
        tiendaId
      ));
    }
  }

  async getStats(tiendaId: string): Promise<Result<{
    totalCategorias: number;
    categoriasActivas: number;
    categoriasInactivas: number;
    fechaUltimaCategoria?: Date;
  }, InvalidValueError>> {
    try {
      const [total, activas, ultimaCategoria] = await Promise.all([
        this.prisma.categoria.count({
          where: { tiendaId },
        }),
        this.prisma.categoria.count({
          where: { tiendaId, activa: true },
        }),
        this.prisma.categoria.findFirst({
          where: { tiendaId },
          orderBy: { fechaCreacion: 'desc' },
          select: { fechaCreacion: true },
        }),
      ]);

      const inactivas = total - activas;

      const result = {
        totalCategorias: total,
        categoriasActivas: activas,
        categoriasInactivas: inactivas,
        ...(ultimaCategoria?.fechaCreacion && { fechaUltimaCategoria: ultimaCategoria.fechaCreacion }),
      };

      return success(result);
    } catch (error) {
      return failure(new InvalidValueError(
        'Error al obtener estadísticas de la tienda',
        'tiendaId',
        tiendaId
      ));
    }
  }

  async getAllStats(): Promise<Result<Array<{
    tienda: Tienda;
    totalCategorias: number;
    categoriasActivas: number;
    categoriasInactivas: number;
    fechaUltimaCategoria?: Date;
  }>, InvalidValueError>> {
    try {
      const tiendas = await this.prisma.tienda.findMany({
        include: {
          categorias: {
            select: {
              activa: true,
              fechaCreacion: true,
            },
            orderBy: {
              fechaCreacion: 'desc',
            },
          },
        },
        orderBy: TiendaMapper.toPrismaOrderBy(),
      });

      const stats = tiendas.map(tienda => {
        const totalCategorias = tienda.categorias.length;
        const categoriasActivas = tienda.categorias.filter(cat => cat.activa).length;
        const categoriasInactivas = totalCategorias - categoriasActivas;
        const fechaUltimaCategoria = tienda.categorias[0]?.fechaCreacion;

        const result: any = {
          tienda: TiendaMapper.toDomain(tienda),
          totalCategorias,
          categoriasActivas,
          categoriasInactivas,
        };

        if (fechaUltimaCategoria) {
          result.fechaUltimaCategoria = fechaUltimaCategoria;
        }

        return result;
      });

      return success(stats);
    } catch (error) {
      return failure(new InvalidValueError(
        'Error al obtener estadísticas de todas las tiendas',
        'query',
        'getAllStats'
      ));
    }
  }

  async getMostUsed(limit = 10): Promise<Result<Array<{
    tienda: Tienda;
    totalCategorias: number;
  }>, InvalidValueError>> {
    try {
      const tiendas = await this.prisma.tienda.findMany({
        include: {
          _count: {
            select: {
              categorias: true,
            },
          },
        },
        orderBy: {
          categorias: {
            _count: 'desc',
          },
        },
        take: limit,
      });

      const results = tiendas.map(tienda => ({
        tienda: TiendaMapper.toDomain(tienda),
        totalCategorias: tienda._count.categorias,
      }));

      return success(results);
    } catch (error) {
      return failure(new InvalidValueError(
        'Error al obtener tiendas más utilizadas',
        'getMostUsed',
        limit
      ));
    }
  }

  async deactivateWithCategories(tiendaId: string): Promise<Result<{
    tienda: Tienda;
    categoriasDesactivadas: number;
  }, InvalidValueError | BusinessRuleViolationError>> {
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        // Desactivar la tienda
        const tiendaUpdated = await tx.tienda.update({
          where: { id: tiendaId },
          data: { 
            activa: false,
            fechaActualizacion: new Date(),
          },
        });

        // Desactivar todas las categorías de la tienda
        const categoriasResult = await tx.categoria.updateMany({
          where: { tiendaId },
          data: { 
            activa: false,
            fechaActualizacion: new Date(),
          },
        });

        return {
          tienda: TiendaMapper.toDomain(tiendaUpdated),
          categoriasDesactivadas: categoriasResult.count,
        };
      });

      return success(result);
    } catch (error: any) {
      if (error.code === 'P2025') {
        return failure(new InvalidValueError(
          'La tienda no existe',
          'tiendaId',
          tiendaId
        ));
      }

      return failure(new InvalidValueError(
        'Error al desactivar tienda y categorías',
        'database',
        error
      ));
    }
  }

  async activate(tiendaId: string): Promise<Result<Tienda, InvalidValueError | BusinessRuleViolationError>> {
    try {
      const updated = await this.prisma.tienda.update({
        where: { id: tiendaId },
        data: { 
          activa: true,
          fechaActualizacion: new Date(),
        },
      });

      return success(TiendaMapper.toDomain(updated));
    } catch (error: any) {
      if (error.code === 'P2025') {
        return failure(new InvalidValueError(
          'La tienda no existe',
          'tiendaId',
          tiendaId
        ));
      }

      return failure(new InvalidValueError(
        'Error al activar la tienda',
        'database',
        error
      ));
    }
  }
}