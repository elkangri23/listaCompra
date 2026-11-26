/**
 * Casos de uso de lectura/CRUD de passkeys (fase 2):
 * ListPasskeys, RenamePasskey, DeletePasskey (step-up obligatorio).
 */

import type { Result } from '@shared/result';
import { success, failure } from '@shared/result';
import type { UUID } from '@shared/types';
import type { IPasskeyRepository, PasskeyCredentialData } from '@application/ports/repositories/IPasskeyRepository';
import type { StepUpPasswordVerifier } from './StepUpPasswordVerifier';
import { PasskeyNotFoundError } from '@domain/errors/MfaError';
import { UnauthorizedError } from '@application/errors/UnauthorizedError';

// ============================================================================
// ListPasskeys
// ============================================================================

export interface PasskeyListItemDto {
  id: string;
  nombre: string;
  deviceType: string;
  transports: string[];
  createdAt: Date;
  ultimoUso: Date | null;
  activo: boolean;
}

export class ListPasskeys {
  constructor(private readonly passkeyRepository: IPasskeyRepository) {}

  async execute(usuarioId: UUID): Promise<Result<PasskeyListItemDto[], Error>> {
    const listResult = await this.passkeyRepository.listByUsuario(usuarioId);
    if (listResult.isFailure) {
      return failure(listResult.error);
    }
    return success(
      listResult.value.map((passkey: PasskeyCredentialData) => ({
        id: passkey.id,
        nombre: passkey.nombre,
        deviceType: passkey.deviceType,
        transports: passkey.transports,
        createdAt: passkey.createdAt,
        ultimoUso: passkey.ultimoUso,
        activo: passkey.activo,
      }))
    );
  }
}

// ============================================================================
// RenamePasskey
// ============================================================================

export interface RenamePasskeyDto {
  usuarioId: UUID;
  passkeyId: string;
  nombre: string;
}

export interface RenamePasskeyResultDto {
  passkey: PasskeyListItemDto;
}

export class RenamePasskey {
  constructor(private readonly passkeyRepository: IPasskeyRepository) {}

  async execute(dto: RenamePasskeyDto): Promise<Result<RenamePasskeyResultDto, PasskeyNotFoundError | Error>> {
    const findResult = await this.passkeyRepository.findById(dto.passkeyId);
    if (findResult.isFailure) {
      return failure(findResult.error);
    }
    const passkey = findResult.value;
    if (!passkey || passkey.usuarioId !== dto.usuarioId) {
      return failure(new PasskeyNotFoundError());
    }

    const renameResult = await this.passkeyRepository.rename(dto.passkeyId, dto.nombre);
    if (renameResult.isFailure) {
      return failure(renameResult.error);
    }

    return success({
      passkey: {
        id: passkey.id,
        nombre: dto.nombre,
        deviceType: passkey.deviceType,
        transports: passkey.transports,
        createdAt: passkey.createdAt,
        ultimoUso: passkey.ultimoUso,
        activo: passkey.activo,
      },
    });
  }
}

// ============================================================================
// DeletePasskey (step-up: contraseña obligatoria)
// ============================================================================

export interface DeletePasskeyDto {
  usuarioId: UUID;
  passkeyId: string;
  password: string;
}

export class DeletePasskey {
  constructor(
    private readonly stepUp: StepUpPasswordVerifier,
    private readonly passkeyRepository: IPasskeyRepository
  ) {}

  async execute(dto: DeletePasskeyDto): Promise<Result<{ deleted: true }, PasskeyNotFoundError | UnauthorizedError | import('@application/errors/NotFoundError').NotFoundError | Error>> {
    // 1. Step-up: contraseña OBLIGATORIA (la alternativa "passkey vigente" es ambigua)
    const stepUpResult = await this.stepUp.verify(dto.usuarioId, dto.password);
    if (stepUpResult.isFailure) {
      return failure(stepUpResult.error);
    }

    // 2. Propiedad de la credencial
    const findResult = await this.passkeyRepository.findById(dto.passkeyId);
    if (findResult.isFailure) {
      return failure(findResult.error);
    }
    const passkey = findResult.value;
    if (!passkey || passkey.usuarioId !== dto.usuarioId) {
      return failure(new PasskeyNotFoundError());
    }

    const deleteResult = await this.passkeyRepository.delete(dto.passkeyId);
    if (deleteResult.isFailure) {
      return failure(deleteResult.error);
    }

    return success({ deleted: true });
  }
}
