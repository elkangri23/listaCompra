/**
 * Mapper para convertir entre la entidad Tienda y el modelo de Prisma
 */

import type { Tienda as PrismaTienda } from '@prisma/client';
import { Tienda, type TiendaProps } from '@domain/entities/Tienda';

export class TiendaMapper {
  /**
   * Convierte desde el modelo de Prisma a la entidad de dominio
   */
  static toDomain(prismaTienda: PrismaTienda): Tienda {
    const props: TiendaProps & { id: string } = {
      id: prismaTienda.id,
      nombre: prismaTienda.nombre,
      activa: prismaTienda.activa,
      fechaCreacion: prismaTienda.fechaCreacion,
      fechaActualizacion: prismaTienda.fechaActualizacion,
      ...(prismaTienda.direccion && { direccion: prismaTienda.direccion }),
      ...(prismaTienda.telefono && { telefono: prismaTienda.telefono }),
      ...(prismaTienda.sitioWeb && { sitioWeb: prismaTienda.sitioWeb }),
    };

    return Tienda.fromPersistence(props);
  }

  /**
   * Convierte desde la entidad de dominio al modelo de Prisma para crear
   */
  static toPrismaCreate(tienda: Tienda): Omit<PrismaTienda, 'id' | 'fechaCreacion' | 'fechaActualizacion'> {
    return {
      nombre: tienda.nombre,
      direccion: tienda.direccion,
      telefono: tienda.telefono,
      sitioWeb: tienda.sitioWeb,
      activa: tienda.activa,
    };
  }

  /**
   * Convierte desde la entidad de dominio al modelo de Prisma para actualizar
   */
  static toPrismaUpdate(tienda: Tienda): Omit<PrismaTienda, 'id' | 'fechaCreacion'> {
    return {
      nombre: tienda.nombre,
      direccion: tienda.direccion,
      telefono: tienda.telefono,
      sitioWeb: tienda.sitioWeb,
      activa: tienda.activa,
      fechaActualizacion: tienda.fechaActualizacion,
    };
  }

  /**
   * Convierte múltiples registros de Prisma a entidades de dominio
   */
  static toDomainArray(prismaTiendas: PrismaTienda[]): Tienda[] {
    return prismaTiendas.map(this.toDomain);
  }

  /**
   * Extrae solo los campos necesarios para las operaciones de filtrado
   */
  static toPrismaWhereInput(filters: {
    id?: string;
    nombre?: string;
    activa?: boolean;
    hasWebsite?: boolean;
    hasPhysicalLocation?: boolean;
    query?: string;
  }) {
    const where: any = {};

    if (filters.id) {
      where.id = filters.id;
    }

    if (filters.nombre) {
      where.nombre = {
        contains: filters.nombre,
        mode: 'insensitive',
      };
    }

    if (filters.activa !== undefined) {
      where.activa = filters.activa;
    }

    if (filters.hasWebsite !== undefined) {
      if (filters.hasWebsite) {
        where.sitioWeb = {
          not: null,
        };
      } else {
        where.sitioWeb = null;
      }
    }

    if (filters.hasPhysicalLocation !== undefined) {
      if (filters.hasPhysicalLocation) {
        where.direccion = {
          not: null,
        };
      } else {
        where.direccion = null;
      }
    }

    if (filters.query) {
      where.OR = [
        {
          nombre: {
            contains: filters.query,
            mode: 'insensitive',
          },
        },
        {
          direccion: {
            contains: filters.query,
            mode: 'insensitive',
          },
        },
      ];
    }

    return where;
  }

  /**
   * Convierte criterios de ordenamiento
   */
  static toPrismaOrderBy(orderBy?: {
    field: 'nombre' | 'fechaCreacion' | 'fechaActualizacion';
    direction: 'asc' | 'desc';
  }) {
    if (!orderBy) {
      return { nombre: 'asc' as const };
    }

    return {
      [orderBy.field]: orderBy.direction,
    };
  }
}