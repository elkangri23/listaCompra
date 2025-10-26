/**
 * Caso de uso: Autenticar usuario
 * Orquesta el proceso de autenticación de un usuario existente
 */

import type { Result } from '@shared/result';
import { success, failure } from '@shared/result';
import type { IUsuarioRepository } from '@application/ports/repositories/IUsuarioRepository';
import type { IPasswordHasher } from '@application/ports/auth/IPasswordHasher';
import type { ITokenService } from '@application/ports/auth/ITokenService';
import type { LoginDto, LoginResponseDto } from '@application/dto/auth/LoginDto';
import { Email } from '@domain/value-objects/Email';
import { Password } from '@domain/value-objects/Password';
import { ValidationError } from '@application/errors/ValidationError';
import { UnauthorizedError } from '@application/errors/UnauthorizedError';
import { NotFoundError } from '@application/errors/NotFoundError';

export class AuthenticateUser {
  constructor(
    private readonly usuarioRepository: IUsuarioRepository,
    private readonly passwordHasher: IPasswordHasher,
    private readonly tokenService: ITokenService
  ) {}

  async execute(dto: LoginDto): Promise<Result<LoginResponseDto, ValidationError | UnauthorizedError | NotFoundError | Error>> {
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
      return failure(UnauthorizedError.invalidCredentials());
    }

    // 4. Verificar que el usuario esté activo
    if (!usuario.activo) {
      return failure(UnauthorizedError.userInactive());
    }

    // 5. Verificar contraseña
    const passwordValidResult = await this.passwordHasher.verify(password, usuario.password);
    if (passwordValidResult.isFailure) {
      return failure(passwordValidResult.error);
    }

    if (!passwordValidResult.value) {
      return failure(UnauthorizedError.invalidCredentials());
    }

    // 6. Verificar que el email esté verificado (opcional según reglas de negocio)
    if (!usuario.emailVerificado) {
      return failure(UnauthorizedError.emailNotVerified());
    }

    // 7. Generar tokens
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

    // 8. Verificar si la contraseña necesita rehash (opcional)
    const needsRehashResult = await this.passwordHasher.needsRehash(usuario.password);
    if (needsRehashResult.isSuccess && needsRehashResult.value) {
      // TODO: Programar rehash de contraseña en background
      // Esto podría ser un evento o un job asíncrono
    }

    // 9. Retornar respuesta
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