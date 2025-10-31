/**
 * Implementación del repositorio de usuarios usando Prisma
 */

import { PrismaClient } from '@prisma/client';
import type { IUsuarioRepository } from '@application/ports/repositories/IUsuarioRepository';
import type { Usuario } from '@domain/entities/Usuario';
import type { Email } from '@domain/value-objects/Email';
import type { UUID, PaginationParams, PaginationResult } from '@shared/types';
import { UsuarioMapper } from '../mappers/UsuarioMapper';
import type { Result } from '@shared/result';
import { success, failure } from '@shared/result';

export class PrismaUsuarioRepository implements IUsuarioRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(usuario: Usuario): Promise<Result<Usuario, Error>> {
    try {
      const persistenceData = UsuarioMapper.toPersistence(usuario);
      
      const savedUsuario = await this.prisma.usuario.create({
        data: {
          id: persistenceData.id,
          nombre: persistenceData.nombre,
          ...(persistenceData.apellidos && { apellidos: persistenceData.apellidos }),
          email: persistenceData.email,
          password: persistenceData.password,
          rol: persistenceData.rol as any,
          activo: persistenceData.activo,
          ...(persistenceData.emailVerificado !== undefined && { emailVerificado: persistenceData.emailVerificado }),
        },
      });

      const domainUsuario = UsuarioMapper.toDomain(savedUsuario);
      return success(domainUsuario);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido al guardar usuario';
      return failure(new Error(`Error al guardar usuario: ${errorMessage}`));
    }
  }

  async update(usuario: Usuario): Promise<Result<Usuario, Error>> {
    try {
      const persistenceData = UsuarioMapper.toPersistence(usuario);
      
      const updatedUsuario = await this.prisma.usuario.update({
        where: { id: usuario.id },
        data: {
          nombre: persistenceData.nombre,
          ...(persistenceData.apellidos && { apellidos: persistenceData.apellidos }),
          email: persistenceData.email,
          password: persistenceData.password,
          rol: persistenceData.rol as any,
          activo: persistenceData.activo,
          ...(persistenceData.emailVerificado !== undefined && { emailVerificado: persistenceData.emailVerificado }),
          fechaActualizacion: new Date(),
        },
      });

      const domainUsuario = UsuarioMapper.toDomain(updatedUsuario);
      return success(domainUsuario);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido al actualizar usuario';
      return failure(new Error(`Error al actualizar usuario: ${errorMessage}`));
    }
  }

  async findById(id: UUID): Promise<Result<Usuario | null, Error>> {
    try {
      const usuarioData = await this.prisma.usuario.findUnique({
        where: { id },
      });

      if (!usuarioData) {
        return success(null);
      }

      const usuario = UsuarioMapper.toDomain(usuarioData);
      return success(usuario);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido al buscar usuario por ID';
      return failure(new Error(`Error al buscar usuario por ID: ${errorMessage}`));
    }
  }

  async findByEmail(email: Email): Promise<Result<Usuario | null, Error>> {
    try {
      const usuarioData = await this.prisma.usuario.findUnique({
        where: { email: email.value },
      });

      if (!usuarioData) {
        return success(null);
      }

      const usuario = UsuarioMapper.toDomain(usuarioData);
      return success(usuario);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido al buscar usuario por email';
      return failure(new Error(`Error al buscar usuario por email: ${errorMessage}`));
    }
  }

  async existsByEmail(email: Email): Promise<Result<boolean, Error>> {
    try {
      const count = await this.prisma.usuario.count({
        where: { 
          email: email.value,
          activo: true, // Solo consideramos usuarios activos
        },
      });

      return success(count > 0);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido al verificar existencia del usuario';
      return failure(new Error(`Error al verificar existencia del usuario: ${errorMessage}`));
    }
  }

  async findAll(params: PaginationParams): Promise<Result<PaginationResult<Usuario>, Error>> {
    try {
      const skip = (params.page - 1) * params.limit;
      
      const [usuariosData, total] = await Promise.all([
        this.prisma.usuario.findMany({
          skip,
          take: params.limit,
          orderBy: { fechaCreacion: 'desc' },
        }),
        this.prisma.usuario.count(),
      ]);

      const usuarios = usuariosData.map(UsuarioMapper.toDomain);
      
      const result: PaginationResult<Usuario> = {
        data: usuarios,
        total,
        page: params.page,
        limit: params.limit,
        totalPages: Math.ceil(total / params.limit),
        hasNext: params.page * params.limit < total,
        hasPrevious: params.page > 1,
      };

      return success(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido al obtener usuarios';
      return failure(new Error(`Error al obtener usuarios: ${errorMessage}`));
    }
  }

  async findActive(params: PaginationParams): Promise<Result<PaginationResult<Usuario>, Error>> {
    try {
      const skip = (params.page - 1) * params.limit;
      
      const [usuariosData, total] = await Promise.all([
        this.prisma.usuario.findMany({
          where: { activo: true },
          skip,
          take: params.limit,
          orderBy: { fechaCreacion: 'desc' },
        }),
        this.prisma.usuario.count({ where: { activo: true } }),
      ]);

      const usuarios = usuariosData.map(UsuarioMapper.toDomain);
      
      const result: PaginationResult<Usuario> = {
        data: usuarios,
        total,
        page: params.page,
        limit: params.limit,
        totalPages: Math.ceil(total / params.limit),
        hasNext: params.page * params.limit < total,
        hasPrevious: params.page > 1,
      };

      return success(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido al obtener usuarios activos';
      return failure(new Error(`Error al obtener usuarios activos: ${errorMessage}`));
    }
  }

  async findByRole(role: string, params: PaginationParams): Promise<Result<PaginationResult<Usuario>, Error>> {
    try {
      const skip = (params.page - 1) * params.limit;
      
      const [usuariosData, total] = await Promise.all([
        this.prisma.usuario.findMany({
          where: { 
            rol: role as any,
            activo: true,
          },
          skip,
          take: params.limit,
          orderBy: { fechaCreacion: 'desc' },
        }),
        this.prisma.usuario.count({ 
          where: { 
            rol: role as any,
            activo: true,
          },
        }),
      ]);

      const usuarios = usuariosData.map(UsuarioMapper.toDomain);
      
      const result: PaginationResult<Usuario> = {
        data: usuarios,
        total,
        page: params.page,
        limit: params.limit,
        totalPages: Math.ceil(total / params.limit),
        hasNext: params.page * params.limit < total,
        hasPrevious: params.page > 1,
      };

      return success(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido al buscar usuarios por rol';
      return failure(new Error(`Error al buscar usuarios por rol: ${errorMessage}`));
    }
  }

  async delete(id: UUID): Promise<Result<void, Error>> {
    try {
      // Soft delete - marcamos como inactivo en lugar de eliminar físicamente
      await this.prisma.usuario.update({
        where: { id },
        data: {
          activo: false,
          fechaActualizacion: new Date(),
        },
      });

      return success(undefined);
    } catch (error) {
      // Si el usuario no existe, el update fallará
      if (error instanceof Error && error.message.includes('Record to update not found')) {
        return failure(new Error('Usuario no encontrado'));
      }
      
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido al eliminar usuario';
      return failure(new Error(`Error al eliminar usuario: ${errorMessage}`));
    }
  }

  async hardDelete(id: UUID): Promise<Result<void, Error>> {
    try {
      await this.prisma.usuario.delete({
        where: { id },
      });

      return success(undefined);
    } catch (error) {
      if (error instanceof Error && error.message.includes('Record to delete does not exist')) {
        return failure(new Error('Usuario no encontrado'));
      }
      
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido al eliminar definitivamente el usuario';
      return failure(new Error(`Error al eliminar definitivamente el usuario: ${errorMessage}`));
    }
  }

  async count(): Promise<Result<number, Error>> {
    try {
      const total = await this.prisma.usuario.count();
      return success(total);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido al contar usuarios';
      return failure(new Error(`Error al contar usuarios: ${errorMessage}`));
    }
  }

  async countActive(): Promise<Result<number, Error>> {
    try {
      const total = await this.prisma.usuario.count({
        where: { activo: true },
      });
      return success(total);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido al contar usuarios activos';
      return failure(new Error(`Error al contar usuarios activos: ${errorMessage}`));
    }
  }

  async search(term: string, params: PaginationParams): Promise<Result<PaginationResult<Usuario>, Error>> {
    try {
      const skip = (params.page - 1) * params.limit;
      
      const [usuariosData, total] = await Promise.all([
        this.prisma.usuario.findMany({
          where: {
            activo: true,
            OR: [
              { nombre: { contains: term, mode: 'insensitive' } },
              { apellidos: { contains: term, mode: 'insensitive' } },
              { email: { contains: term, mode: 'insensitive' } },
            ],
          },
          skip,
          take: params.limit,
          orderBy: { fechaCreacion: 'desc' },
        }),
        this.prisma.usuario.count({
          where: {
            activo: true,
            OR: [
              { nombre: { contains: term, mode: 'insensitive' } },
              { apellidos: { contains: term, mode: 'insensitive' } },
              { email: { contains: term, mode: 'insensitive' } },
            ],
          },
        }),
      ]);

      const usuarios = usuariosData.map(UsuarioMapper.toDomain);
      
      const result: PaginationResult<Usuario> = {
        data: usuarios,
        total,
        page: params.page,
        limit: params.limit,
        totalPages: Math.ceil(total / params.limit),
        hasNext: params.page * params.limit < total,
        hasPrevious: params.page > 1,
      };

      return success(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido al buscar usuarios';
      return failure(new Error(`Error al buscar usuarios: ${errorMessage}`));
    }
  }
}