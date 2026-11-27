/**
 * Caso de uso: Solicitar el código de restablecimiento de contraseña
 * Genera un código de 6 dígitos, guarda solo su HMAC y lo envía por correo.
 * No revela si el correo existe. A diferencia de la verificación (item 3),
 * aquí NO se exige que el correo esté verificado: recuperar la cuenta es
 * justo para quien no puede entrar.
 */

import type { Result } from '@shared/result';
import { success, failure } from '@shared/result';
import type { IUsuarioRepository } from '@application/ports/repositories/IUsuarioRepository';
import type { IPasswordResetCodeRepository } from '@application/ports/repositories/IPasswordResetCodeRepository';
import type { IEmailService } from '@application/ports/external/IEmailService';
import type {
  RequestPasswordResetDto,
  RequestPasswordResetResponseDto,
} from '@application/dto/auth/PasswordResetDto';
import { Email } from '@domain/value-objects/Email';
import { ValidationError } from '@application/errors/ValidationError';
import {
  generateResetCode,
  hmacResetCode,
} from '@infrastructure/security/password-reset-crypto';

/** Vida del código: 15 minutos */
export const CODIGO_RESET_TTL_SEGUNDOS = 15 * 60;
/** Intentos de restablecimiento por código */
export const CODIGO_RESET_MAX_INTENTOS = 5;
/** Enfriamiento entre reenvíos: 60 segundos */
export const CODIGO_RESET_REENVIO_ESPERA_SEGUNDOS = 60;

export class RequestPasswordResetCode {
  constructor(
    private readonly usuarioRepository: IUsuarioRepository,
    private readonly codigoRepository: IPasswordResetCodeRepository,
    private readonly emailService: IEmailService
  ) {}

  async execute(
    dto: RequestPasswordResetDto
  ): Promise<Result<RequestPasswordResetResponseDto, ValidationError | Error>> {
    const emailResult = Email.create(dto.email);
    if (emailResult.isFailure) {
      return failure(ValidationError.create(emailResult.error.message, 'email', dto.email));
    }
    const email = emailResult.value;

    const userResult = await this.usuarioRepository.findByEmail(email);
    if (userResult.isFailure) {
      return failure(userResult.error);
    }
    const usuario = userResult.value;
    if (!usuario || !usuario.activo) {
      // No revelar si el correo existe ni si la cuenta está activa
      return success({
        emailSent: false,
        mensaje: 'Si el correo existe, recibirás un código para restablecer tu contraseña.',
      });
    }

    // Enfriamiento de reenvío: 60 s desde el último código creado
    const latestResult = await this.codigoRepository.findLatestByUsuarioId(usuario.id);
    if (latestResult.isFailure) {
      return failure(latestResult.error);
    }
    const latest = latestResult.value;
    if (
      latest &&
      !latest.usado &&
      Date.now() - latest.createdAt.getTime() <
        CODIGO_RESET_REENVIO_ESPERA_SEGUNDOS * 1000
    ) {
      return success({
        emailSent: false,
        mensaje: 'Espera un minuto antes de pedir otro código.',
      });
    }

    const codigo = generateResetCode();
    const createResult = await this.codigoRepository.create({
      usuarioId: usuario.id,
      codeHash: hmacResetCode(codigo),
      ttlSeconds: CODIGO_RESET_TTL_SEGUNDOS,
    });
    if (createResult.isFailure) {
      return failure(createResult.error);
    }

    const sendResult = await this.emailService.sendPasswordResetCodeEmail(
      email.value,
      usuario.nombre,
      codigo
    );
    if (!sendResult.success) {
      // El código queda guardado y vigente: se puede reenviar o usar si llega tarde
      return success({
        emailSent: false,
        mensaje: 'No se pudo enviar el correo con el código. Inténtalo de nuevo.',
      });
    }

    return success({
      emailSent: true,
      mensaje: 'Te hemos enviado un código de 6 dígitos a tu correo.',
    });
  }
}
