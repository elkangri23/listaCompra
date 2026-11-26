/**
 * Caso de uso: login con passkey (fase 2) — dos ceremonias:
 * 1. PasskeyLoginOptions (público): genera AuthenticationOptions + challenge
 *    PASSKEY_LOGIN de 2 min con usuarioId NULL (login usernameless, D3).
 * 2. PasskeyLoginVerify (público): verifica la aserción contra el challenge
 *    persistido, aplica la política de contador (4 casos de §5.3) y emite
 *    el JWT definitivo. El login con passkey NO pide TOTP (D2).
 */

import type { Result } from '@shared/result';
import { success, failure } from '@shared/result';
import type { IMfaRepository } from '@application/ports/repositories/IMfaRepository';
import type { IPasskeyRepository, PasskeyCredentialData } from '@application/ports/repositories/IPasskeyRepository';
import type { IUsuarioRepository } from '@application/ports/repositories/IUsuarioRepository';
import type { ITokenService, TokenPayload } from '@application/ports/auth/ITokenService';
import type { AuthenticationResponseJSON } from '@simplewebauthn/server';
import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import {
  MfaChallengeExpiredError,
  PasskeyUnknownCredentialError,
  PasskeyInactiveError,
  PasskeyVerificationError,
} from '@domain/errors/MfaError';
import { getWebauthnConfig } from '@infrastructure/security/webauthn-config';
import type { LoginResponseDto } from '@application/dto/auth/LoginDto';

export const PASSKEY_LOGIN_TTL_SECONDS = 2 * 60;

// ============================================================================
// PasskeyLoginOptions
// ============================================================================

export interface PasskeyLoginOptionsResultDto {
  challengeId: string;
  options: Awaited<ReturnType<typeof generateAuthenticationOptions>>;
}

export class PasskeyLoginOptions {
  constructor(private readonly mfaRepository: IMfaRepository) {}

  async execute(): Promise<Result<PasskeyLoginOptionsResultDto, Error>> {
    const options = await generateAuthenticationOptions({
      rpID: getWebauthnConfig().rpID,
      // Discoverable credentials: sin allowCredentials → usernameless
      allowCredentials: [],
      userVerification: 'required',
    });

    const challengeResult = await this.mfaRepository.createWebauthnChallenge({
      usuarioId: null,
      tipo: 'PASSKEY_LOGIN',
      challenge: options.challenge,
      ttlSeconds: PASSKEY_LOGIN_TTL_SECONDS,
    });
    if (challengeResult.isFailure) {
      return failure(challengeResult.error);
    }

    return success({ challengeId: challengeResult.value.id, options });
  }
}

// ============================================================================
// PasskeyLoginVerify
// ============================================================================

export interface PasskeyLoginVerifyDto {
  challengeId: string;
  credential: AuthenticationResponseJSON;
}

export interface PasskeyLoginResultDto extends LoginResponseDto {
  mfaInfo: {
    method: 'PASSKEY';
  };
}

export class PasskeyLoginVerify {
  constructor(
    private readonly mfaRepository: IMfaRepository,
    private readonly passkeyRepository: IPasskeyRepository,
    private readonly usuarioRepository: IUsuarioRepository,
    private readonly tokenService: ITokenService
  ) {}

