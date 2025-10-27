/**
 * Mapper para convertir entre la entidad Categoria y el modelo de Prisma
 */

import type { Categoria as PrismaCategoria } from '@prisma/client';
import { Categoria, type CategoriaProps } from '@domain/entities/Categoria';

export class CategoriaMapper {
  /**
   * Convierte desde el modelo de Prisma a la entidad de dominio
   */
  static toDomain(prismaCategoria: PrismaCategoria): Categoria {
    const props: CategoriaProps & { id: string } = {
      id: prismaCategoria.id,
      nombre: prismaCategoria.nombre,
      activa: prismaCategoria.activa,
      fechaCreacion: prismaCategoria.fechaCreacion,
      fechaActualizacion: prismaCategoria.fechaActualizacion,
      ...(prismaCategoria.descripcion && { descripcion: prismaCategoria.descripcion }),
      ...(prismaCategoria.color && { color: prismaCategoria.color }),
      ...(prismaCategoria.icono && { icono: prismaCategoria.icono }),
      ...(prismaCategoria.tiendaId && { tiendaId: prismaCategoria.tiendaId }),
    };

    return Categoria.fromPersistence(props);
  }

  /**
   * Convierte desde la entidad de dominio al modelo de Prisma para crear
   */
  static toPrismaCreate(categoria: Categoria): Omit<PrismaCategoria, 'id' | 'fechaCreacion' | 'fechaActualizacion'> {
    return {
      nombre: categoria.nombre,
      descripcion: categoria.descripcion,
      color: categoria.color,
      icono: categoria.icono,
      activa: categoria.activa,
      tiendaId: categoria.tiendaId,
    };
  }

  /**
   * Convierte desde la entidad de dominio al modelo de Prisma para actualizar
   */
  static toPrismaUpdate(categoria: Categoria): Omit<PrismaCategoria, 'id' | 'fechaCreacion'> {
    return {
      nombre: categoria.nombre,
      descripcion: categoria.descripcion,
      color: categoria.color,
      icono: categoria.icono,
      activa: categoria.activa,
      tiendaId: categoria.tiendaId,
      fechaActualizacion: categoria.fechaActualizacion,
    };
  }

  /**
   * Convierte múltiples registros de Prisma a entidades de dominio
   */
  static toDomainArray(prismaCategorias: PrismaCategoria[]): Categoria[] {
    return prismaCategorias.map(this.toDomain);
  }

  /**
   * Extrae solo los campos necesarios para las operaciones de filtrado
   */
  static toPrismaWhereInput(filters: {
    id?: string;
    nombre?: string;
    tiendaId?: string | null;
    activa?: boolean;
    color?: string;
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

    if (filters.tiendaId !== undefined) {
      where.tiendaId = filters.tiendaId;
    }

    if (filters.activa !== undefined) {
      where.activa = filters.activa;
    }

    if (filters.color) {
      where.color = filters.color;
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