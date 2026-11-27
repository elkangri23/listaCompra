import { RefreshTokens } from '../../../../../src/application/use-cases/auth/RefreshTokens';
import type { ITokenService } from '../../../../../src/application/ports/auth/ITokenService';
import type { IUsuarioRepository } from '../../../../../src/application/ports/repositories/IUsuarioRepository';
import { success, failure } from '../../../../../src/shared/result';
import { UnauthorizedError } from '../../../../../src/application/errors/UnauthorizedError';

describe('RefreshTokens', () => {
  let refreshTokens: RefreshTokens;
  let tokenService: jest.Mocked<ITokenService>;
  let usuarioRepository: jest.Mocked<IUsuarioRepository>;

  const payload = { userId: 'user-1', email: 'test@example.com', role: 'Usuario' };
  const newPair = { accessToken: 'new-access-token', refreshToken: 'new-refresh-token' };

  beforeEach(() => {
    tokenService = {
      generateAccessToken: jest.fn(),
      generateRefreshToken: jest.fn(),
      generateTokenPair: jest.fn(),
      verifyAccessToken: jest.fn(),
      verifyRefreshToken: jest.fn(),
    } as any;

    usuarioRepository = {
      findById: jest.fn().mockResolvedValue(success({ activo: true } as any)),
    } as any;

    refreshTokens = new RefreshTokens(tokenService, usuarioRepository);
  });

  it('renueva el par de tokens con un refresh token válido', async () => {
    tokenService.verifyRefreshToken.mockResolvedValue(success(payload));
    tokenService.generateTokenPair.mockResolvedValue(success(newPair));

    const result = await refreshTokens.execute('old-refresh-token');

    expect(result.isSuccess).toBe(true);
    if (result.isSuccess) {
      expect(result.value.tokens).toEqual(newPair);
    }
    expect(tokenService.verifyRefreshToken).toHaveBeenCalledWith('old-refresh-token');
    expect(tokenService.generateTokenPair).toHaveBeenCalledWith(payload);
  });

  it('rechaza un refresh token inválido con 401 genérico', async () => {
    tokenService.verifyRefreshToken.mockResolvedValue(failure(new Error('Token de refresh inválido')));

    const result = await refreshTokens.execute('token-malo');

    expect(result.isFailure).toBe(true);
    if (result.isFailure) {
      expect(result.error).toBeInstanceOf(UnauthorizedError);
      expect(result.error.message).toBe('Refresh token inválido o expirado');
    }
    expect(tokenService.generateTokenPair).not.toHaveBeenCalled();
  });

  it('rechaza un refresh token expirado con 401 genérico', async () => {
    tokenService.verifyRefreshToken.mockResolvedValue(failure(new Error('Token de refresh expirado')));

    const result = await refreshTokens.execute('token-caducado');

    expect(result.isFailure).toBe(true);
    if (result.isFailure) {
      expect(result.error).toBeInstanceOf(UnauthorizedError);
    }
    expect(tokenService.generateTokenPair).not.toHaveBeenCalled();
  });

  it('rechaza un refresh token vacío sin llamar al servicio', async () => {
    const result = await refreshTokens.execute('');

    expect(result.isFailure).toBe(true);
    if (result.isFailure) {
      expect(result.error).toBeInstanceOf(UnauthorizedError);
    }
    expect(tokenService.verifyRefreshToken).not.toHaveBeenCalled();
  });

  it('propaga el error si no se puede generar el nuevo par', async () => {
    tokenService.verifyRefreshToken.mockResolvedValue(success(payload));
    tokenService.generateTokenPair.mockResolvedValue(failure(new Error('Fallo al firmar')));

    const result = await refreshTokens.execute('old-refresh-token');

    expect(result.isFailure).toBe(true);
    if (result.isFailure) {
      expect(result.error.message).toBe('Fallo al firmar');
    }
  });

  it('rechaza la renovación si la cuenta está desactivada (GDPR)', async () => {
    tokenService.verifyRefreshToken.mockResolvedValue(success(payload));
    usuarioRepository.findById.mockResolvedValue(success({ activo: false } as any));

    const result = await refreshTokens.execute('old-refresh-token');

    expect(result.isFailure).toBe(true);
    if (result.isFailure) {
      expect(result.error).toBeInstanceOf(UnauthorizedError);
      expect(result.error.message).toBe('Refresh token inválido o expirado');
    }
    expect(tokenService.generateTokenPair).not.toHaveBeenCalled();
  });

  it('rechaza la renovación si el usuario ya no existe', async () => {
    tokenService.verifyRefreshToken.mockResolvedValue(success(payload));
    usuarioRepository.findById.mockResolvedValue(success(null as any));

    const result = await refreshTokens.execute('old-refresh-token');

    expect(result.isFailure).toBe(true);
    if (result.isFailure) {
      expect(result.error).toBeInstanceOf(UnauthorizedError);
    }
    expect(tokenService.generateTokenPair).not.toHaveBeenCalled();
  });
});
