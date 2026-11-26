/**
 * Caso de uso: estado MFA del usuario
 * Una sola query para pintar la pestaña de Seguridad del frontend.
 */

import type { Result } from '@shared/result';
import { success, failure } from '@shared/result';
import type { UUID } from '@shared/types';
import type { IUsuarioRepository } from '@application/ports/repositories/IUsuarioRepository';
import type { IMfaRepository } from '@application/ports/repositories/IMfaRepository';
import type { IPasskeyRepository } from '@application/ports/repositories/IPasskeyRepository';
import { NotFoundError } from '@application/errors/NotFoundError';

export interface MfaStatusDto {
  totpEnabled: boolean;
  totpPending: boolean;
  /** Número de passkeys activas (fase 2) */
  passkeyCount: number;
  backupCodesLeft: number;
}

export class GetMfaStatus {
  constructor(
    private readonly usuarioRepository: IUsuarioRepository,
    private readonly mfaRepository: IMfaRepository,
    private readonly passkeyRepository?: IPasskeyRepository
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

    let passkeyCount = 0;
    if (this.passkeyRepository) {
      const passkeyCountResult = await this.passkeyRepository.countByUsuario(usuarioId);
      if (passkeyCountResult.isFailure) {
        return failure(passkeyCountResult.error);
      }
      passkeyCount = passkeyCountResult.value;
    }

    return success({
      totpEnabled: usuario.totpEnabled,
      totpPending: usuario.totpPendiente,
      passkeyCount,
      backupCodesLeft: usuario.totpEnabled ? backupCountResult.value : 0,
    });
  }
}
