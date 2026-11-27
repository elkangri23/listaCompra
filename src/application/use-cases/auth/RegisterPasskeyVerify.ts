/**
 * Caso de uso: verificar y registrar una passkey (step-up: contraseña)
 * Recibe RegistrationResponseJSON + challengeId; verifica la ceremonia con
 * @simplewebauthn y persiste la credencial. El challenge se consume (un uso):
 * si la verificación falla, la fila se BORRA (el cliente pide opciones nuevas).
 */

import type { Result } from '@shared/result';
import { success, failure } from '@shared/result';
import type { UUID } from '@shared/types';
import type { IMfaRepository } from '@application/ports/repositories/IMfaRepository';
import type { IPasskeyRepository } from '@application/ports/repositories/IPasskeyRepository';
import type { StepUpPasswordVerifier } from './StepUpPasswordVerifier';
import type { RegistrationResponseJSON } from '@simplewebauthn/server';
import {
  verifyRegistrationResponse,
  type WebAuthnCredential,
} from '@simplewebauthn/server';
import {
  MfaChallengeExpiredError,
  PasskeyLimitReachedError,
  PasskeyVerificationError,
} from '@domain/errors/MfaError';
import type { UnauthorizedError } from '@application/errors/UnauthorizedError';
import type { NotFoundError } from '@application/errors/NotFoundError';
import { getWebauthnConfig } from '@infrastructure/security/webauthn-config';
import { MAX_PASSKEYS } from './RegisterPasskeyOptions';

export interface RegisterPasskeyVerifyDto {
  usuarioId: UUID;
  email: string;
  password: string; // step-up
  challengeId: string;
  credential: RegistrationResponseJSON;
}

export interface RegisterPasskeyVerifyResultDto {
  passkeyId: string;
  nombre: string;
}

export class RegisterPasskeyVerify {
  constructor(
    private readonly stepUp: StepUpPasswordVerifier,
    private readonly mfaRepository: IMfaRepository,
    private readonly passkeyRepository: IPasskeyRepository
  ) {}

  async execute(dto: RegisterPasskeyVerifyDto): Promise<Result<RegisterPasskeyVerifyResultDto, MfaChallengeExpiredError | PasskeyLimitReachedError | PasskeyVerificationError | UnauthorizedError | NotFoundError | Error>> {
    // 1. Step-up
    const stepUpResult = await this.stepUp.verify(dto.usuarioId, dto.password);
    if (stepUpResult.isFailure) {
      return failure(stepUpResult.error);
    }

    // 2. Challenge vigente del tipo PASSKEY_REG y del propio usuario
    const challengeResult = await this.mfaRepository.findChallengeById(dto.challengeId);
    if (challengeResult.isFailure) {
      return failure(challengeResult.error);
    }
    const challenge = challengeResult.value;
    if (!challenge || challenge.tipo !== 'PASSKEY_REG' || challenge.usuarioId !== dto.usuarioId) {
      return failure(new MfaChallengeExpiredError());
    }
    if (challenge.expiraAt.getTime() <= Date.now() || !challenge.challenge) {
      await this.mfaRepository.deleteChallenge(dto.challengeId);
      return failure(new MfaChallengeExpiredError());
    }

    // 3. Verificar la ceremonia WebAuthn
    const config = getWebauthnConfig();
    let verification: Awaited<ReturnType<typeof verifyRegistrationResponse>>;
    try {
      verification = await verifyRegistrationResponse({
        response: dto.credential,
        expectedChallenge: challenge.challenge,
        expectedOrigin: config.origins,
        expectedRPID: config.rpID,
        requireUserVerification: true,
      });
    } catch (error) {
      // La fila se borra: el cliente pide opciones nuevas (estado pendiente no cambia)
      await this.mfaRepository.deleteChallenge(dto.challengeId);
      // El detalle queda fuera de la respuesta; trace en desarrollo
      return failure(new PasskeyVerificationError());
    }

    if (!verification.verified || !verification.registrationInfo) {
      await this.mfaRepository.deleteChallenge(dto.challengeId);
      return failure(new PasskeyVerificationError());
    }

    const { credential, credentialDeviceType, aaguid } = verification.registrationInfo;

    // 4. Re-chequeo del tope de 5 (condición de carrera con otra sesión)
    const countResult = await this.passkeyRepository.countByUsuario(dto.usuarioId);
    if (countResult.isFailure) {
      return failure(countResult.error);
    }
    if (countResult.value >= MAX_PASSKEYS) {
      await this.mfaRepository.deleteChallenge(dto.challengeId);
      return failure(new PasskeyLimitReachedError());
    }

    // 5. Persistir la credencial
    const createdResult = await this.passkeyRepository.create({
      credentialId: credential.id,
      usuarioId: dto.usuarioId,
      publicKey: Buffer.from(credential.publicKey),
      contador: credential.counter,
      transports: credential.transports ?? [],
      deviceType: credentialDeviceType,
      aaguid: aaguid || null,
      nombre: 'Passkey',
    });
    if (createdResult.isFailure) {
      return failure(createdResult.error);
    }

    // 6. Consumir el challenge (un uso) — éxito
    await this.mfaRepository.deleteChallenge(dto.challengeId);

    return success({ passkeyId: createdResult.value.id, nombre: createdResult.value.nombre });
  }
}

/** Tipo reexportado para el controlador (credential del navegador) */
export type { RegistrationResponseJSON, WebAuthnCredential };
