/**
 * Implementación del repositorio de listas usando Prisma
 */

import type { PrismaClient } from '@prisma/client';
import type { Result } from '@shared/result';
import { success, failure } from '@shared/result';
import type { IListaRepository, ListaFilters, PaginationOptions, PaginatedResult } from '@application/ports/repositories/IListaRepository';
import { Lista } from '@domain/entities/Lista';
import { ListaMapper } from '@infrastructure/persistence/mappers/ListaMapper';

export class PrismaListaRepository implements IListaRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(lista: Lista): Promise<Result<Lista, Error>> {
    try {
      const listaData = ListaMapper.toPersistence(lista);
      
      const savedLista = await this.prisma.lista.upsert({
        where: { id: listaData['id'] },
        update: {
          nombre: listaData['nombre'],
          descripcion: listaData['descripcion'],
          activa: listaData['activa'],
          fechaActualizacion: listaData['fechaActualizacion'],
        },
        create: {
          id: listaData['id'],
          nombre: listaData['nombre'],
          descripcion: listaData['descripcion'],
          propietarioId: listaData['propietarioId'],
          activa: listaData['activa'],
          fechaCreacion: listaData['fechaCreacion'],
          fechaActualizacion: listaData['fechaActualizacion'],
        },
      });

      const listaResult = ListaMapper.toDomain(savedLista);
      if (listaResult.isFailure) {
        return failure(listaResult.error);
      }

      return success(listaResult.value);
    } catch (error) {
      return failure(new Error(`Error al guardar lista: ${error instanceof Error ? error.message : 'Error desconocido'}`));
    }
  }

  async findById(id: string): Promise<Result<Lista | null, Error>> {
    try {
      const lista = await this.prisma.lista.findUnique({
        where: { id },
      });

      if (!lista) {
        return success(null);
      }

      const listaResult = ListaMapper.toDomain(lista);
      if (listaResult.isFailure) {
        return failure(listaResult.error);
      }

      return success(listaResult.value);
    } catch (error) {
      return failure(new Error(`Error al buscar lista por ID: ${error instanceof Error ? error.message : 'Error desconocido'}`));
    }
  }

  async findByIdAndOwner(id: string, propietarioId: string): Promise<Result<Lista | null, Error>> {
    try {
    const lista = await this.prisma.lista.findFirst({
        where: { 
          id,
          propietarioId: propietarioId
        },
      });

      if (!lista) {
        return success(null);
      }

      const listaResult = ListaMapper.toDomain(lista);
      if (listaResult.isFailure) {
        return failure(listaResult.error);
      }

      return success(listaResult.value);
    } catch (error) {
      return failure(new Error(`Error al buscar lista por ID y propietario: ${error instanceof Error ? error.message : 'Error desconocido'}`));
    }
  }

  async findByOwner(
    propietarioId: string, 
    filters?: ListaFilters,
    pagination?: PaginationOptions
  ): Promise<Result<PaginatedResult<Lista>, Error>> {
    try {
      // Construir condiciones de filtrado
      const where: any = {
        propietarioId: propietarioId,
      };

      if (filters) {
        if (filters.activa !== undefined) {
          where.activa = filters.activa;
        }
        if (filters.tiendaId) {
          // Nota: tiendaId no está en el schema actual, pero lo mantenemos para futura implementación
          // where.tiendaId = filters.tiendaId;
        }
      }

      // Configurar paginación
      const page = pagination?.page || 1;
      const limit = Math.min(pagination?.limit || 10, 100); // Máximo 100 elementos
      const skip = (page - 1) * limit;

      // Obtener listas y total
      const [listas, total] = await Promise.all([
        this.prisma.lista.findMany({
          where,
          orderBy: {
            fechaActualizacion: 'desc',
          },
          skip,
          take: limit,
        }),
        this.prisma.lista.count({ where }),
      ]);

      // Mapear a entidades de dominio
      const listasDomain: Lista[] = [];
      for (const lista of listas) {
        const listaResult = ListaMapper.toDomain(lista);
        if (listaResult.isFailure) {
          return failure(listaResult.error);
        }
        listasDomain.push(listaResult.value);
      }

      const totalPages = Math.ceil(total / limit);

      const result: PaginatedResult<Lista> = {
        items: listasDomain,
        total,
        page,
        limit,
        totalPages,
      };

      return success(result);
    } catch (error) {
      return failure(new Error(`Error al buscar listas del propietario: ${error instanceof Error ? error.message : 'Error desconocido'}`));
    }
  }

  async findByNameAndOwner(nombre: string, propietarioId: string): Promise<Result<Lista | null, Error>> {
    try {
      const lista = await this.prisma.lista.findFirst({
        where: { 
          nombre,
          propietarioId: propietarioId
        },
      });

      if (!lista) {
        return success(null);
      }

      const listaResult = ListaMapper.toDomain(lista);
      if (listaResult.isFailure) {
        return failure(listaResult.error);
      }

      return success(listaResult.value);
    } catch (error) {
      return failure(new Error(`Error al buscar lista por nombre y propietario: ${error instanceof Error ? error.message : 'Error desconocido'}`));
    }
  }

  async deleteById(id: string): Promise<Result<void, Error>> {
    try {
      // Soft delete - marcar como inactiva
      await this.prisma.lista.update({
        where: { id },
        data: { 
          activa: false,
          fechaActualizacion: new Date(),
        },
      });

      return success(undefined);
    } catch (error) {
      return failure(new Error(`Error al eliminar lista: ${error instanceof Error ? error.message : 'Error desconocido'}`));
    }
  }

  async hardDelete(id: string): Promise<Result<boolean, Error>> {
    try {
      const result = await this.prisma.lista.delete({
        where: { id },
      });

      return success(!!result);
    } catch (error) {
      return failure(new Error(`Error al eliminar lista permanentemente: ${error instanceof Error ? error.message : 'Error desconocido'}`));
    }
  }

  async existsById(id: string): Promise<Result<boolean, Error>> {
    try {
      const count = await this.prisma.lista.count({
        where: { id },
      });

      return success(count > 0);
    } catch (error) {
      return failure(new Error(`Error al verificar existencia de lista: ${error instanceof Error ? error.message : 'Error desconocido'}`));
    }
  }

  async existsByNameAndOwner(nombre: string, propietarioId: string): Promise<Result<boolean, Error>> {
    try {
      const count = await this.prisma.lista.count({
        where: { 
          nombre,
          propietarioId: propietarioId
        },
      });

      return success(count > 0);
    } catch (error) {
      return failure(new Error(`Error al verificar existencia de lista por nombre: ${error instanceof Error ? error.message : 'Error desconocido'}`));
    }
  }

  async countByOwner(propietarioId: string): Promise<Result<number, Error>> {
    try {
      const count = await this.prisma.lista.count({
        where: { 
          propietarioId: propietarioId,
          activa: true // Solo contar listas activas
        },
      });

      return success(count);
    } catch (error) {
      return failure(new Error(`Error al contar listas del propietario: ${error instanceof Error ? error.message : 'Error desconocido'}`));
    }
  }

  async updateActiveStatus(id: string, activa: boolean): Promise<Result<void, Error>> {
    try {
      await this.prisma.lista.update({
        where: { id },
        data: { 
          activa,
          fechaActualizacion: new Date(),
        },
      });

      return success(undefined);
    } catch (error) {
      return failure(new Error(`Error al actualizar estado de lista: ${error instanceof Error ? error.message : 'Error desconocido'}`));
    }
  }
}