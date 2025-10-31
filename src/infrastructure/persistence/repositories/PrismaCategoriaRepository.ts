/**
 * Implementación del repositorio de categorías usando Prisma
 */

import type { PrismaClient } from '@prisma/client';
import type { Result } from '@shared/result';
import { success, failure } from '@shared/result';
import { InvalidValueError, BusinessRuleViolationError } from '@domain/errors/DomainError';
import type { Categoria } from '@domain/entities/Categoria';
import type { ICategoriaRepository } from '@application/ports/repositories/ICategoriaRepository';
import { CategoriaMapper } from '../mappers/CategoriaMapper';

export class PrismaCategoriaRepository implements ICategoriaRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(categoria: Categoria): Promise<Result<Categoria, InvalidValueError | BusinessRuleViolationError>> {
    try {
      const data = CategoriaMapper.toPrismaCreate(categoria);
      const created = await this.prisma.categoria.create({
        data,
      });

      return success(CategoriaMapper.toDomain(created));
    } catch (error) {
      return failure(new InvalidValueError(
        'Error al guardar la categoría',
        'database',
        error
      ));
    }
  }

  async update(categoria: Categoria): Promise<Result<Categoria, InvalidValueError | BusinessRuleViolationError>> {
    try {
      const data = CategoriaMapper.toPrismaUpdate(categoria);
      const updated = await this.prisma.categoria.update({
        where: { id: categoria.id },
        data,
      });

      return success(CategoriaMapper.toDomain(updated));
    } catch (error) {
      return failure(new InvalidValueError(
        'Error al actualizar la categoría',
        'database',
        error
      ));
    }
  }

  async findById(id: string): Promise<Result<Categoria | null, InvalidValueError>> {
    try {
      const categoria = await this.prisma.categoria.findUnique({
        where: { id },
      });

      if (!categoria) {
        return success(null);
      }

      return success(CategoriaMapper.toDomain(categoria));
    } catch (error) {
      return failure(new InvalidValueError(
        'Error al buscar la categoría por ID',
        'id',
        id
      ));
    }
  }

  async findByTienda(tiendaId: string | null, includeInactive = false): Promise<Result<Categoria[], InvalidValueError>> {
    try {
      const where = CategoriaMapper.toPrismaWhereInput({
        tiendaId,
        ...(includeInactive ? {} : { activa: true }),
      });

      const categorias = await this.prisma.categoria.findMany({
        where,
        orderBy: CategoriaMapper.toPrismaOrderBy(),
      });

      return success(CategoriaMapper.toDomainArray(categorias));
    } catch (error) {
      return failure(new InvalidValueError(
        'Error al buscar categorías por tienda',
        'tiendaId',
        tiendaId
      ));
    }
  }

  async findAll(includeInactive = false): Promise<Result<Categoria[], InvalidValueError>> {
    try {
      const where = includeInactive ? {} : { activa: true };

      const categorias = await this.prisma.categoria.findMany({
        where,
        orderBy: CategoriaMapper.toPrismaOrderBy(),
      });

      return success(CategoriaMapper.toDomainArray(categorias));
    } catch (error) {
      return failure(new InvalidValueError(
        'Error al buscar todas las categorías',
        'query',
        'findAll'
      ));
    }
  }

  async findByNombre(nombre: string, tiendaId?: string | null): Promise<Result<Categoria[], InvalidValueError>> {
    try {
      const where = CategoriaMapper.toPrismaWhereInput({
        nombre,
        ...(tiendaId !== undefined && { tiendaId }),
      });

      const categorias = await this.prisma.categoria.findMany({
        where,
        orderBy: CategoriaMapper.toPrismaOrderBy(),
      });

      return success(CategoriaMapper.toDomainArray(categorias));
    } catch (error) {
      return failure(new InvalidValueError(
        'Error al buscar categorías por nombre',
        'nombre',
        nombre
      ));
    }
  }

  async findByColor(color: string, tiendaId?: string | null): Promise<Result<Categoria[], InvalidValueError>> {
    try {
      const where = CategoriaMapper.toPrismaWhereInput({
        color,
        ...(tiendaId !== undefined && { tiendaId }),
      });

      const categorias = await this.prisma.categoria.findMany({
        where,
        orderBy: CategoriaMapper.toPrismaOrderBy(),
      });

      return success(CategoriaMapper.toDomainArray(categorias));
    } catch (error) {
      return failure(new InvalidValueError(
        'Error al buscar categorías por color',
        'color',
        color
      ));
    }
  }

  async existsByNombreAndTienda(nombre: string, tiendaId: string | null, excludeId?: string): Promise<Result<boolean, InvalidValueError>> {
    try {
      const where: any = {
        nombre,
        tiendaId,
      };

      if (excludeId) {
        where.id = {
          not: excludeId,
        };
      }

      const count = await this.prisma.categoria.count({
        where,
      });

      return success(count > 0);
    } catch (error) {
      return failure(new InvalidValueError(
        'Error al verificar existencia de categoría',
        'nombre',
        nombre
      ));
    }
  }

  async delete(id: string): Promise<Result<boolean, InvalidValueError | BusinessRuleViolationError>> {
    try {
      await this.prisma.categoria.delete({
        where: { id },
      });

      return success(true);
    } catch (error: any) {
      if (error.code === 'P2025') {
        return failure(new InvalidValueError(
          'La categoría no existe',
          'id',
          id
        ));
      }

      return failure(new InvalidValueError(
        'Error al eliminar la categoría',
        'database',
        error
      ));
    }
  }

  async countByTienda(tiendaId: string | null): Promise<Result<number, InvalidValueError>> {
    try {
      const count = await this.prisma.categoria.count({
        where: { tiendaId },
      });

      return success(count);
    } catch (error) {
      return failure(new InvalidValueError(
        'Error al contar categorías por tienda',
        'tiendaId',
        tiendaId
      ));
    }
  }

  async search(filters: {
    query?: string;
    tiendaId?: string | null;
    color?: string;
    activa?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<Result<{ categorias: Categoria[]; total: number; }, InvalidValueError>> {
    try {
      const where = CategoriaMapper.toPrismaWhereInput({
        ...(filters.query && { nombre: filters.query }),
        ...(filters.tiendaId !== undefined && { tiendaId: filters.tiendaId }),
        ...(filters.color && { color: filters.color }),
        ...(filters.activa !== undefined && { activa: filters.activa }),
      });

      const queryOptions: any = {
        where,
        orderBy: CategoriaMapper.toPrismaOrderBy(),
      };

      if (filters.limit) {
        queryOptions.take = filters.limit;
      }

      if (filters.offset) {
        queryOptions.skip = filters.offset;
      }

      const [categorias, total] = await Promise.all([
        this.prisma.categoria.findMany(queryOptions),
        this.prisma.categoria.count({ where }),
      ]);

      return success({
        categorias: CategoriaMapper.toDomainArray(categorias),
        total,
      });
    } catch (error) {
      return failure(new InvalidValueError(
        'Error en la búsqueda de categorías',
        'search',
        filters
      ));
    }
  }

  async getMostUsed(limit = 10, tiendaId?: string | null): Promise<Result<Categoria[], InvalidValueError>> {
    try {
      const where = tiendaId !== undefined ? { tiendaId } : {};
      
      const categorias = await this.prisma.categoria.findMany({
        where,
        include: {
          _count: {
            select: {
              productos: true,
            },
          },
        },
        orderBy: {
          productos: {
            _count: 'desc',
          },
        },
        take: limit,
      });

      return success(CategoriaMapper.toDomainArray(categorias));
    } catch (error) {
      return failure(new InvalidValueError(
        'Error al obtener categorías más utilizadas',
        'getMostUsed',
        { limit, tiendaId }
      ));
    }
  }

  async moveToTienda(categoriaId: string, newTiendaId: string | null): Promise<Result<Categoria, InvalidValueError | BusinessRuleViolationError>> {
    try {
      const updated = await this.prisma.categoria.update({
        where: { id: categoriaId },
        data: { 
          tiendaId: newTiendaId,
          fechaActualizacion: new Date(),
        },
      });

      return success(CategoriaMapper.toDomain(updated));
    } catch (error: any) {
      if (error.code === 'P2025') {
        return failure(new InvalidValueError(
          'La categoría no existe',
          'categoriaId',
          categoriaId
        ));
      }

      return failure(new InvalidValueError(
        'Error al mover categoría a tienda',
        'database',
        error
      ));
    }
  }

  async deactivateByTienda(tiendaId: string): Promise<Result<number, InvalidValueError>> {
    try {
      const result = await this.prisma.categoria.updateMany({
        where: { tiendaId },
        data: { 
          activa: false,
          fechaActualizacion: new Date(),
        },
      });

      return success(result.count);
    } catch (error) {
      return failure(new InvalidValueError(
        'Error al desactivar categorías de la tienda',
        'tiendaId',
        tiendaId
      ));
    }
  }

  async getStats(tiendaId?: string | null): Promise<Result<{
    total: number;
    activas: number;
    inactivas: number;
    porColor: Record<string, number>;
  }, InvalidValueError>> {
    try {
      const where = tiendaId !== undefined ? { tiendaId } : {};

      const [total, activas, categorias] = await Promise.all([
        this.prisma.categoria.count({ where }),
        this.prisma.categoria.count({ where: { ...where, activa: true } }),
        this.prisma.categoria.findMany({
          where,
          select: { color: true },
        }),
      ]);

      const inactivas = total - activas;
      
      const porColor: Record<string, number> = {};
      categorias.forEach(cat => {
        if (cat.color) {
          porColor[cat.color] = (porColor[cat.color] || 0) + 1;
        }
      });

      return success({
        total,
        activas,
        inactivas,
        porColor,
      });
    } catch (error) {
      return failure(new InvalidValueError(
        'Error al obtener estadísticas de categorías',
        'getStats',
        tiendaId
      ));
    }
  }
}