/**
 * Caso de uso: paso 2 del login con MFA
 * Valida el challenge (un uso, 5 min, máx. 5 intentos) contra un código
 * TOTP o de respaldo y emite el par de tokens definitivo.
 */

import type { Result } from '@shared/result';
import { success, failure } from '@shared/result';
import type { IUsuarioRepository } from '@application/ports/repositories/IUsuarioRepository';
import type { IMfaRepository } from '@application/ports/repositories/IMfaRepository';
import type { ITokenService, TokenPayload } from '@application/ports/auth/ITokenService';
import type { UnauthorizedError } from '@application/errors/UnauthorizedError';
import {
  MfaChallengeExpiredError,
  MfaTooManyAttemptsError,
  TotpCodeInvalidError,
  BackupCodeInvalidError,
} from '@domain/errors/MfaError';
import {
  decryptSecret,
  normalizeBackupCode,
  hmacBackupCode,
  safeCompareHmac,
} from '@infrastructure/security/mfa-crypto';
import { verifyTotpCode } from '@infrastructure/security/totp';
import type { LoginResponseDto } from '@application/dto/auth/LoginDto';
import type { Usuario } from '@domain/entities/Usuario';

const MAX_CHALLENGE_ATTEMPTS = 5;
const TOTP_WINDOW_TOLERANCE = 31; // ±1 período de 30s

export interface MfaLoginDto {
  challengeId: string;
  /** Código TOTP de 6 dígitos (mutuamente excluyente con backupCode) */
  code?: string;
  /** Código de respaldo (mutuamente excluyente con code) */
  backupCode?: string;
}

export interface MfaLoginResultDto extends LoginResponseDto {
  mfaInfo: {
    method: 'TOTP' | 'BACKUP_CODE';
    backupUsed?: true;
  };
}

export class MfaLogin {
  constructor(
    private readonly usuarioRepository: IUsuarioRepository,
    private readonly mfaRepository: IMfaRepository,
    private readonly tokenService: ITokenService
  ) {}

  async execute(dto: MfaLoginDto): Promise<Result<MfaLoginResultDto, MfaChallengeExpiredError | MfaTooManyAttemptsError | TotpCodeInvalidError | BackupCodeInvalidError | UnauthorizedError | Error>> {
    // 1. Validar forma de la petición: exactamente una de las dos variantes
    if (!!dto.code === !!dto.backupCode) {
      return failure(new TotpCodeInvalidError());
    }

    // 2. Challenge válido (existe y no expiró)
    const challengeResult = await this.mfaRepository.findChallengeById(dto.challengeId);
    if (challengeResult.isFailure) {
      return failure(challengeResult.error);
    }
    const challenge = challengeResult.value;
    if (!challenge) {
      return failure(new MfaChallengeExpiredError());
    }
    if (challenge.expiraAt.getTime() <= Date.now()) {
      await this.mfaRepository.deleteChallenge(dto.challengeId);
      return failure(new MfaChallengeExpiredError());
    }
    if (challenge.tipo !== 'TOTP' || !challenge.usuarioId) {
      return failure(new MfaChallengeExpiredError());
    }

    const userResult = await this.usuarioRepository.findById(challenge.usuarioId);
    if (userResult.isFailure) {
      return failure(userResult.error);
    }
    const usuario = userResult.value;
    if (!usuario || !usuario.totpEnabled || !usuario.totpSecret) {
      return failure(new MfaChallengeExpiredError());
    }

    // 3. Verificar código o backup
    if (dto.code) {
      return this.loginWithTotp(dto, usuario);
    }
    return this.loginWithBackupCode(dto, usuario);
  }

  private async loginWithTotp(
    dto: MfaLoginDto,
    usuario: Usuario
  ): Promise<Result<MfaLoginResultDto, MfaChallengeExpiredError | MfaTooManyAttemptsError | TotpCodeInvalidError | Error>> {
    let secret: string;
    try {
      secret = decryptSecret(usuario.totpSecret as string);
    } catch {
      return failure(new MfaChallengeExpiredError());
    }

    const codeValid = verifyTotpCode(secret, dto.code as string, { toleranceSeconds: TOTP_WINDOW_TOLERANCE });

    if (!codeValid) {
      return this.registerFailedAttempt(dto.challengeId, new TotpCodeInvalidError());
    }

    // Éxito: consume el challenge (un uso) y emite tokens
    await this.mfaRepository.deleteChallenge(dto.challengeId);
    return this.issueTokens(usuario, { method: 'TOTP' });
  }

  private async loginWithBackupCode(
    dto: MfaLoginDto,
    usuario: Usuario
  ): Promise<Result<MfaLoginResultDto, MfaChallengeExpiredError | MfaTooManyAttemptsError | BackupCodeInvalidError | Error>> {
    const normalized = normalizeBackupCode(dto.backupCode as string);
    if (!normalized) {
      return this.registerFailedAttempt(dto.challengeId, new BackupCodeInvalidError());
    }

    const candidateHash = hmacBackupCode(normalized);
    const activeResult = await this.mfaRepository.listActiveBackupCodes(usuario.id);
    if (activeResult.isFailure) {
      return failure(activeResult.error);
    }


    let matchedId: string | null = null;
    for (const backupCode of activeResult.value) {
      if (safeCompareHmac(backupCode.codeHash, candidateHash)) {
        matchedId = backupCode.id;
        break;
      }
    }

    if (!matchedId) {
      return this.registerFailedAttempt(dto.challengeId, new BackupCodeInvalidError());
    }

    // Consumo atómico de un solo uso (race-safe)
    const consumedResult = await this.mfaRepository.consumeBackupCode(matchedId);
    if (consumedResult.isFailure || !consumedResult.value) {
      return this.registerFailedAttempt(dto.challengeId, new BackupCodeInvalidError());
    }

    await this.mfaRepository.deleteChallenge(dto.challengeId);
    return this.issueTokens(usuario, { method: 'BACKUP_CODE', backupUsed: true });
  }

  /** Incremento atómico con cap: 5 intentos → challenge borrado + 429 */
  private async registerFailedAttempt(
    challengeId: string,
    baseError: TotpCodeInvalidError | BackupCodeInvalidError
  ): Promise<Result<MfaLoginResultDto, MfaChallengeExpiredError | MfaTooManyAttemptsError | TotpCodeInvalidError | BackupCodeInvalidError | Error>> {
    const attemptsResult = await this.mfaRepository.incrementChallengeAttempts(challengeId, MAX_CHALLENGE_ATTEMPTS);
    if (attemptsResult.isSuccess && attemptsResult.value === -1) {
      // 0 filas actualizadas: ya bloqueado (o inexistente) → limpia y 429
      await this.mfaRepository.deleteChallenge(challengeId);
      return failure(new MfaTooManyAttemptsError());
    }
    if (attemptsResult.isSuccess && attemptsResult.value >= MAX_CHALLENGE_ATTEMPTS) {
      await this.mfaRepository.deleteChallenge(challengeId);
      return failure(new MfaTooManyAttemptsError());
    }
    return failure(baseError);
  }

  private async issueTokens(
    usuario: Usuario,
    mfaInfo: MfaLoginResultDto['mfaInfo']
  ): Promise<Result<MfaLoginResultDto, Error>> {
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
      mfaInfo,
    });
  }
}
