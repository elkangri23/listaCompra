/**
 * Caso de uso: Solicitar eliminación de cuenta (GDPR, item 15)
 * Verifica la contraseña actual, desactiva la cuenta y fija la fecha de
 * solicitud; la purga definitiva (hard delete) llega a los 30 días por el
 * job programado. Idempotente: si ya se solicitó, devuelve la fecha existente.
 */

import type { Result } from '@shared/result';
import { success, failure } from '@shared/result';
import { NotFoundError, UnauthorizedError, ValidationError } from '@application/errors';
import type { IUsuarioRepository } from '@application/ports/repositories/IUsuarioRepository';
import type { IPasswordHasher } from '@application/ports/auth/IPasswordHasher';
import { Password } from '@domain/value-objects/Password';

/** Días de gracia entre la solicitud y el borrado definitivo (GDPR, item 15). */
export const DIAS_GRACIA_ELIMINACION = 30;

export interface RequestAccountDeletionDto {
  usuarioId: string;
  password: string;
}

export interface RequestAccountDeletionResponseDto {
  mensaje: string;
  eliminacionSolicitadaEn: string;
  eliminacionDefinitivaEn: string;
}

export class RequestAccountDeletion {
  constructor(
    private readonly usuarioRepository: IUsuarioRepository,
    private readonly passwordHasher: IPasswordHasher
  ) {}

  async execute(
    dto: RequestAccountDeletionDto
  ): Promise<Result<RequestAccountDeletionResponseDto, ValidationError | NotFoundError | UnauthorizedError>> {
    if (!dto.usuarioId || dto.usuarioId.trim().length === 0) {
      return failure(new ValidationError('ID de usuario es requerido', 'usuarioId', dto.usuarioId));
    }

    const usuarioResult = await this.usuarioRepository.findById(dto.usuarioId);
    if (usuarioResult.isFailure || !usuarioResult.value) {
      return failure(new NotFoundError('Usuario', dto.usuarioId));
    }
    const usuario = usuarioResult.value;

    // Idempotente: si ya se solicitó, devolver la fecha existente sin tocar nada.
    if (!usuario.activo && usuario.eliminacionSolicitadaEn) {
      return success(this.buildResponse(usuario.eliminacionSolicitadaEn));
    }

    if (!usuario.activo) {
      return failure(new ValidationError('La cuenta ya está desactivada', 'usuarioId', dto.usuarioId));
    }

    const passwordResult = Password.create(dto.password);
    if (passwordResult.isFailure) {
      return failure(new UnauthorizedError('La contraseña actual no es correcta'));
    }
    const validResult = await this.passwordHasher.verify(passwordResult.value, usuario.password);
    if (validResult.isFailure || !validResult.value) {
      return failure(new UnauthorizedError('La contraseña actual no es correcta'));
    }

    const solicitudResult = usuario.solicitarEliminacion();
    if (solicitudResult.isFailure) {
      return failure(new ValidationError(solicitudResult.error.message, 'usuarioId', dto.usuarioId));
    }

    const updateResult = await this.usuarioRepository.update(usuario);
    if (updateResult.isFailure) {
      return failure(new ValidationError(updateResult.error.message, 'usuarioId', dto.usuarioId));
    }

    return success(this.buildResponse(usuario.eliminacionSolicitadaEn as Date));
  }

  private buildResponse(solicitadaEn: Date): RequestAccountDeletionResponseDto {
    const definitivaEn = new Date(solicitadaEn);
    definitivaEn.setDate(definitivaEn.getDate() + DIAS_GRACIA_ELIMINACION);
    return {
      mensaje:
        'Tu cuenta ha sido desactivada. Se eliminará definitivamente el ' +
        definitivaEn.toLocaleDateString('es-ES') +
        ' si no vuelves a entrar antes. Si te arrepientes, escribe a anthonymoles89@gmail.com.',
      eliminacionSolicitadaEn: solicitadaEn.toISOString(),
      eliminacionDefinitivaEn: definitivaEn.toISOString(),
    };
  }
}
