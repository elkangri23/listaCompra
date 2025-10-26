/**
 * Mapper para convertir entre la entidad Usuario de dominio y el modelo de persistencia de Prisma
 */

import type { Usuario as PrismaUsuario } from '@prisma/client';
import { Usuario } from '@domain/entities/Usuario';
import { Email } from '@domain/value-objects/Email';

interface PersistenceUsuario {
  id: string;
  nombre: string;
  apellidos?: string | null;
  email: string;
  password: string; // Hash de la contraseña
  rol: string;
  activo: boolean;
  emailVerificado?: boolean;
  fechaCreacion?: Date;
  fechaActualizacion?: Date;
}

export class UsuarioMapper {
  /**
   * Convierte de modelo de persistencia a entidad de dominio
   */
  static toDomain(raw: PrismaUsuario): Usuario {
    const email = Email.create(raw.email);
    if (email.isFailure) {
      throw new Error(`Email inválido en datos de persistencia: ${email.error.message}`);
    }

    const usuario = Usuario.create({
      email: email.value,
      password: raw.password, // Ya es un hash
      nombre: raw.nombre,
      ...(raw.apellidos && { apellidos: raw.apellidos }),
      rol: raw.rol as any, // Convertir el enum
      activo: raw.activo,
      emailVerificado: raw.emailVerificado,
    });

    if (usuario.isFailure) {
      throw new Error(`Error al crear usuario de dominio: ${usuario.error.message}`);
    }

    // Establecer el ID y fechas (que vienen de BD)
    const usuarioConId = usuario.value;
    Object.defineProperty(usuarioConId, '_id', { value: raw.id, writable: false });
    Object.defineProperty(usuarioConId, '_fechaCreacion', { value: raw.fechaCreacion, writable: false });
    Object.defineProperty(usuarioConId, '_fechaActualizacion', { value: raw.fechaActualizacion, writable: true });

    return usuarioConId;
  }

  /**
   * Convierte de entidad de dominio a modelo de persistencia
   */
  static toPersistence(usuario: Usuario): PersistenceUsuario {
    return {
      id: usuario.id,
      nombre: usuario.nombre,
      ...(usuario.apellidos && { apellidos: usuario.apellidos }),
      email: usuario.email.value,
      password: usuario.password, // Ya es un hash
      rol: usuario.rol,
      activo: usuario.activo,
      emailVerificado: usuario.emailVerificado,
    };
  }

  /**
   * Convierte un array de modelos de persistencia a entidades de dominio
   */
  static toDomainArray(raw: PrismaUsuario[]): Usuario[] {
    return raw.map(this.toDomain);
  }

  /**
   * Convierte un array de entidades de dominio a modelos de persistencia
   */
  static toPersistenceArray(usuarios: Usuario[]): PersistenceUsuario[] {
    return usuarios.map(this.toPersistence);
  }
}