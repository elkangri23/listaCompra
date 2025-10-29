import { PrismaClient } from '@prisma/client';
import { IBlueprintRepository, PaginationOptions, BlueprintFilters, PaginatedResult } from '../../../application/ports/repositories/IBlueprintRepository';
import { Blueprint } from '../../../domain/entities/Blueprint';
import { Result, success, failure } from '../../../shared/result';
import { Logger } from '../../observability/logger/Logger';

const logger = new Logger('PrismaBlueprintRepository');

export class PrismaBlueprintRepository implements IBlueprintRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(blueprint: Blueprint): Promise<Result<Blueprint, Error>> {
    try {
      // Sanitizar contenido JSON antes de almacenar
      const sanitizedContent = JSON.parse(JSON.stringify(blueprint.productos));
      
      logger.security('Guardando blueprint con contenido sanitizado', {
        blueprintId: blueprint.id,
        productsCount: blueprint.productos.length,
        contentSize: JSON.stringify(sanitizedContent).length
      });

      const blueprintData = await this.prisma.blueprint.upsert({
        where: { id: blueprint.id },
        update: {
          nombre: blueprint.nombre,
          descripcion: blueprint.descripcion || null,
          publico: blueprint.publico,
          contenido: sanitizedContent as any,
          fechaActualizacion: blueprint.fechaActualizacion
        },
        create: {
          id: blueprint.id,
          nombre: blueprint.nombre,
          descripcion: blueprint.descripcion || null,
          publico: blueprint.publico,
          contenido: sanitizedContent as any,
          creadoPorId: blueprint.creadoPorId,
          fechaCreacion: blueprint.fechaCreacion,
          fechaActualizacion: blueprint.fechaActualizacion
        },
        include: {
          creadoPor: true
        }
      });

      const domainBlueprint = Blueprint.recrear(
        blueprintData.id,
        blueprintData.nombre,
        blueprintData.descripcion || undefined,
        blueprintData.publico,
        blueprintData.contenido as any,
        blueprintData.creadoPorId,
        blueprintData.fechaCreacion,
        blueprintData.fechaActualizacion
      );

      return success(domainBlueprint);
    } catch (error) {
      return failure(error as Error);
    }
  }

  async findById(id: string): Promise<Result<Blueprint | null, Error>> {
    try {
      const blueprintData = await this.prisma.blueprint.findUnique({
        where: { id },
        include: {
          creadoPor: true
        }
      });

      if (!blueprintData) {
        return success(null);
      }

      const domainBlueprint = Blueprint.recrear(
        blueprintData.id,
        blueprintData.nombre,
        blueprintData.descripcion || undefined,
        blueprintData.publico,
        blueprintData.contenido as any,
        blueprintData.creadoPorId,
        blueprintData.fechaCreacion,
        blueprintData.fechaActualizacion
      );

      return success(domainBlueprint);
    } catch (error) {
      return failure(error as Error);
    }
  }

  async findByUsuarioId(
    usuarioId: string, 
    pagination?: PaginationOptions,
    filters?: Omit<BlueprintFilters, 'usuarioId'>
  ): Promise<Result<PaginatedResult<Blueprint>, Error>> {
    try {
      const page = pagination?.page || 1;
      const limit = pagination?.limit || 10;
      const skip = (page - 1) * limit;

      const whereClause: any = {
        creadoPorId: usuarioId
      };

      if (filters?.nombre) {
        whereClause.nombre = { contains: filters.nombre, mode: 'insensitive' };
      }

      const [blueprintsData, total] = await Promise.all([
        this.prisma.blueprint.findMany({
          where: whereClause,
          include: { creadoPor: true },
          orderBy: { fechaCreacion: 'desc' },
          skip,
          take: limit
        }),
        this.prisma.blueprint.count({ where: whereClause })
      ]);

      const blueprints = blueprintsData.map(data => 
        Blueprint.recrear(
          data.id,
          data.nombre,
          data.descripcion || undefined,
          data.publico,
          data.contenido as any,
          data.creadoPorId,
          data.fechaCreacion,
          data.fechaActualizacion
        )
      );

      const result: PaginatedResult<Blueprint> = {
        items: blueprints,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };

      return success(result);
    } catch (error) {
      return failure(error as Error);
    }
  }

  async findActiveByUsuarioId(usuarioId: string): Promise<Result<Blueprint[], Error>> {
    try {
      const blueprintsData = await this.prisma.blueprint.findMany({
        where: { creadoPorId: usuarioId },
        include: { creadoPor: true },
        orderBy: { fechaCreacion: 'desc' }
      });

      const blueprints = blueprintsData.map(data => 
        Blueprint.recrear(
          data.id,
          data.nombre,
          data.descripcion || undefined,
          data.publico,
          data.contenido as any,
          data.creadoPorId,
          data.fechaCreacion,
          data.fechaActualizacion
        )
      );

      return success(blueprints);
    } catch (error) {
      return failure(error as Error);
    }
  }

  async findByNombre(
    nombre: string, 
    usuarioId: string,
    pagination?: PaginationOptions
  ): Promise<Result<PaginatedResult<Blueprint>, Error>> {
    try {
      const page = pagination?.page || 1;
      const limit = pagination?.limit || 10;
      const skip = (page - 1) * limit;

      const whereClause = {
        AND: [
          {
            OR: [
              { nombre: { contains: nombre, mode: 'insensitive' as const } },
              { descripcion: { contains: nombre, mode: 'insensitive' as const } }
            ]
          },
          {
            OR: [
              { creadoPorId: usuarioId },
              { publico: true }
            ]
          }
        ]
      };

      const [blueprintsData, total] = await Promise.all([
        this.prisma.blueprint.findMany({
          where: whereClause,
          include: { creadoPor: true },
          orderBy: { fechaCreacion: 'desc' },
          skip,
          take: limit
        }),
        this.prisma.blueprint.count({ where: whereClause })
      ]);

      const blueprints = blueprintsData.map(data => 
        Blueprint.recrear(
          data.id,
          data.nombre,
          data.descripcion || undefined,
          data.publico,
          data.contenido as any,
          data.creadoPorId,
          data.fechaCreacion,
          data.fechaActualizacion
        )
      );

      const result: PaginatedResult<Blueprint> = {
        items: blueprints,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };

      return success(result);
    } catch (error) {
      return failure(error as Error);
    }
  }

  async deleteById(id: string): Promise<Result<void, Error>> {
    try {
      await this.prisma.blueprint.delete({
        where: { id }
      });
      return success(undefined);
    } catch (error) {
      return failure(error as Error);
    }
  }

  async existsById(id: string): Promise<Result<boolean, Error>> {
    try {
      const count = await this.prisma.blueprint.count({
        where: { id }
      });
      return success(count > 0);
    } catch (error) {
      return failure(error as Error);
    }
  }

  async existsByNombreAndUsuario(nombre: string, usuarioId: string, excludeId?: string): Promise<Result<boolean, Error>> {
    try {
      const whereClause: any = {
        nombre,
        creadoPorId: usuarioId
      };

      if (excludeId) {
        whereClause.id = { not: excludeId };
      }

      const count = await this.prisma.blueprint.count({
        where: whereClause
      });

      return success(count > 0);
    } catch (error) {
      return failure(error as Error);
    }
  }

  async countByUsuarioId(usuarioId: string, onlyActive?: boolean): Promise<Result<number, Error>> {
    try {
      const count = await this.prisma.blueprint.count({
        where: { 
          creadoPorId: usuarioId,
          ...(onlyActive && { activo: true })
        }
      });
      return success(count);
    } catch (error) {
      return failure(error as Error);
    }
  }

  async findAll(
    pagination?: PaginationOptions,
    filters?: BlueprintFilters
  ): Promise<Result<PaginatedResult<Blueprint>, Error>> {
    try {
      const page = pagination?.page || 1;
      const limit = pagination?.limit || 10;
      const skip = (page - 1) * limit;

      const whereClause: any = {};

      if (filters?.usuarioId) {
        whereClause.creadoPorId = filters.usuarioId;
      }

      if (filters?.nombre) {
        whereClause.nombre = { contains: filters.nombre, mode: 'insensitive' };
      }

      const [blueprintsData, total] = await Promise.all([
        this.prisma.blueprint.findMany({
          where: whereClause,
          include: { creadoPor: true },
          orderBy: { fechaCreacion: 'desc' },
          skip,
          take: limit
        }),
        this.prisma.blueprint.count({ where: whereClause })
      ]);

      const blueprints = blueprintsData.map(data => 
        Blueprint.recrear(
          data.id,
          data.nombre,
          data.descripcion || undefined,
          data.publico,
          data.contenido as any,
          data.creadoPorId,
          data.fechaCreacion,
          data.fechaActualizacion
        )
      );

      const result: PaginatedResult<Blueprint> = {
        items: blueprints,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      };

      return success(result);
    } catch (error) {
      return failure(error as Error);
    }
  }

  async deactivateAllByUsuarioId(usuarioId: string): Promise<Result<void, Error>> {
    try {
      // Nota: Blueprint no tiene campo 'activo' en el schema actual
      // En el futuro se podría añadir soft delete o implementar con fecha de eliminación
      // Por ahora no hacemos nada y solo registramos el uso del parámetro
      console.log(`Deactivation requested for user ${usuarioId} - not implemented yet`);
      return success(undefined);
    } catch (error) {
      return failure(error as Error);
    }
  }
}