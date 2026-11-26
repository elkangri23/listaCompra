/**
 * Caso de uso: estado MFA del usuario
 * Una sola query para pintar la pestaña de Seguridad del frontend.
 */

import type { Result } from '@shared/result';
import { success, failure } from '@shared/result';
import type { UUID } from '@shared/types';
import type { IUsuarioRepository } from '@application/ports/repositories/IUsuarioRepository';
import type { IMfaRepository } from '@application/ports/repositories/IMfaRepository';
import { NotFoundError } from '@application/errors/NotFoundError';

export interface MfaStatusDto {
  totpEnabled: boolean;
  totpPending: boolean;
  /** Reservado para fase 2 (passkeys) — siempre 0 hasta entonces */
  passkeyCount: number;
  backupCodesLeft: number;
}

export class GetMfaStatus {
  constructor(
    private readonly usuarioRepository: IUsuarioRepository,
    private readonly mfaRepository: IMfaRepository
  ) {}

  async execute(usuarioId: UUID): Promise<Result<MfaStatusDto, NotFoundError | Error>> {
    const userResult = await this.usuarioRepository.findById(usuarioId);
    if (userResult.isFailure) {
      return failure(userResult.error);
    }
    const usuario = userResult.value;
    if (!usuario) {
      return failure(NotFoundError.user(usuarioId));
    }

    const backupCountResult = await this.mfaRepository.countActiveBackupCodes(usuarioId);
    if (backupCountResult.isFailure) {
      return failure(backupCountResult.error);
    }

    return success({
      totpEnabled: usuario.totpEnabled,
      totpPending: usuario.totpPendiente,
      passkeyCount: 0, // fase 2 (passkeys)
      backupCodesLeft: usuario.totpEnabled ? backupCountResult.value : 0,
    });
  }
}
