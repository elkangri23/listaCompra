/**
 * Caso de uso: generar opciones de registro de passkey (step-up: contraseña)
 * Crea un challenge PASSKEY_REG de 5 min y devuelve las
 * PublicKeyCredentialCreationOptionsJSON para @simplewebauthn/browser.
 */

import type { Result } from '@shared/result';
import { success, failure } from '@shared/result';
import type { UUID } from '@shared/types';
import type { IMfaRepository } from '@application/ports/repositories/IMfaRepository';
import type { IPasskeyRepository } from '@application/ports/repositories/IPasskeyRepository';
import type { StepUpPasswordVerifier } from './StepUpPasswordVerifier';
import { PasskeyLimitReachedError } from '@domain/errors/MfaError';
import { UnauthorizedError } from '@application/errors/UnauthorizedError';
import {
  generateRegistrationOptions,
  type PublicKeyCredentialCreationOptionsJSON,
} from '@simplewebauthn/server';
import { getWebauthnConfig } from '@infrastructure/security/webauthn-config';

export const MAX_PASSKEYS = 5;
export const PASSKEY_REG_TTL_SECONDS = 5 * 60;

export interface RegisterPasskeyOptionsDto {
  usuarioId: UUID;
  email: string;
  password: string; // step-up
}

export interface RegisterPasskeyOptionsResultDto {
  challengeId: string;
  options: PublicKeyCredentialCreationOptionsJSON;
}

export class RegisterPasskeyOptions {
  constructor(
    private readonly stepUp: StepUpPasswordVerifier,
    private readonly mfaRepository: IMfaRepository,
    private readonly passkeyRepository: IPasskeyRepository
  ) {}

  async execute(dto: RegisterPasskeyOptionsDto): Promise<Result<RegisterPasskeyOptionsResultDto, PasskeyLimitReachedError | UnauthorizedError | import('@application/errors/NotFoundError').NotFoundError | Error>> {
    // 1. Step-up
    const stepUpResult = await this.stepUp.verify(dto.usuarioId, dto.password);
    if (stepUpResult.isFailure) {
      return failure(stepUpResult.error);
    }

    // 2. Tope de 5 passkeys activas
    const countResult = await this.passkeyRepository.countByUsuario(dto.usuarioId);
    if (countResult.isFailure) {
      return failure(countResult.error);
    }
    if (countResult.value >= MAX_PASSKEYS) {
      return failure(new PasskeyLimitReachedError());
    }

    // 3. Passkeys existentes para excludeCredentials (evita duplicar un dispositivo)
    const listResult = await this.passkeyRepository.listByUsuario(dto.usuarioId);
    if (listResult.isFailure) {
      return failure(listResult.error);
    }

    // 4. Opciones de registro: residentKey + userVerification required (D3)
    const config = getWebauthnConfig();
    const options = await generateRegistrationOptions({
      rpName: config.rpName,
      rpID: config.rpID,
      userName: dto.email,
      userID: new TextEncoder().encode(dto.usuarioId),
      attestationType: 'none',
      excludeCredentials: listResult.value
        .filter((passkey) => passkey.activo)
        .map((passkey) => ({ id: passkey.credentialId, transports: passkey.transports as never })),
      authenticatorSelection: {
        residentKey: 'required',
        userVerification: 'required',
      },
      supportedAlgorithmIDs: [-7, -257],
    });

    // 5. Challenge de un uso (5 min)
    const challengeResult = await this.mfaRepository.createWebauthnChallenge({
      usuarioId: dto.usuarioId,
      tipo: 'PASSKEY_REG',
      challenge: options.challenge,
      ttlSeconds: PASSKEY_REG_TTL_SECONDS,
    });
    if (challengeResult.isFailure) {
      return failure(challengeResult.error);
    }

    return success({ challengeId: challengeResult.value.id, options });
  }
}
