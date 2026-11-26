/**
 * Caso de uso: Actualizar Perfil (13A)
 * Actualiza el nombre (y opcionalmente el email) del usuario autenticado.
 * El frontend envía el nombre completo en un solo campo: la primera palabra
 * va a `nombre` y el resto a `apellidos`, para no borrar los apellidos
 * existentes al guardar. Cambiar el email marca emailVerificado=false
 * (la entidad lo exige: habrá que re-verificarlo, punto 3 del backlog).
 */

import type { Result } from '@shared/result';
import { success, failure } from '@shared/result';
import { NotFoundError, ValidationError } from '@application/errors';
import type { IUsuarioRepository } from '@application/ports/repositories/IUsuarioRepository';
import { Email } from '@domain/value-objects/Email';

export interface UpdateProfileDto {
  usuarioId: string;
  /** Nombre completo (p. ej. "Antonio Moles Leiva") */
  nombre?: string;
  email?: string;
}

export interface UpdateProfileResponseDto {
  id: string;
  name: string;
  email: string;
  roles: string[];
  image: null;
}

export class UpdateProfile {
  constructor(private readonly usuarioRepository: IUsuarioRepository) {}

  async execute(dto: UpdateProfileDto): Promise<Result<UpdateProfileResponseDto, ValidationError | NotFoundError>> {
    if (!dto.usuarioId || dto.usuarioId.trim().length === 0) {
      return failure(new ValidationError('ID de usuario es requerido', 'usuarioId', dto.usuarioId));
    }

    const usuarioResult = await this.usuarioRepository.findById(dto.usuarioId);
    if (usuarioResult.isFailure || !usuarioResult.value) {
      return failure(new NotFoundError('Usuario', dto.usuarioId));
    }
    const usuario = usuarioResult.value;

    if (dto.nombre !== undefined) {
      const completo = dto.nombre.trim();
      if (completo.length === 0) {
        return failure(new ValidationError('El nombre no puede estar vacío', 'nombre', dto.nombre));
      }
      const [nombre, ...resto] = completo.split(/\s+/);
      const apellidos = resto.length > 0 ? resto.join(' ') : undefined;
      const nombreResult = usuario.actualizarNombre(nombre!, apellidos);
      if (nombreResult.isFailure) {
        return failure(new ValidationError(nombreResult.error.message, 'nombre', dto.nombre));
      }
    }

    if (dto.email !== undefined) {
      const nuevoEmail = dto.email.trim().toLowerCase();
      if (nuevoEmail !== usuario.email.value.toLowerCase()) {
        const emailResult = Email.create(nuevoEmail);
        if (emailResult.isFailure) {
          return failure(new ValidationError('Email no válido', 'email', dto.email));
        }
        const existeResult = await this.usuarioRepository.existsByEmail(emailResult.value);
        if (existeResult.isFailure) {
          return failure(new ValidationError('No se pudo verificar el email', 'email', dto.email));
        }
        if (existeResult.value) {
          return failure(new ValidationError('Ese email ya está en uso', 'email', dto.email));
        }
        const emailUpdateResult = usuario.actualizarEmail(emailResult.value);
        if (emailUpdateResult.isFailure) {
          return failure(new ValidationError(emailUpdateResult.error.message, 'email', dto.email));
        }
      }
    }

    const updateResult = await this.usuarioRepository.update(usuario);
    if (updateResult.isFailure) {
      return failure(new ValidationError('No se pudo guardar el perfil', 'usuario', dto.usuarioId));
    }

    return success({
      id: usuario.id,
      name: usuario.nombreCompleto,
      email: usuario.email.value,
      roles: [usuario.rol],
      image: null
    });
  }
}
