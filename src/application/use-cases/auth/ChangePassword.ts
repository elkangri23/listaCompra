/**
 * Caso de uso: Cambiar Contraseña (13A)
 * Verifica la contraseña actual y guarda la nueva con hash bcrypt.
 */

import type { Result } from '@shared/result';
import { success, failure } from '@shared/result';
import { NotFoundError, UnauthorizedError, ValidationError } from '@application/errors';
import type { IUsuarioRepository } from '@application/ports/repositories/IUsuarioRepository';
import type { IPasswordHasher } from '@application/ports/auth/IPasswordHasher';
import { Password } from '@domain/value-objects/Password';

export interface ChangePasswordDto {
  usuarioId: string;
  currentPassword: string;
  newPassword: string;
}

export interface ChangePasswordResponseDto {
  mensaje: string;
}

export class ChangePassword {
  constructor(
    private readonly usuarioRepository: IUsuarioRepository,
    private readonly passwordHasher: IPasswordHasher
  ) {}

  async execute(dto: ChangePasswordDto): Promise<Result<ChangePasswordResponseDto, ValidationError | NotFoundError | UnauthorizedError>> {
    if (!dto.usuarioId || dto.usuarioId.trim().length === 0) {
      return failure(new ValidationError('ID de usuario es requerido', 'usuarioId', dto.usuarioId));
    }
    if (!dto.currentPassword) {
      return failure(new ValidationError('La contraseña actual es obligatoria', 'currentPassword', ''));
    }
    if (!dto.newPassword) {
      return failure(new ValidationError('La nueva contraseña es obligatoria', 'newPassword', ''));
    }
    if (dto.currentPassword === dto.newPassword) {
      return failure(new ValidationError('La nueva contraseña debe ser diferente a la actual', 'newPassword', ''));
    }

    const usuarioResult = await this.usuarioRepository.findById(dto.usuarioId);
    if (usuarioResult.isFailure || !usuarioResult.value) {
      return failure(new NotFoundError('Usuario', dto.usuarioId));
    }
    const usuario = usuarioResult.value;

    const currentResult = Password.create(dto.currentPassword);
    if (currentResult.isFailure) {
      return failure(new UnauthorizedError('La contraseña actual no es correcta'));
    }
    const validResult = await this.passwordHasher.verify(currentResult.value, usuario.password);
    if (validResult.isFailure || !validResult.value) {
      return failure(new UnauthorizedError('La contraseña actual no es correcta'));
    }

    const newResult = Password.create(dto.newPassword);
    if (newResult.isFailure) {
      return failure(new ValidationError(
        'La nueva contraseña no cumple los requisitos (mínimo 8 caracteres, mayúscula, minúscula y número)',
        'newPassword',
        ''
      ));
    }
    const hashResult = await this.passwordHasher.hash(newResult.value);
    if (hashResult.isFailure) {
      return failure(new ValidationError('No se pudo guardar la nueva contraseña', 'newPassword', ''));
    }

    const updateResult = usuario.actualizarPassword(hashResult.value);
    if (updateResult.isFailure) {
      return failure(new ValidationError(updateResult.error.message, 'newPassword', ''));
    }

    const saveResult = await this.usuarioRepository.update(usuario);
    if (saveResult.isFailure) {
      return failure(new ValidationError('No se pudo guardar la nueva contraseña', 'newPassword', ''));
    }

    return success({ mensaje: 'Contraseña actualizada exitosamente' });
  }
}
