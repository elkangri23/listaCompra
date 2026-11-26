/**
 * Caso de uso: Rechazar Invitación (13A)
 * Permite al usuario invitado rechazar una invitación pendiente.
 * A diferencia de CancelInvitation (la hace el administrador de la lista),
 * aquí quien rechaza es el destinatario, identificado por su email.
 */

import type { Result } from '@shared/result';
import { success, failure } from '@shared/result';
import { NotFoundError, UnauthorizedError, ValidationError } from '@application/errors';
import type { IUsuarioRepository } from '@application/ports/repositories/IUsuarioRepository';
import type { IInvitacionRepository } from '@application/ports/repositories/IInvitacionRepository';

export interface DeclineInvitationDto {
  invitacionId: string;
  usuarioId: string; // Usuario que rechaza (debe ser el destinatario)
}

export interface DeclineInvitationResponseDto {
  mensaje: string;
  invitacionId: string;
  rechazadaEn: Date;
}

export class DeclineInvitation {
  constructor(
    private readonly usuarioRepository: IUsuarioRepository,
    private readonly invitacionRepository: IInvitacionRepository
  ) {}

  async execute(dto: DeclineInvitationDto): Promise<Result<DeclineInvitationResponseDto, ValidationError | NotFoundError | UnauthorizedError>> {
    if (!dto.invitacionId || dto.invitacionId.trim().length === 0) {
      return failure(new ValidationError('ID de invitación es requerido', 'invitacionId', dto.invitacionId));
    }
    if (!dto.usuarioId || dto.usuarioId.trim().length === 0) {
      return failure(new ValidationError('ID de usuario es requerido', 'usuarioId', dto.usuarioId));
    }

    // 1. Verificar que la invitación existe
    const invitacion = await this.invitacionRepository.findById(dto.invitacionId);
    if (!invitacion) {
      return failure(new NotFoundError('Invitación', dto.invitacionId));
    }

    // 2. Verificar que la invitación está activa
    if (!invitacion.activa) {
      return failure(new ValidationError(
        'La invitación ya está desactivada',
        'invitacion',
        'inactiva'
      ));
    }

    // 3. Verificar que el usuario existe y es el destinatario
    const usuarioResult = await this.usuarioRepository.findById(dto.usuarioId);
    if (usuarioResult.isFailure || !usuarioResult.value) {
      return failure(new NotFoundError('Usuario', dto.usuarioId));
    }
    const usuario = usuarioResult.value;

    const emailInvitado = (invitacion.emailInvitado ?? '').trim().toLowerCase();
    const emailUsuario = usuario.email.value.trim().toLowerCase();
    if (!emailInvitado || emailInvitado !== emailUsuario) {
      return failure(new UnauthorizedError(
        'Solo el destinatario puede rechazar esta invitación'
      ));
    }

    // 4. Desactivar la invitación
    const desactivadaResult = invitacion.desactivar();
    if (desactivadaResult.isFailure) {
      return failure(new ValidationError(
        'Error al rechazar invitación',
        'invitacion',
        desactivadaResult.error.message
      ));
    }

    // 5. Guardar cambios
    await this.invitacionRepository.update(desactivadaResult.value);

    return success({
      mensaje: 'Invitación rechazada exitosamente',
      invitacionId: dto.invitacionId,
      rechazadaEn: new Date()
    });
  }
}
