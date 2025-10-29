/**
 * Tests para el caso de uso EndImpersonation
 */

import { EndImpersonation } from '../../../../../src/application/use-cases/admin/EndImpersonation';
import { Usuario, RolUsuario } from '../../../../../src/domain/entities/Usuario';
import { Email } from '../../../../../src/domain/value-objects/Email';
import { IUsuarioRepository } from '../../../../../src/application/ports/repositories/IUsuarioRepository';
import { ITokenService, TokenPayload } from '../../../../../src/application/ports/auth/ITokenService';
import { success, failure } from '../../../../../src/shared/result';
import { NotFoundError } from '../../../../../src/application/errors/NotFoundError';
import { UnauthorizedError } from '../../../../../src/application/errors/UnauthorizedError';

describe('EndImpersonation', () => {
  let endImpersonation: EndImpersonation;
  let mockUsuarioRepository: jest.Mocked<IUsuarioRepository>;
  let mockTokenService: jest.Mocked<ITokenService>;

  // Usuarios de prueba  
  let normalUser: Usuario;

  beforeAll(async () => {
    // Crear usuarios de prueba
    const userEmail = Email.create('user@test.com');

    if (!userEmail.isSuccess) {
      throw new Error('Error creando emails de prueba');
    }

    const userResult = Usuario.create({
      email: userEmail.value,
      password: 'hashedPassword456',
      nombre: 'Usuario',
      apellidos: 'Normal',
      rol: RolUsuario.USUARIO
    });

    if (!userResult.isSuccess) {
      throw new Error('Error creando usuarios de prueba');
    }

    normalUser = userResult.value;
  });

  beforeEach(async () => {
    // Crear mocks
    mockUsuarioRepository = {
      save: jest.fn(),
      update: jest.fn(),
      findById: jest.fn(),
      findByEmail: jest.fn(),
      existsByEmail: jest.fn(),
      findAll: jest.fn(),
      findActive: jest.fn(),
      findByRole: jest.fn(),
      delete: jest.fn(),
      hardDelete: jest.fn(),
      count: jest.fn(),
      countActive: jest.fn(),
      search: jest.fn()
    };

    mockTokenService = {
      generateAccessToken: jest.fn(),
      generateRefreshToken: jest.fn(),
      generateTokenPair: jest.fn(),
      verifyAccessToken: jest.fn(),
      verifyRefreshToken: jest.fn(),
      extractTokenFromHeader: jest.fn(),
      isTokenNearExpiry: jest.fn(),
      getTokenTTL: jest.fn()
    };

    // Crear usuarios de prueba
    const userEmail = await Email.create('user@test.com');

    if (!userEmail.isSuccess) {
      throw new Error('Error creando emails de prueba');
    }

    const userResult = Usuario.create({
      email: userEmail.value,
      password: 'hashedPassword456',
      nombre: 'Usuario',
      apellidos: 'Normal',
      rol: RolUsuario.USUARIO
    });

    if (!userResult.isSuccess) {
      throw new Error('Error creando usuarios de prueba');
    }

    normalUser = userResult.value;

    endImpersonation = new EndImpersonation(mockUsuarioRepository, mockTokenService);
  });

  describe('execute', () => {
    it('debería finalizar impersonación exitosamente', async () => {
      // Arrange
      const impersonationToken = 'impersonation-token-123';
      const dto = { reason: 'Finalización de sesión de soporte' };
      const issuedAt = Math.floor(Date.now() / 1000) - 600; // 10 minutos atrás
      
      const tokenPayload: TokenPayload = {
        userId: normalUser.id,
        email: normalUser.email.toString(),
        role: normalUser.rol,
        iat: issuedAt
      };

      mockTokenService.verifyAccessToken.mockResolvedValue(success(tokenPayload));
      mockUsuarioRepository.findById.mockResolvedValue(success(normalUser));
      mockTokenService.generateAccessToken.mockResolvedValue(success('new-admin-token'));

      // Act
      const result = await endImpersonation.execute(
        impersonationToken,
        dto,
        '192.168.1.1',
        'Mozilla/5.0'
      );

      // Assert
      expect(result.isSuccess).toBe(true);
      if (result.isSuccess) {
        expect(result.value.success).toBe(true);
        expect(result.value.terminatedSession.targetUserId).toBe(normalUser.id);
        expect(result.value.message).toContain('Impersonación finalizada exitosamente');
      }
    });

    it('debería fallar si el token es inválido', async () => {
      // Arrange
      const impersonationToken = 'invalid-token';
      const dto = { reason: 'Token inválido' };

      mockTokenService.verifyAccessToken.mockResolvedValue(
        failure(new UnauthorizedError('Token inválido'))
      );

      // Act
      const result = await endImpersonation.execute(
        impersonationToken,
        dto,
        '192.168.1.1',
        'Mozilla/5.0'
      );

      // Assert
      expect(result.isSuccess).toBe(false);
      if (result.isFailure) {
        expect(result.error).toBeInstanceOf(UnauthorizedError);
        expect(result.error.message).toBe('Token de impersonación inválido');
      }
    });

    it('debería fallar si el usuario impersonado no existe', async () => {
      // Arrange
      const impersonationToken = 'valid-token';
      const dto = { reason: 'Usuario no encontrado' };
      
      const tokenPayload: TokenPayload = {
        userId: 'non-existent-user-id',
        email: 'non-existent@test.com',
        role: RolUsuario.USUARIO
      };

      mockTokenService.verifyAccessToken.mockResolvedValue(success(tokenPayload));
      mockUsuarioRepository.findById.mockResolvedValue(
        failure(new NotFoundError('Usuario', 'non-existent-user-id'))
      );

      // Act
      const result = await endImpersonation.execute(
        impersonationToken,
        dto,
        '192.168.1.1',
        'Mozilla/5.0'
      );

      // Assert
      expect(result.isSuccess).toBe(false);
      if (result.isFailure) {
        expect(result.error).toBeInstanceOf(NotFoundError);
      }
    });

    it('debería manejar token sin userId', async () => {
      // Arrange
      const impersonationToken = 'token-without-userid';
      const dto = { reason: 'Token sin userId' };
      
      const tokenPayload = {
        email: 'test@test.com',
        role: RolUsuario.USUARIO
        // Sin userId
      } as TokenPayload;

      mockTokenService.verifyAccessToken.mockResolvedValue(success(tokenPayload));

      // Act
      const result = await endImpersonation.execute(
        impersonationToken,
        dto,
        '192.168.1.1',
        'Mozilla/5.0'
      );

      // Assert
      expect(result.isSuccess).toBe(false);
      if (result.isFailure) {
        expect(result.error).toBeInstanceOf(UnauthorizedError);
        expect(result.error.message).toBe('Token no válido para impersonación');
      }
    });
  });
});