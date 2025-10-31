/**
 * Tests para el caso de uso ImpersonateUser
 */

import { ImpersonateUser } from '../../../../../src/application/use-cases/admin/ImpersonateUser';
import { Usuario, RolUsuario } from '../../../../../src/domain/entities/Usuario';
import { IUsuarioRepository } from '../../../../../src/application/ports/repositories/IUsuarioRepository';
import { ITokenService } from '../../../../../src/application/ports/auth/ITokenService';
import { success, failure } from '../../../../../src/shared/result';
import { NotFoundError } from '../../../../../src/application/errors/NotFoundError';
import { UnauthorizedError } from '../../../../../src/application/errors/UnauthorizedError';
import { ValidationError } from '../../../../../src/application/errors/ValidationError';

describe('ImpersonateUser', () => {
  let impersonateUser: ImpersonateUser;
  let mockUsuarioRepository: jest.Mocked<IUsuarioRepository>;
  let mockTokenService: jest.Mocked<ITokenService>;

  // Usuarios de prueba - Usar mocks directos
  let adminUser: Usuario;
  let normalUser: Usuario;
  let anotherAdminUser: Usuario;

  beforeAll(async () => {
    // Crear usuarios de prueba usando mocks simples
    adminUser = {
      id: 'admin-id',
      email: 'admin@test.com',
      nombre: 'Admin',
      apellidos: 'Test',
      rol: RolUsuario.ADMIN,
      activo: true,
      emailVerificado: true,
      esAdmin: () => true,
      puedeAcceder: () => true
    } as any;

    normalUser = {
      id: 'user-id',
      email: 'user@test.com',
      nombre: 'Usuario',
      apellidos: 'Normal',
      rol: RolUsuario.USUARIO,
      activo: true,
      emailVerificado: true,
      esAdmin: () => false,
      puedeAcceder: () => true
    } as any;

    anotherAdminUser = {
      id: 'admin2-id',
      email: 'admin2@test.com',
      nombre: 'Admin2',
      apellidos: 'Test',
      rol: RolUsuario.ADMIN,
      activo: true,
      emailVerificado: true,
      esAdmin: () => true,
      puedeAcceder: () => true
    } as any;
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

    impersonateUser = new ImpersonateUser(mockUsuarioRepository, mockTokenService);
  });

  describe('execute', () => {
    it('debería impersonar usuario exitosamente con targetUserId', async () => {
      // Arrange
      const dto = {
        targetUserId: normalUser.id,
        reason: 'Soporte técnico',
        durationMinutes: 30
      };

      mockUsuarioRepository.findById
        .mockResolvedValueOnce(success(adminUser))  // Admin user
        .mockResolvedValueOnce(success(normalUser)); // Target user

      mockTokenService.generateAccessToken.mockResolvedValue(success('impersonation-token-123'));

      // Act
      const result = await impersonateUser.execute(
        adminUser.id,
        dto,
        '192.168.1.1',
        'Mozilla/5.0'
      );

      // Assert
      expect(result.isSuccess).toBe(true);
      if (result.isSuccess) {
        expect(result.value.impersonatedUser.id).toBe(normalUser.id);
        expect(result.value.adminUser.id).toBe(adminUser.id);
        expect(result.value.impersonationToken).toBe('impersonation-token-123');
        expect(mockTokenService.generateAccessToken).toHaveBeenCalledWith(
          expect.objectContaining({
            userId: normalUser.id,
            email: normalUser.email.toString(),
            role: normalUser.rol
          })
        );
      }
    });

    it('debería impersonar usuario exitosamente con targetUserEmail', async () => {
      // Arrange
      const dto = {
        targetUserEmail: normalUser.email.toString(),
        reason: 'Investigación de bug'
      };

      mockUsuarioRepository.findById.mockResolvedValueOnce(success(adminUser));
      mockUsuarioRepository.findByEmail.mockResolvedValueOnce(success(normalUser));
      mockTokenService.generateAccessToken.mockResolvedValue(success('impersonation-token-456'));

      // Act
      const result = await impersonateUser.execute(
        adminUser.id,
        dto,
        '192.168.1.1',
        'Mozilla/5.0'
      );

      // Assert
      expect(result.isSuccess).toBe(true);
      if (result.isSuccess) {
        expect(result.value.impersonatedUser.email).toBe(normalUser.email.toString());
      }
    });

    it('debería fallar si el usuario no es administrador', async () => {
      // Arrange
      const dto = {
        targetUserId: normalUser.id,
        reason: 'Intento no autorizado'
      };

      // Usuario normal intentando impersonar
      mockUsuarioRepository.findById.mockResolvedValueOnce(success(normalUser));

      // Act
      const result = await impersonateUser.execute(
        normalUser.id,
        dto,
        '192.168.1.1',
        'Mozilla/5.0'
      );

      // Assert
      expect(result.isSuccess).toBe(false);
      if (result.isFailure) {
        expect(result.error).toBeInstanceOf(UnauthorizedError);
        expect(result.error.message).toBe('Solo administradores pueden impersonar usuarios');
      }
    });

    it('debería fallar si se intenta impersonar otro administrador', async () => {
      // Arrange
      const dto = {
        targetUserId: anotherAdminUser.id,
        reason: 'Intento no permitido'
      };

      mockUsuarioRepository.findById
        .mockResolvedValueOnce(success(adminUser))     // Admin user
        .mockResolvedValueOnce(success(anotherAdminUser)); // Another admin

      // Act
      const result = await impersonateUser.execute(
        adminUser.id,
        dto,
        '192.168.1.1',
        'Mozilla/5.0'
      );

      // Assert
      expect(result.isSuccess).toBe(false);
      if (result.isFailure) {
        expect(result.error).toBeInstanceOf(UnauthorizedError);
        expect(result.error.message).toBe('No se puede impersonar otro administrador');
      }
    });

    it('debería fallar si se intenta auto-impersonar', async () => {
      // Arrange
      const dto = {
        targetUserId: adminUser.id,
        reason: 'Auto-impersonación'
      };

      mockUsuarioRepository.findById
        .mockResolvedValueOnce(success(adminUser))  // Admin user
        .mockResolvedValueOnce(success(adminUser)); // Same admin user

      // Act
      const result = await impersonateUser.execute(
        adminUser.id,
        dto,
        '192.168.1.1',
        'Mozilla/5.0'
      );

      // Assert
      expect(result.isSuccess).toBe(false);
      if (result.isFailure) {
        expect(result.error).toBeInstanceOf(UnauthorizedError);
        expect(result.error.message).toBe('No se puede impersonar otro administrador');
      }
    });

    it('debería fallar si el usuario objetivo no existe', async () => {
      // Arrange
      const dto = {
        targetUserId: 'non-existent-id',
        reason: 'Usuario inexistente'
      };

      mockUsuarioRepository.findById
        .mockResolvedValueOnce(success(adminUser))  // Admin user
        .mockResolvedValueOnce(failure(new NotFoundError('Usuario', 'non-existent-id'))); // Target user not found

      // Act
      const result = await impersonateUser.execute(
        adminUser.id,
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

    it('debería fallar si no se proporciona targetUserId ni targetUserEmail', async () => {
      // Arrange
      const dto = {
        reason: 'Sin identificador de usuario'
      };

      // Act
      const result = await impersonateUser.execute(
        adminUser.id,
        dto,
        '192.168.1.1',
        'Mozilla/5.0'
      );

      // Assert
      expect(result.isSuccess).toBe(false);
      if (result.isFailure) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toBe('Debe especificar targetUserId o targetUserEmail');
      }
    });

    it('debería usar duración por defecto de 60 minutos si no se especifica', async () => {
      // Arrange
      const dto = {
        targetUserId: normalUser.id,
        reason: 'Sin duración especificada'
      };

      mockUsuarioRepository.findById
        .mockResolvedValueOnce(success(adminUser))
        .mockResolvedValueOnce(success(normalUser));

      mockTokenService.generateAccessToken.mockResolvedValue(success('token'));

      // Act
      const result = await impersonateUser.execute(
        adminUser.id,
        dto,
        '192.168.1.1',
        'Mozilla/5.0'
      );

      // Assert
      expect(result.isSuccess).toBe(true);
      if (result.isSuccess) {
        // Verificar que expiresAt esté aproximadamente 60 minutos en el futuro
        const now = new Date();
        const expected = new Date(now.getTime() + 60 * 60 * 1000);
        const actual = result.value.expiresAt;
        const diffMinutes = Math.abs(actual.getTime() - expected.getTime()) / (1000 * 60);
        expect(diffMinutes).toBeLessThan(1); // Tolerancia de 1 minuto
      }
    });
  });
});