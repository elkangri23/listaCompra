/**
 * Verificador de step-up por contraseña (shared kernel de los casos de uso MFA)
 * Comprueba la contraseña actual del usuario antes de una mutación sensible.
 */

import type { Result } from '@shared/result';
import { success, failure } from '@shared/result';
import type { UUID } from '@shared/types';
import type { IUsuarioRepository } from '@application/ports/repositories/IUsuarioRepository';
import type { IPasswordHasher } from '@application/ports/auth/IPasswordHasher';
import { Password } from '@domain/value-objects/Password';
import { UnauthorizedError } from '@application/errors/UnauthorizedError';
import { NotFoundError } from '@application/errors/NotFoundError';
import type { Usuario } from '@domain/entities/Usuario';

export class StepUpPasswordVerifier {
  constructor(
    private readonly usuarioRepository: IUsuarioRepository,
    private readonly passwordHasher: IPasswordHasher
  ) {}

  async verify(
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
