/**
 * Caso de uso: Restablecer la contraseña con el código de 6 dígitos (item 9c)
 * Compara el HMAC del código, cuenta los intentos y cambia la contraseña.
 * Los errores son genéricos para no revelar si el correo existe, si hay un
 * código pendiente o cuántos intentos quedan (salvo el conteo restante tras
 * un fallo, que es del propio usuario).
 */

import type { Result } from '@shared/result';
import { success, failure } from '@shared/result';
import type { IUsuarioRepository } from '@application/ports/repositories/IUsuarioRepository';
import type { IPasswordResetCodeRepository } from '@application/ports/repositories/IPasswordResetCodeRepository';
import type { IPasswordHasher } from '@application/ports/auth/IPasswordHasher';
import type {
  ResetPasswordDto,
  ResetPasswordResponseDto,
} from '@application/dto/auth/PasswordResetDto';
import { Email } from '@domain/value-objects/Email';
import { Password } from '@domain/value-objects/Password';
import { UnauthorizedError } from '@application/errors/UnauthorizedError';
import { ValidationError } from '@application/errors/ValidationError';
import {
  normalizeResetCode,
  hmacResetCode,
  safeCompareHmac,
} from '@infrastructure/security/password-reset-crypto';
import { CODIGO_RESET_MAX_INTENTOS } from './RequestPasswordResetCode';

const MENSAJE_GENERICO = 'El código no es válido o ha caducado.';

export class ResetPasswordWithCode {
  constructor(
    private readonly usuarioRepository: IUsuarioRepository,
    private readonly codigoRepository: IPasswordResetCodeRepository,
    private readonly passwordHasher: IPasswordHasher
  ) {}

  async execute(
    dto: ResetPasswordDto
  ): Promise<Result<ResetPasswordResponseDto, UnauthorizedError | ValidationError | Error>> {
    const normalized = normalizeResetCode(dto.codigo);
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
    if (!usuario || !usuario.activo) {
      return failure(new UnauthorizedError(MENSAJE_GENERICO));
    }

    const pendingResult = await this.codigoRepository.findLatestPendingByUsuarioId(usuario.id);
    if (pendingResult.isFailure) {
      return failure(pendingResult.error);
    }
    const pending = pendingResult.value;
    if (!pending || pending.intentos >= CODIGO_RESET_MAX_INTENTOS) {
      return failure(new UnauthorizedError(MENSAJE_GENERICO));
    }

    const candidateHash = hmacResetCode(normalized);
    if (!safeCompareHmac(pending.codeHash, candidateHash)) {
      const incResult = await this.codigoRepository.incrementAttempts(
        pending.id,
        CODIGO_RESET_MAX_INTENTOS
      );
      if (incResult.isFailure) {
        return failure(incResult.error);
      }
      if (incResult.value <= 0) {
        return failure(new UnauthorizedError(MENSAJE_GENERICO));
      }
      const restantes = CODIGO_RESET_MAX_INTENTOS - incResult.value;
      const mensaje =
        restantes > 0 ? `Código incorrecto. Te quedan ${restantes} intentos.` : MENSAJE_GENERICO;
      return failure(new UnauthorizedError(mensaje));
    }

    // Código correcto: validar la nueva contraseña antes de consumirlo
    const newResult = Password.create(dto.nuevaPassword);
    if (newResult.isFailure) {
      return failure(new ValidationError(
        'La nueva contraseña no cumple los requisitos (mínimo 8 caracteres, mayúscula, minúscula y número)',
        'nuevaPassword',
        ''
      ));
    }
    const hashResult = await this.passwordHasher.hash(newResult.value);
    if (hashResult.isFailure) {
      return failure(new ValidationError('No se pudo guardar la nueva contraseña', 'nuevaPassword', ''));
    }

    const usedResult = await this.codigoRepository.markUsed(pending.id);
    if (usedResult.isFailure) {
      return failure(usedResult.error);
    }

    const updatePasswordResult = usuario.actualizarPassword(hashResult.value);
    if (updatePasswordResult.isFailure) {
      return failure(new ValidationError(updatePasswordResult.error.message, 'nuevaPassword', ''));
    }
    const updateResult = await this.usuarioRepository.update(usuario);
    if (updateResult.isFailure) {
      return failure(updateResult.error);
    }

    return success({
      mensaje: 'Tu contraseña ha sido cambiada. Ya puedes entrar con la nueva.',
    });
  }
}
