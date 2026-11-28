/**
 * Caso de uso: Autenticar usuario
 * Orquesta el proceso de autenticación de un usuario existente
 */

import type { Result } from '@shared/result';
import { success, failure } from '@shared/result';
import type { IUsuarioRepository } from '@application/ports/repositories/IUsuarioRepository';
import type { IPasswordHasher } from '@application/ports/auth/IPasswordHasher';
import type { ITokenService } from '@application/ports/auth/ITokenService';
import type { IMfaRepository } from '@application/ports/repositories/IMfaRepository';
import type { ILoginAttemptRecorder } from '@application/ports/external/ILoginAttemptRecorder';
import type { LoginAttemptReason } from '@application/ports/repositories/ILoginAttemptRepository';
import type { LoginDto, LoginResponseDto } from '@application/dto/auth/LoginDto';
import type { LoginMfaRequiredDto } from '@application/dto/auth/LoginDto';
import { Email } from '@domain/value-objects/Email';
import { Password } from '@domain/value-objects/Password';
import { ValidationError } from '@application/errors/ValidationError';
import { UnauthorizedError } from '@application/errors/UnauthorizedError';
import type { NotFoundError } from '@application/errors/NotFoundError';

export class AuthenticateUser {
  constructor(
    private readonly usuarioRepository: IUsuarioRepository,
    private readonly passwordHasher: IPasswordHasher,
    private readonly tokenService: ITokenService,
    private readonly mfaRepository?: IMfaRepository,
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
    reason?: LoginAttemptReason | null | undefined;
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

  async execute(dto: LoginDto): Promise<Result<LoginResponseDto | LoginMfaRequiredDto, ValidationError | UnauthorizedError | NotFoundError | Error>> {
    // 1. Validar y crear email
    const emailResult = Email.create(dto.email);
    if (emailResult.isFailure) {
      return failure(ValidationError.create(
        emailResult.error.message,
        'email',
        dto.email
      ));
    }
    const email = emailResult.value;

    // 2. Validar contraseña
    const passwordResult = Password.create(dto.password);
    if (passwordResult.isFailure) {
      await this.recordAttempt({
        email: email.value,
        success: false,
        reason: 'WRONG_PASSWORD',
        ipAddress: dto.ipAddress,
        userAgent: dto.userAgent,
      });
      return failure(ValidationError.create(
        passwordResult.error.message,
        'password',
        '[HIDDEN]'
      ));
    }
    const password = passwordResult.value;

    // 3. Buscar usuario por email
    const userResult = await this.usuarioRepository.findByEmail(email);
    if (userResult.isFailure) {
      return failure(userResult.error);
    }

    const usuario = userResult.value;
    if (!usuario) {
      await this.recordAttempt({
        email: email.value,
        success: false,
        reason: 'USER_NOT_FOUND',
        ipAddress: dto.ipAddress,
        userAgent: dto.userAgent,
      });
      return failure(UnauthorizedError.invalidCredentials());
    }

    // 4. Verificar que el usuario esté activo
    if (!usuario.activo) {
      await this.recordAttempt({
        email: email.value,
        success: false,
        reason: 'INACTIVE_ACCOUNT',
        ipAddress: dto.ipAddress,
        userAgent: dto.userAgent,
      });
      return failure(UnauthorizedError.userInactive());
    }

    // 5. Verificar contraseña
    const passwordValidResult = await this.passwordHasher.verify(password, usuario.password);
    if (passwordValidResult.isFailure) {
      return failure(passwordValidResult.error);
    }

    if (!passwordValidResult.value) {
      await this.recordAttempt({
        email: email.value,
        success: false,
        reason: 'WRONG_PASSWORD',
        ipAddress: dto.ipAddress,
        userAgent: dto.userAgent,
      });
      return failure(UnauthorizedError.invalidCredentials());
    }

    // 6. Verificar que el email esté verificado (item 3): sin verificar no
    // se entra; el controlador devuelve el estado emailNotVerified para
    // que el frontend lleve a /verify-email.
    if (!usuario.emailVerificado) {
      await this.recordAttempt({
        email: email.value,
        success: false,
        reason: 'UNVERIFIED_EMAIL',
        ipAddress: dto.ipAddress,
        userAgent: dto.userAgent,
      });
      return failure(UnauthorizedError.emailNotVerified());
    }

    // 7. Rama MFA: usuario con TOTP activo NO recibe tokens todavía —
    // el login continúa en POST /auth/login/mfa con el código de 6 dígitos.
    // Compatibilidad hacia atrás: sin TOTP, la respuesta es idéntica a la anterior.
    if (usuario.totpEnabled && this.mfaRepository) {
      const challengeResult = await this.mfaRepository.createTotpChallenge(usuario.id, 5 * 60);
      if (challengeResult.isFailure) {
        return failure(challengeResult.error);
      }
      return success({
        mfaRequired: true,
        mfa: { challengeId: challengeResult.value.id },
      });
    }

    // 8. Generar tokens
    const tokenPayload = {
      userId: usuario.id,
      email: usuario.email.value,
      role: usuario.rol,
    };

    const tokensResult = await this.tokenService.generateTokenPair(tokenPayload);
    if (tokensResult.isFailure) {
      return failure(tokensResult.error);
    }
    const tokens = tokensResult.value;
    await this.recordAttempt({
      email: email.value,
      success: true,
      reason: null,
      ipAddress: dto.ipAddress,
      userAgent: dto.userAgent,
    });

    // 9. Verificar si la contraseña necesita rehash (opcional)
    const needsRehashResult = await this.passwordHasher.needsRehash(usuario.password);
    if (needsRehashResult.isSuccess && needsRehashResult.value) {
      // TODO: Programar rehash de contraseña en background
      // Esto podría ser un evento o un job asíncrono
    }

    // 10. Retornar respuesta
    const response: LoginResponseDto = {
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
    };

    return success(response);
  }
}