/**
 * Tests para el caso de uso ImpersonateUser
 */

import { ImpersonateUser } from '@application/use-cases/admin/ImpersonateUser';
import { Usuario, RolUsuario } from '@domain/entities/Usuario';
import { Email } from '@domain/value-objects/Email';
import { IUsuarioRepository } from '@application/ports/repositories/IUsuarioRepository';
import { ITokenService, TokenPayload } from '@application/ports/auth/ITokenService';
import { success, failure } from '@shared/result';
import { NotFoundError } from '@application/errors/NotFoundError';
import { UnauthorizedError } from '@application/errors/UnauthorizedError';
import { ValidationError } from '@application/errors/ValidationError';

describe('ImpersonateUser', () => {
  let impersonateUser: ImpersonateUser;
  let mockUsuarioRepository: jest.Mocked<IUsuarioRepository>;
  let mockTokenService: jest.Mocked<ITokenService>;

  // Usuarios de prueba
  let adminUser: Usuario;
  let normalUser: Usuario;
  let anotherAdminUser: Usuario;

  beforeEach(async () => {
    // Crear mocks
    mockUsuarioRepository = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findAll: jest.fn(),
      exists: jest.fn()
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
    const adminEmail = await Email.create('admin@test.com');
    const userEmail = await Email.create('user@test.com');
    const anotherAdminEmail = await Email.create('admin2@test.com');

    if (!adminEmail.isSuccess || !userEmail.isSuccess || !anotherAdminEmail.isSuccess) {
      throw new Error('Error creando emails de prueba');
    }

    const adminResult = Usuario.create({
      email: adminEmail.value,
      password: 'hashedPassword123',
      nombre: 'Admin',
      apellidos: 'Test',
      rol: RolUsuario.ADMIN
    });

    const userResult = Usuario.create({
      email: userEmail.value,
      password: 'hashedPassword456',
      nombre: 'Usuario',
      apellidos: 'Normal',
      rol: RolUsuario.USUARIO
    });

    const anotherAdminResult = Usuario.create({
      email: anotherAdminEmail.value,
      password: 'hashedPassword789',
      nombre: 'Admin2',
      apellidos: 'Test',
      rol: RolUsuario.ADMIN
    });

    if (!adminResult.isSuccess || !userResult.isSuccess || !anotherAdminResult.isSuccess) {
      throw new Error('Error creando usuarios de prueba');
    }

    adminUser = adminResult.value;
    normalUser = userResult.value;
    anotherAdminUser = anotherAdminResult.value;

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
      expect(result.value.impersonatedUser.id).toBe(normalUser.id);
      expect(result.value.adminUser.id).toBe(adminUser.id);
      expect(result.value.impersonationToken).toBe('impersonation-token-123');
      expect(mockTokenService.generateAccessToken).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: normalUser.id,
          email: normalUser.email,
          role: normalUser.rol,
          adminId: adminUser.id,
          isImpersonation: true
        })
      );
    });

    it('debería impersonar usuario exitosamente con targetUserEmail', async () => {
      // Arrange
      const dto = {
        targetUserEmail: normalUser.email,
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
      expect(result.value.impersonatedUser.email).toBe(normalUser.email);
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
      expect(result.error).toBeInstanceOf(UnauthorizedError);
      expect(result.error.message).toBe('Solo administradores pueden impersonar usuarios');
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
      expect(result.error).toBeInstanceOf(UnauthorizedError);
      expect(result.error.message).toBe('No se puede impersonar otro administrador');
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
      expect(result.error).toBeInstanceOf(ValidationError);
      expect(result.error.message).toBe('No se puede impersonar a sí mismo');
    });

    it('debería fallar si el usuario objetivo no existe', async () => {
      // Arrange
      const dto = {
        targetUserId: 'non-existent-id',
        reason: 'Usuario inexistente'
      };

      mockUsuarioRepository.findById
        .mockResolvedValueOnce(success(adminUser))  // Admin user
        .mockResolvedValueOnce(failure(new NotFoundError('Usuario no encontrado'))); // Target user not found

      // Act
      const result = await impersonateUser.execute(
        adminUser.id,
        dto,
        '192.168.1.1',
        'Mozilla/5.0'
      );

      // Assert
      expect(result.isSuccess).toBe(false);
      expect(result.error).toBeInstanceOf(NotFoundError);
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
      expect(result.error).toBeInstanceOf(ValidationError);
      expect(result.error.message).toBe('Debe especificar targetUserId o targetUserEmail');
    });

    it('debería fallar si la duración es inválida', async () => {
      // Arrange
      const dto = {
        targetUserId: normalUser.id,
        reason: 'Duración inválida',
        durationMinutes: 500 // Más de 480 minutos (8 horas)
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
      expect(result.error).toBeInstanceOf(ValidationError);
      expect(result.error.message).toBe('La duración debe estar entre 1 y 480 minutos');
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
      // Verificar que expiresAt esté aproximadamente 60 minutos en el futuro
      const now = new Date();
      const expected = new Date(now.getTime() + 60 * 60 * 1000);
      const actual = result.value.expiresAt;
      const diffMinutes = Math.abs(actual.getTime() - expected.getTime()) / (1000 * 60);
      expect(diffMinutes).toBeLessThan(1); // Tolerancia de 1 minuto
    });
  });
});