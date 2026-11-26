/**
 * Caso de uso: iniciar configuración de TOTP (step-up: contraseña)
 * Genera un secret, lo guarda cifrado en estado "pendiente de confirmar"
 * y devuelve otpauthUrl + QR para escanear.
 */

import type { Result } from '@shared/result';
import { success, failure } from '@shared/result';
import type { UUID } from '@shared/types';
import type { IUsuarioRepository } from '@application/ports/repositories/IUsuarioRepository';
import type { IPasswordHasher } from '@application/ports/auth/IPasswordHasher';
import { Password } from '@domain/value-objects/Password';
import { UnauthorizedError } from '@application/errors/UnauthorizedError';
import { NotFoundError } from '@application/errors/NotFoundError';
import { MfaAlreadyEnabledError } from '@domain/errors/MfaError';
import * as QRCode from 'qrcode';
import { encryptSecret } from '@infrastructure/security/mfa-crypto';
import { generateTotpSecret, buildOtpauthUrl } from '@infrastructure/security/totp';

export interface TotpSetupDto {
  usuarioId: UUID;
  password: string; // step-up
}

export interface TotpSetupResultDto {
  otpauthUrl: string;
  qrDataUrl: string;
}

export class SetupTotp {
  constructor(
    private readonly usuarioRepository: IUsuarioRepository,
    private readonly passwordHasher: IPasswordHasher
  ) {}

  async execute(dto: TotpSetupDto): Promise<Result<TotpSetupResultDto, UnauthorizedError | NotFoundError | MfaAlreadyEnabledError | Error>> {
    // 1. Step-up: verificar contraseña actual
    const stepUpResult = await this.verifyPassword(dto.usuarioId, dto.password);
    if (stepUpResult.isFailure) {
      return failure(stepUpResult.error);
    }
    const usuario = stepUpResult.value;

    // 2. Máquina de estados: activo → 409
    if (usuario.totpEnabled) {
      return failure(new MfaAlreadyEnabledError());
    }

    // 3. Generar secret + otpauth (SHA-1, 6 dígitos, 30s — defaults universales)
    const secret = generateTotpSecret();
    const otpauthUrl = buildOtpauthUrl('ListaCompra', usuario.email.value, secret);

    // 4. Cifrar y guardar en estado pendiente
    usuario.setTotpPending(encryptSecret(secret));
    const saveResult = await this.usuarioRepository.update(usuario);
    if (saveResult.isFailure) {
      return failure(saveResult.error);
    }

    // 5. QR data URL (fallback manual: el secret viaja dentro del otpauthUrl)
    const qrDataUrl = await QRCode.toDataURL(otpauthUrl);

    return success({ otpauthUrl, qrDataUrl });
  }

  private async verifyPassword(
    usuarioId: UUID,
    plainPassword: string
  ): Promise<Result<import('@domain/entities/Usuario').Usuario, UnauthorizedError | NotFoundError | Error>> {
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
