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
import type { ILoginAttemptRecorder } from '@application/ports/external/ILoginAttemptRecorder';

const MAX_CHALLENGE_ATTEMPTS = 5;
const TOTP_WINDOW_TOLERANCE = 31; // ±1 período de 30s

export interface MfaLoginDto {
  challengeId: string;
  /** Código TOTP de 6 dígitos (mutuamente excluyente con backupCode) */
  code?: string;
  /** Código de respaldo (mutuamente excluyente con code) */
  backupCode?: string;
  /**
   * Metadatos del intento (los pone el controlador desde la request).
   * Solo para el registro de intentos de inicio de sesión.
   */
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
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
    private readonly tokenService: ITokenService,
    // Registro best-effort de intentos de login (fase 5): sin él, el
    // login funciona exactamente igual (el recorder es opcional).
    private readonly loginAttemptRecorder?: ILoginAttemptRecorder
  ) {}

  /**
   * Registra el intento sin romper nunca el login: el recorder ya
   * traga sus propios errores; esto es defensa en profundidad.
   */
  private async recordAttempt(input: {
    email: string;
    success: boolean;
    reason?: 'MFA_FAILED' | null | undefined;
    ipAddress?: string | null | undefined;
    userAgent?: string | null | undefined;
  }): Promise<void> {
    if (!this.loginAttemptRecorder) {
      return;
    }
    try {
      await this.loginAttemptRecorder.record(input);
    } catch {
      // Best-effort: un fallo de telemetría nunca rompe el login.
    }
  }

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
      await this.recordAttempt({
        email: usuario.email.value,
        success: false,
        reason: 'MFA_FAILED',
        ipAddress: dto.ipAddress,
        userAgent: dto.userAgent,
      });
      return this.registerFailedAttempt(dto.challengeId, new TotpCodeInvalidError());
    }

    // Éxito: consume el challenge (un uso) y emite tokens
    await this.mfaRepository.deleteChallenge(dto.challengeId);
    return this.issueTokens(usuario, { method: 'TOTP' }, dto);
  }

  private async loginWithBackupCode(
    dto: MfaLoginDto,
    usuario: Usuario
  ): Promise<Result<MfaLoginResultDto, MfaChallengeExpiredError | MfaTooManyAttemptsError | BackupCodeInvalidError | Error>> {
    const normalized = normalizeBackupCode(dto.backupCode as string);
    if (!normalized) {
      await this.recordAttempt({
        email: usuario.email.value,
        success: false,
        reason: 'MFA_FAILED',
        ipAddress: dto.ipAddress,
        userAgent: dto.userAgent,
      });
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
      await this.recordAttempt({
        email: usuario.email.value,
        success: false,
        reason: 'MFA_FAILED',
        ipAddress: dto.ipAddress,
        userAgent: dto.userAgent,
      });
      return this.registerFailedAttempt(dto.challengeId, new BackupCodeInvalidError());
    }

    // Consumo atómico de un solo uso (race-safe)
    const consumedResult = await this.mfaRepository.consumeBackupCode(matchedId);
    if (consumedResult.isFailure || !consumedResult.value) {
      await this.recordAttempt({
        email: usuario.email.value,
        success: false,
        reason: 'MFA_FAILED',
        ipAddress: dto.ipAddress,
        userAgent: dto.userAgent,
      });
      return this.registerFailedAttempt(dto.challengeId, new BackupCodeInvalidError());
    }

    await this.mfaRepository.deleteChallenge(dto.challengeId);
    return this.issueTokens(usuario, { method: 'BACKUP_CODE', backupUsed: true }, dto);
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
    mfaInfo: MfaLoginResultDto['mfaInfo'],
    dto: MfaLoginDto
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

    // Paso 2 completado: este es el login efectivo del usuario con MFA
    // (el paso 1 solo emite el challenge y no se registra).
    await this.recordAttempt({
      email: usuario.email.value,
      success: true,
      reason: null,
      ipAddress: dto.ipAddress,
      userAgent: dto.userAgent,
    });

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
