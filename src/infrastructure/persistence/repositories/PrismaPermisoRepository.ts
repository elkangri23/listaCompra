/**
 * Implementación del repositorio de permisos usando Prisma ORM
 * Convierte entre entidades de dominio y modelos de Prisma
 */

import { PrismaClient } from '@prisma/client';
import type { IPermisoRepository } from '@application/ports/repositories/IPermisoRepository';
import { Permiso } from '@domain/entities/Permiso';

export class PrismaPermisoRepository implements IPermisoRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(permiso: Permiso): Promise<void> {
    const data = permiso.toPersistence();
    
    await this.prisma.permiso.upsert({
      where: {
        usuarioId_listaId: {
          usuarioId: data.usuarioId,
          listaId: data.listaId
        }
      },
      update: {
        tipoPermiso: data.tipoPermiso as any
      },
      create: {
        id: data.id,
        usuarioId: data.usuarioId,
        listaId: data.listaId,
        tipoPermiso: data.tipoPermiso as any,
        fechaCreacion: data.creadoEn
      }
    });
  }

  async findById(id: string): Promise<Permiso | null> {
    const permiso = await this.prisma.permiso.findUnique({
      where: { id }
    });
    
    if (!permiso) return null;
    return this.toDomain(permiso);
  }

  async findByUsuarioId(usuarioId: string): Promise<Permiso[]> {
    const permisos = await this.prisma.permiso.findMany({
      where: { usuarioId }
    });
    
    return permisos.map(perm => this.toDomain(perm)).filter(perm => perm !== null) as Permiso[];
  }

  async findByListaId(listaId: string): Promise<Permiso[]> {
    const permisos = await this.prisma.permiso.findMany({
      where: { listaId }
    });
    
    return permisos.map(perm => this.toDomain(perm)).filter(perm => perm !== null) as Permiso[];
  }

  async findByUsuarioAndLista(usuarioId: string, listaId: string): Promise<Permiso[]> {
    const permisos = await this.prisma.permiso.findMany({
      where: {
        usuarioId,
        listaId
      }
    });
    
    return permisos.map(perm => this.toDomain(perm)).filter(perm => perm !== null) as Permiso[];
  }

  async findUniqueByUsuarioAndLista(usuarioId: string, listaId: string): Promise<Permiso | null> {
    const permiso = await this.prisma.permiso.findUnique({
      where: {
        usuarioId_listaId: {
          usuarioId,
          listaId
        }
      }
    });
    
    if (!permiso) return null;
    return this.toDomain(permiso);
  }

  async update(permiso: Permiso): Promise<void> {
    const data = permiso.toPersistence();
    
    await this.prisma.permiso.update({
      where: { id: data.id },
      data: {
        tipoPermiso: data.tipoPermiso as any
      }
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.permiso.delete({
      where: { id }
    });
  }

  async deleteByUsuarioAndLista(usuarioId: string, listaId: string): Promise<void> {
    await this.prisma.permiso.deleteMany({
      where: {
        usuarioId,
        listaId
      }
    });
  }

  async deleteByListaId(listaId: string): Promise<void> {
    await this.prisma.permiso.deleteMany({
      where: { listaId }
    });
  }

  async hasPermission(usuarioId: string, listaId: string): Promise<boolean> {
    const count = await this.prisma.permiso.count({
      where: {
        usuarioId,
        listaId
      }
    });
    
    return count > 0;
  }

  async hasPermissionType(usuarioId: string, listaId: string, tipoPermiso: string): Promise<boolean> {
    const count = await this.prisma.permiso.count({
      where: {
        usuarioId,
        listaId,
        tipoPermiso: tipoPermiso as any
      }
    });
    
    return count > 0;
  }

  /**
   * Convierte un modelo de Prisma a entidad de dominio
   */
  private toDomain(prismaPermiso: any): Permiso | null {
    try {
      const permisoResult = Permiso.fromPersistence({
        id: prismaPermiso.id,
        usuarioId: prismaPermiso.usuarioId,
        listaId: prismaPermiso.listaId,
        tipoPermiso: prismaPermiso.tipoPermiso,
        creadoEn: prismaPermiso.fechaCreacion
      });

      if (permisoResult.isFailure) {
        console.error('Error al crear permiso desde persistencia:', permisoResult.error);
        return null;
      }

      return permisoResult.value;
    } catch (error) {
      console.error('Error en toDomain:', error);
      return null;
    }
  }
}