  async execute(dto: PasskeyLoginVerifyDto): Promise<Result<PasskeyLoginResultDto, MfaChallengeExpiredError | PasskeyUnknownCredentialError | PasskeyInactiveError | PasskeyVerificationError | Error>> {
    // 1. Challenge PASSKEY_LOGIN vigente (2 min, un uso)
    const challengeResult = await this.mfaRepository.findChallengeById(dto.challengeId);
    if (challengeResult.isFailure) {
      return failure(challengeResult.error);
    }
    const challenge = challengeResult.value;
    if (!challenge || challenge.tipo !== 'PASSKEY_LOGIN') {
      return failure(new MfaChallengeExpiredError());
    }
    if (challenge.expiraAt.getTime() <= Date.now() || !challenge.challenge) {
      await this.mfaRepository.deleteChallenge(dto.challengeId);
      return failure(new MfaChallengeExpiredError());
    }

    // 2. La credencial identificada por credentialId debe existir
    const credentialId = dto.credential?.id;
    if (!credentialId || typeof credentialId !== 'string') {
      return failure(new PasskeyUnknownCredentialError());
    }
    const findResult = await this.passkeyRepository.findByCredentialId(credentialId);
    if (findResult.isFailure) {
      return failure(findResult.error);
    }
    const passkey = findResult.value;
    if (!passkey) {
      // No revela más de lo necesario: credencial no reconocida
      return failure(new PasskeyUnknownCredentialError());
    }
    if (!passkey.activo) {
      return failure(new PasskeyInactiveError());
    }

    // 3. Verificar la aserción con la CLAVE ALMACENADA (no la que llega)
    const config = getWebauthnConfig();
    let verification: Awaited<ReturnType<typeof verifyAuthenticationResponse>>;
    try {
      verification = await verifyAuthenticationResponse({
        response: dto.credential,
        expectedChallenge: challenge.challenge,
        expectedOrigin: config.origins,
        expectedRPID: config.rpID,
        credential: {
          id: passkey.credentialId,
          publicKey: new Uint8Array(passkey.publicKey),
          counter: passkey.contador,
          transports: passkey.transports as never,
        },
        requireUserVerification: true,
      });
    } catch {
      return failure(new PasskeyVerificationError());
    }

    if (!verification.verified) {
      return failure(new PasskeyVerificationError());
    }

    // 4. Política de contador (§5.3 — 4 casos):
    const newCounter = verification.authenticationInfo.newCounter;
    const counterError = await this.applyCounterPolicy(passkey, newCounter);
    if (counterError) {
      return failure(counterError);
    }

    // 5. Usuario dueño de la credencial
    const userResult = await this.usuarioRepository.findById(passkey.usuarioId);
    if (userResult.isFailure) {
      return failure(userResult.error);
    }
    const usuario = userResult.value;
    if (!usuario || !usuario.activo) {
      return failure(new PasskeyUnknownCredentialError());
    }

    // 6. Consumir challenge y emitir JWT definitivo (sin pedir TOTP — D2)
    await this.mfaRepository.deleteChallenge(dto.challengeId);

    const tokenPayload: TokenPayload = {
      userId: usuario.id,
      email: usuario.email.value,
      role: usuario.rol,
    };
    const tokensResult = await this.tokenService.generateTokenPair(tokenPayload);
    if (tokensResult.isFailure) {
      return failure(tokensResult.error);
    }
    const tokens = tokensResult.value;

    return success({
      user: {
        id: usuario.id,
        email: usuario.email.value,
        nombre: usuario.nombre,
        ...(usuario.apellidos && { apellidos: usuario.apellidos }),
        nombreCompleto: usuario.nombreCompleto,
        rol: usuario.rol,
        activo: usuario.activo,
        emailVerificado: usuario.emailVerificado,
      },
      tokens: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      },
      mfaInfo: { method: 'PASSKEY' },
    });
  }

  /**
   * 4 casos del spec:
   * - stored=0 ∧ assertion=0 → aceptar (passkeys sincronizadas siempre 0)
   * - stored>0 ∧ assertion≤stored → REGRESIÓN de contador → activo=false + rechazo
   * - stored>0 ∧ assertion>stored → normal, persistir
   * (stored=0 ∧ assertion>0 cae en el camino normal de persistir)
   * Devuelve el error de dominio a propagar, o null si se acepta.
   */
  private async applyCounterPolicy(
    passkey: PasskeyCredentialData,
    newCounter: number
  ): Promise<PasskeyVerificationError | null> {
    if (passkey.contador > 0 && newCounter <= passkey.contador) {
      // Regresión: posible clon del autenticador → bloquear credencial
      await this.passkeyRepository.deactivate(passkey.id);
      return new PasskeyVerificationError(
        'Passkey bloqueada por seguridad (posible clon). Inicia sesión con otra y crea una nueva.'
      );
    }
    if (newCounter > passkey.contador) {
      await this.passkeyRepository.updateCounterAndUsage(passkey.id, newCounter);
      return null;
    }
    // contador 0 → 0: aceptar sin persistir contador
    await this.passkeyRepository.updateCounterAndUsage(passkey.id, passkey.contador);
    return null;
  }
}
