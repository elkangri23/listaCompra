/**
 * Caso de uso: Solicitar (o reenviar) el código de verificación de email
 * Genera un código de 6 dígitos, guarda solo su HMAC y lo envía por correo.
 * No revela si el correo existe ni si la cuenta ya está verificada.
 */

import type { Result } from '@shared/result';
import { success, failure } from '@shared/result';
import type { IUsuarioRepository } from '@application/ports/repositories/IUsuarioRepository';
import type { IEmailVerificationCodeRepository } from '@application/ports/repositories/IEmailVerificationCodeRepository';
import type { IEmailService } from '@application/ports/external/IEmailService';
import type {
  RequestVerificationCodeDto,
  RequestVerificationCodeResponseDto,
} from '@application/dto/auth/EmailVerificationDto';
import { Email } from '@domain/value-objects/Email';
import { ValidationError } from '@application/errors/ValidationError';
import {
  generateVerificationCode,
  hmacVerificationCode,
} from '@infrastructure/security/email-verification-crypto';

/** Vida del código: 15 minutos */
export const CODIGO_VERIFICACION_TTL_SEGUNDOS = 15 * 60;
/** Intentos de verificación por código */
export const CODIGO_VERIFICACION_MAX_INTENTOS = 5;
/** Enfriamiento entre reenvíos: 60 segundos */
export const CODIGO_VERIFICACION_REENVIO_ESPERA_SEGUNDOS = 60;

export class RequestEmailVerificationCode {
  constructor(
    private readonly usuarioRepository: IUsuarioRepository,
    private readonly codigoRepository: IEmailVerificationCodeRepository,
    private readonly emailService: IEmailService
  ) {}

  async execute(
    dto: RequestVerificationCodeDto
  ): Promise<Result<RequestVerificationCodeResponseDto, ValidationError | Error>> {
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
    if (!usuario) {
      // No revelar si el correo existe
      return success({
        emailSent: false,
        mensaje: 'Si el correo existe y la cuenta no está verificada, recibirás un código.',
      });
    }
    if (usuario.emailVerificado) {
      return success({ emailSent: false, mensaje: 'Tu correo ya está verificado.' });
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
        CODIGO_VERIFICACION_REENVIO_ESPERA_SEGUNDOS * 1000
    ) {
      return success({
        emailSent: false,
        mensaje: 'Espera un minuto antes de pedir otro código.',
      });
    }

    const codigo = generateVerificationCode();
    const createResult = await this.codigoRepository.create({
      usuarioId: usuario.id,
      codeHash: hmacVerificationCode(codigo),
      ttlSeconds: CODIGO_VERIFICACION_TTL_SEGUNDOS,
    });
    if (createResult.isFailure) {
      return failure(createResult.error);
    }

    const sendResult = await this.emailService.sendVerificationCodeEmail(
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
