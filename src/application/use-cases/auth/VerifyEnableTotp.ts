/**
 * Caso de uso: confirmar y activar TOTP (step-up: contraseña)
 * Verifica el código contra el secret pendiente, activa el TOTP
 * y emite los 10 códigos de respaldo EN CLARO una única vez.
 */

import type { Result } from '@shared/result';
import { success, failure } from '@shared/result';
import type { UUID } from '@shared/types';
import type { IUsuarioRepository } from '@application/ports/repositories/IUsuarioRepository';
import type { IMfaRepository } from '@application/ports/repositories/IMfaRepository';
import type { IPasswordHasher } from '@application/ports/auth/IPasswordHasher';
import type { IEmailService } from '@application/ports/external/IEmailService';
import type { Usuario } from '@domain/entities/Usuario';
import { Password } from '@domain/value-objects/Password';
import { UnauthorizedError } from '@application/errors/UnauthorizedError';
import { NotFoundError } from '@application/errors/NotFoundError';
import { TotpCodeInvalidError, MfaNotSetupError, MfaSetupLockedError } from '@domain/errors/MfaError';
import { decryptSecret, generateBackupCodes, hmacBackupCode, normalizeBackupCode } from '@infrastructure/security/mfa-crypto';
import { verifyTotpCode } from '@infrastructure/security/totp';

const MAX_PENDING_ATTEMPTS = 5;
const TOTP_WINDOW_TOLERANCE = 31; // ±1 período de 30s
const BACKUP_CODES_COUNT = 10;

export interface TotpVerifyEnableDto {
  usuarioId: UUID;
  password: string; // step-up
  code: string; // 6 dígitos
}

export interface TotpVerifyEnableResultDto {
  mfaEnabled: true;
  backupCodes: string[];
}

export class VerifyEnableTotp {
  constructor(
    private readonly usuarioRepository: IUsuarioRepository,
    private readonly mfaRepository: IMfaRepository,
    private readonly passwordHasher: IPasswordHasher,
    private readonly emailService: IEmailService
  ) {}

  async execute(dto: TotpVerifyEnableDto): Promise<Result<TotpVerifyEnableResultDto, UnauthorizedError | NotFoundError | MfaNotSetupError | MfaSetupLockedError | TotpCodeInvalidError | Error>> {
    // 1. Step-up: contraseña
    const stepUpResult = await this.verifyPassword(dto.usuarioId, dto.password);
    if (stepUpResult.isFailure) {
      return failure(stepUpResult.error);
    }
    const usuario = stepUpResult.value;

    // 2. Máquina de estados
    if (usuario.totpEnabled) {
      return failure(new MfaNotSetupError());
    }
    if (!usuario.totpSecret) {
      return failure(new MfaNotSetupError());
    }

    // 3. Descifrar el secret pendiente y verificar el código
    let secret: string;
    try {
      secret = decryptSecret(usuario.totpSecret);
    } catch {
      return failure(new MfaNotSetupError());
    }

    const codeValid = verifyTotpCode(secret, dto.code, { toleranceSeconds: TOTP_WINDOW_TOLERANCE });

    if (!codeValid) {
      // Cap de intentos sobre el secret pendiente
      const attempts = usuario.recordTotpPendingFailure();
      await this.usuarioRepository.update(usuario);

      if (attempts >= MAX_PENDING_ATTEMPTS) {
        // Bloqueado: borra el secret pendiente (re-enrol tras re-login)
        usuario.disableTotp();
        await this.usuarioRepository.update(usuario);
        return failure(new MfaSetupLockedError());
      }
      return failure(new TotpCodeInvalidError());
    }

    // 4. Activar + emitir backup codes (hashes HMAC, no cifrado — ver spec §8)
    usuario.enableTotp();
    const saveResult = await this.usuarioRepository.update(usuario);
    if (saveResult.isFailure) {
      return failure(saveResult.error);
    }

    const backupCodes = generateBackupCodes(BACKUP_CODES_COUNT);
    // Se hashea la forma NORMALIZADA (sin guiones) para que el login compare igual
    const codeHashes = backupCodes.map((code) => hmacBackupCode(normalizeBackupCode(code)));
    const saveCodesResult = await this.mfaRepository.replaceBackupCodes(dto.usuarioId, codeHashes);
    if (saveCodesResult.isFailure) {
      return failure(saveCodesResult.error);
    }

    // 5. Notificación (no bloquea: si falla, queda en logs)
    this.emailService
      .sendEmail({
        to: usuario.email.value,
        subject: 'ListaCompra — Autenticación en dos pasos activada',
        text: 'Se ha activado el TOTP en tu cuenta de ListaCompra. Si no fuiste tú, contacta a soporte inmediatamente.',
      })
      .catch(() => {
        /* la mutación NO se revierte; el fallo queda en logs */
      });

    return success({ mfaEnabled: true, backupCodes });
  }

  private async verifyPassword(
    usuarioId: UUID,
    plainPassword: string
  ): Promise<Result<Usuario, UnauthorizedError | NotFoundError | Error>> {
    const userResult = await this.usuarioRepository.findById(usuarioId);
    if (userResult.isFailure) {
      return failure(userResult.error);
    }
    const usuario = userResult.value;
    if (!usuario) {
      return failure(NotFoundError.user(usuarioId));
    }

    const passResult = Password.create(plainPassword);
    if (passResult.isFailure) {
      return failure(UnauthorizedError.invalidCredentials());
    }

    const verifyResult = await this.passwordHasher.verify(passResult.value, usuario.password);
    if (verifyResult.isFailure) {
      return failure(verifyResult.error);
    }
    if (!verifyResult.value) {
      return failure(UnauthorizedError.invalidCredentials());
    }

    return success(usuario);
  }
}
