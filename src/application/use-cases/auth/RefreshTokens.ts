/**
 * Caso de uso: Renovar tokens con un refresh token válido
 * Implementa POST /auth/refresh (antes devolvía 501 NOT_IMPLEMENTED).
 * Sin este caso de uso, el access token (1h) caducaba y la app dejaba de
 * funcionar hasta volver a iniciar sesión: el frontend no tenía cómo
 * renovarlo y el callback jwt de NextAuth tenía el refresh comentado.
 */

import type { Result } from '@shared/result';
import { success, failure } from '@shared/result';
import type { ITokenService } from '@application/ports/auth/ITokenService';
import { UnauthorizedError } from '@application/errors/UnauthorizedError';

export interface RefreshTokensResult {
  tokens: {
    accessToken: string;
    refreshToken: string;
  };
}

export class RefreshTokens {
  constructor(private readonly tokenService: ITokenService) {}

  async execute(refreshToken: string): Promise<Result<RefreshTokensResult, Error>> {
    if (!refreshToken || typeof refreshToken !== 'string') {
      return failure(new UnauthorizedError('Refresh token es requerido'));
    }

    const verified = await this.tokenService.verifyRefreshToken(refreshToken);
    if (verified.isFailure) {
      // No filtrar el motivo exacto (caducado o inválido): 401 genérico
      return failure(new UnauthorizedError('Refresh token inválido o expirado'));
    }

    const payload = verified.value;
    const tokensResult = await this.tokenService.generateTokenPair({
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
    });
    if (tokensResult.isFailure) {
      return failure(tokensResult.error);
    }

    return success({ tokens: tokensResult.value });
  }
}
