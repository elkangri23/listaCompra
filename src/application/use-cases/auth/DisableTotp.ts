/**
 * Caso de uso: desactivar TOTP (step-up: contraseña + código vigente)
 * Idempotente: sin TOTP activo ni pendiente → 200 equivalente.
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
import { TotpCodeInvalidError } from '@domain/errors/MfaError';
import { decryptSecret, normalizeBackupCode, hmacBackupCode, safeCompareHmac } from '@infrastructure/security/mfa-crypto';
import { verifyTotpCode } from '@infrastructure/security/totp';

const TOTP_WINDOW_TOLERANCE = 31; // ±1 período de 30s

export interface TotpDisableDto {
  usuarioId: UUID;
  password: string; // step-up
  /** Código TOTP o de respaldo vigente — requerido si totpEnabled */
  code?: string;
}

export interface TotpDisableResultDto {
  mfaEnabled: false;
}

export class DisableTotp {
  constructor(
    private readonly usuarioRepository: IUsuarioRepository,
    private readonly mfaRepository: IMfaRepository,
    private readonly passwordHasher: IPasswordHasher,
    private readonly emailService: IEmailService
  ) {}

  async execute(dto: TotpDisableDto): Promise<Result<TotpDisableResultDto, UnauthorizedError | NotFoundError | TotpCodeInvalidError | Error>> {
    // 1. Step-up: contraseña
    const stepUpResult = await this.verifyPassword(dto.usuarioId, dto.password);
    if (stepUpResult.isFailure) {
      return failure(stepUpResult.error);
    }
    const usuario = stepUpResult.value;

    // 2. Idempotente: sin TOTP (ni activo ni pendiente) → éxito sin acción
    if (!usuario.totpSecret) {
      return success({ mfaEnabled: false });
    }

    // 3. Si estaba ACTIVO, exigir código vigente (TOTP o backup)
    if (usuario.totpEnabled) {
      if (!dto.code) {
        return failure(new TotpCodeInvalidError());
      }
      const codeValid = await this.verifyCode(usuario, dto.code);
      if (!codeValid) {
        return failure(new TotpCodeInvalidError());
      }
    }

    // 4. Desactivar: borra secret + backups + estado pendiente
    usuario.disableTotp();
    const saveResult = await this.usuarioRepository.update(usuario);
    if (saveResult.isFailure) {
      return failure(saveResult.error);
    }

    const deleteCodesResult = await this.mfaRepository.deleteBackupCodes(dto.usuarioId);
    if (deleteCodesResult.isFailure) {
      return failure(deleteCodesResult.error);
    }

    // 5. Notificación (no bloquea)
    this.emailService
      .sendEmail({
        to: usuario.email.value,
        subject: 'ListaCompra — Autenticación en dos pasos desactivada',
        text: 'Se ha desactivado el TOTP en tu cuenta de ListaCompra. Si no fuiste tú, contacta a soporte inmediatamente.',
      })
      .catch(() => {
        /* fallo de email queda en logs, no revierte la mutación */
      });

    return success({ mfaEnabled: false });
  }

  private async verifyCode(usuario: Usuario, code: string): Promise<boolean> {
    if (!usuario.totpSecret) return false;

    // a) Intento como código TOTP (6 dígitos)
    if (/^\d{6}$/.test(code) && usuario.totpSecret) {
      try {
        const secret = decryptSecret(usuario.totpSecret);
        if (verifyTotpCode(secret, code, { toleranceSeconds: TOTP_WINDOW_TOLERANCE })) return true;
      } catch {
        /* cae a intento de backup */
      }
    }

    // b) Intento como código de respaldo (HMAC timing-safe, solo no usados)
    const normalized = normalizeBackupCode(code);
    if (!normalized) return false;
    const candidateHash = hmacBackupCode(normalized);
    const activeResult = await this.mfaRepository.listActiveBackupCodes(usuario.id);
    if (activeResult.isFailure) return false;

    for (const backupCode of activeResult.value) {
      if (safeCompareHmac(backupCode.codeHash, candidateHash)) {
        const consumedResult = await this.mfaRepository.consumeBackupCode(backupCode.id);
        return consumedResult.isSuccess && consumedResult.value;
      }
    }

    return false;
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
