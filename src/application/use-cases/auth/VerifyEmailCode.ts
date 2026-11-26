/**
 * Caso de uso: Verificar el email con el código de 6 dígitos (item 3)
 * Compara el HMAC del código, cuenta los intentos y marca el correo
 * como verificado. Los errores son genéricos para no revelar si el
 * correo existe, si hay un código pendiente o cuántos intentos quedan
 * (salvo el conteo restante tras un fallo, que es del propio usuario).
 */

import type { Result } from '@shared/result';
import { success, failure } from '@shared/result';
import type { IUsuarioRepository } from '@application/ports/repositories/IUsuarioRepository';
import type { IEmailVerificationCodeRepository } from '@application/ports/repositories/IEmailVerificationCodeRepository';
import type {
  VerifyEmailCodeDto,
  VerifyEmailCodeResponseDto,
} from '@application/dto/auth/EmailVerificationDto';
import { Email } from '@domain/value-objects/Email';
import { UnauthorizedError } from '@application/errors/UnauthorizedError';
import {
  normalizeVerificationCode,
  hmacVerificationCode,
  safeCompareHmac,
} from '@infrastructure/security/email-verification-crypto';
import { CODIGO_VERIFICACION_MAX_INTENTOS } from './RequestEmailVerificationCode';

const MENSAJE_GENERICO = 'El código no es válido o ha caducado.';

export class VerifyEmailCode {
  constructor(
    private readonly usuarioRepository: IUsuarioRepository,
    private readonly codigoRepository: IEmailVerificationCodeRepository
  ) {}

  async execute(
    dto: VerifyEmailCodeDto
  ): Promise<Result<VerifyEmailCodeResponseDto, UnauthorizedError | Error>> {
    const normalized = normalizeVerificationCode(dto.codigo);
    const emailResult = Email.create(dto.email);
    if (emailResult.isFailure || !normalized) {
      return failure(new UnauthorizedError(MENSAJE_GENERICO));
    }
    const email = emailResult.value;

    const userResult = await this.usuarioRepository.findByEmail(email);
    if (userResult.isFailure) {
      return failure(userResult.error);
    }
    const usuario = userResult.value;
    if (!usuario) {
      return failure(new UnauthorizedError(MENSAJE_GENERICO));
    }
    // Idempotente: si el correo ya está verificado, no hay nada que hacer
    if (usuario.emailVerificado) {
      return success({
        emailVerificado: true,
        mensaje: 'Tu correo ya estaba verificado. Ya puedes entrar.',
      });
    }

    const pendingResult = await this.codigoRepository.findLatestPendingByUsuarioId(usuario.id);
    if (pendingResult.isFailure) {
      return failure(pendingResult.error);
    }
    const pending = pendingResult.value;
    if (!pending || pending.intentos >= CODIGO_VERIFICACION_MAX_INTENTOS) {
      return failure(new UnauthorizedError(MENSAJE_GENERICO));
    }

    const candidateHash = hmacVerificationCode(normalized);
    if (!safeCompareHmac(pending.codeHash, candidateHash)) {
      const incResult = await this.codigoRepository.incrementAttempts(
        pending.id,
        CODIGO_VERIFICACION_MAX_INTENTOS
      );
      if (incResult.isFailure) {
        return failure(incResult.error);
      }
      if (incResult.value <= 0) {
        return failure(new UnauthorizedError(MENSAJE_GENERICO));
      }
      const restantes = CODIGO_VERIFICACION_MAX_INTENTOS - incResult.value;
      const mensaje =
        restantes > 0 ? `Código incorrecto. Te quedan ${restantes} intentos.` : MENSAJE_GENERICO;
      return failure(new UnauthorizedError(mensaje));
    }

    const usedResult = await this.codigoRepository.markUsed(pending.id);
    if (usedResult.isFailure) {
      return failure(usedResult.error);
    }

    const verifyResult = usuario.verificarEmail();
    if (verifyResult.isFailure) {
      return failure(new UnauthorizedError(MENSAJE_GENERICO));
    }
    const updateResult = await this.usuarioRepository.update(usuario);
    if (updateResult.isFailure) {
      return failure(updateResult.error);
    }

    return success({
      emailVerificado: true,
      mensaje: 'Tu correo ha sido verificado. Ya puedes entrar.',
    });
  }
}
