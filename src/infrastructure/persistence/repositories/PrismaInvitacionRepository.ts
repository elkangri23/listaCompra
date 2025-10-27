/**
 * Implementación del repositorio de invitaciones usando Prisma ORM
 * Convierte entre entidades de dominio y modelos de Prisma
 */

import { PrismaClient } from '@prisma/client';
import type { IInvitacionRepository } from '@application/ports/repositories/IInvitacionRepository';
import { Invitacion } from '@domain/entities/Invitacion';
import { Hash } from '@domain/value-objects/Hash';
import { PermissionType } from '@domain/value-objects/PermissionType';

export class PrismaInvitacionRepository implements IInvitacionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(invitacion: Invitacion): Promise<void> {
    const data = invitacion.toPersistence();
    
    await this.prisma.invitacion.upsert({
      where: { id: data.id },
      update: {
        activa: data.activa
      },
      create: {
        id: data.id,
        hash: data.hash,
        fechaCreacion: data.creadaEn,
        fechaExpiracion: data.expiraEn,
        listaId: data.listaId,
        activa: data.activa,
        tipoPermiso: data.tipoPermiso as any // Cast al enum de Prisma
      }
    });
  }

  async findById(id: string): Promise<Invitacion | null> {
    const invitacion = await this.prisma.invitacion.findUnique({
      where: { id }
    });
    
    if (!invitacion) return null;
    return this.toDomain(invitacion);
  }

  async findByHash(hash: string): Promise<Invitacion | null> {
    const invitacion = await this.prisma.invitacion.findUnique({
      where: { hash }
    });
    
    if (!invitacion) return null;
    return this.toDomain(invitacion);
  }

  async findByListaId(listaId: string): Promise<Invitacion[]> {
    const invitaciones = await this.prisma.invitacion.findMany({
      where: { listaId }
    });
    
    return invitaciones.map(inv => this.toDomain(inv)).filter(inv => inv !== null) as Invitacion[];
  }

  async findActiveByListaId(listaId: string): Promise<Invitacion[]> {
    const invitaciones = await this.prisma.invitacion.findMany({
      where: {
        listaId,
        activa: true,
        fechaExpiracion: {
          gt: new Date() // Solo invitaciones no expiradas
        }
      }
    });
    
    return invitaciones.map(inv => this.toDomain(inv)).filter(inv => inv !== null) as Invitacion[];
  }

  async getAllActiveHashes(): Promise<string[]> {
    const invitaciones = await this.prisma.invitacion.findMany({
      where: {
        activa: true,
        fechaExpiracion: {
          gt: new Date()
        }
      },
      select: {
        hash: true
      }
    });
    
    return invitaciones.map(inv => inv.hash);
  }

  async update(invitacion: Invitacion): Promise<void> {
    const data = invitacion.toPersistence();
    
    await this.prisma.invitacion.update({
      where: { id: data.id },
      data: {
        activa: data.activa,
        tipoPermiso: data.tipoPermiso as any // Cast al enum de Prisma
      }
    });
  }

  async findExpired(): Promise<Invitacion[]> {
    const invitaciones = await this.prisma.invitacion.findMany({
      where: {
        fechaExpiracion: {
          lt: new Date()
        }
      }
    });
    
    return invitaciones.map(inv => this.toDomain(inv)).filter(inv => inv !== null) as Invitacion[];
  }

  async deactivateExpired(): Promise<number> {
    const result = await this.prisma.invitacion.updateMany({
      where: {
        fechaExpiracion: {
          lt: new Date()
        },
        activa: true
      },
      data: {
        activa: false
      }
    });
    
    return result.count;
  }

  async delete(id: string): Promise<void> {
    await this.prisma.invitacion.delete({
      where: { id }
    });
  }

  /**
   * Convierte un modelo de Prisma a entidad de dominio
   */
  private toDomain(prismaInvitacion: any): Invitacion | null {
    try {
      // Crear value objects
      const hashResult = Hash.create(prismaInvitacion.hash);
      if (hashResult.isFailure) {
        console.error('Error al crear Hash:', hashResult.error);
        return null;
      }

      const tipoPermisoResult = PermissionType.create(prismaInvitacion.tipoPermiso);
      if (tipoPermisoResult.isFailure) {
        console.error('Error al crear PermissionType:', tipoPermisoResult.error);
        return null;
      }

      // Crear entidad Invitacion
      const invitacionResult = Invitacion.create(
        prismaInvitacion.id,
        prismaInvitacion.listaId,
        hashResult.value,
        tipoPermisoResult.value,
        prismaInvitacion.fechaCreacion,
        prismaInvitacion.fechaExpiracion,
        prismaInvitacion.activa
      );

      if (invitacionResult.isFailure) {
        console.error('Error al crear Invitacion:', invitacionResult.error);
        return null;
      }

      return invitacionResult.value;
    } catch (error) {
      console.error('Error al convertir Prisma a dominio:', error);
      return null;
    }
  }
}