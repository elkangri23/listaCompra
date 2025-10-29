/**
 * Tests para el caso de uso EndImpersonation
 */

import { EndImpersonation } from '@application/use-cases/admin/EndImpersonation';
import { Usuario, RolUsuario } from '@domain/entities/Usuario';
import { Email } from '@domain/value-objects/Email';
import { IUsuarioRepository } from '@application/ports/repositories/IUsuarioRepository';
import { ITokenService, TokenPayload } from '@application/ports/auth/ITokenService';
import { success, failure } from '@shared/result';
import { NotFoundError } from '@application/errors/NotFoundError';
import { UnauthorizedError } from '@application/errors/UnauthorizedError';
import { ValidationError } from '@application/errors/ValidationError';

interface ImpersonationTokenPayload {
  userId: string;
  email: string;
  role: string;
  adminId: string;
  isImpersonation: boolean;
  sessionId: string;
  iat: number;
  exp: number;
}

describe('EndImpersonation', () => {
  let endImpersonation: EndImpersonation;
  let mockUsuarioRepository: jest.Mocked<IUsuarioRepository>;
  let mockTokenService: jest.Mocked<ITokenService>;

  // Usuarios de prueba
  let adminUser: Usuario;
  let normalUser: Usuario;

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

    if (!adminEmail.isSuccess || !userEmail.isSuccess) {
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

    if (!adminResult.isSuccess || !userResult.isSuccess) {
      throw new Error('Error creando usuarios de prueba');
    }

    adminUser = adminResult.value;
    normalUser = userResult.value;

    endImpersonation = new EndImpersonation(mockUsuarioRepository, mockTokenService);
  });

  describe('execute', () => {
    it('debería finalizar impersonación exitosamente', async () => {
      // Arrange
      const impersonationToken = 'impersonation-token-123';
      const sessionId = 'session-123';
      const issuedAt = Math.floor(Date.now() / 1000) - 600; // 10 minutos atrás
      
      const tokenPayload: ImpersonationTokenPayload = {
        userId: normalUser.id,
        email: normalUser.email,
        role: normalUser.rol,
        adminId: adminUser.id,
        isImpersonation: true,
        sessionId,
        iat: issuedAt,
        exp: Math.floor(Date.now() / 1000) + 3000
      };

      const dto = {
        reason: 'Tarea completada'
      };

      mockTokenService.verifyAccessToken.mockResolvedValue(success(tokenPayload));
      mockUsuarioRepository.findById
        .mockResolvedValueOnce(success(adminUser))  // Admin user
        .mockResolvedValueOnce(success(normalUser)); // Target user

      mockTokenService.generateAccessToken.mockResolvedValue(success('new-admin-token-456'));

      // Act
      const result = await endImpersonation.execute(
        impersonationToken,
        dto,
        '192.168.1.1',
        'Mozilla/5.0'
      );

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.success).toBe(true);
      expect(result.value.adminToken).toBe('new-admin-token-456');
      expect(result.value.terminatedSession.sessionId).toBe(sessionId);
      expect(result.value.terminatedSession.adminId).toBe(adminUser.id);
      expect(result.value.terminatedSession.targetUserId).toBe(normalUser.id);
      expect(result.value.terminatedSession.duration).toMatch(/10m/);
      
      // Verificar que se generó un nuevo token para el admin
      expect(mockTokenService.generateAccessToken).toHaveBeenCalledWith({
        userId: adminUser.id,
        email: adminUser.email,
        role: adminUser.rol
      });
    });

    it('debería fallar con token inválido', async () => {
      // Arrange
      const invalidToken = 'invalid-token';
      const dto = { reason: 'Token inválido' };

      mockTokenService.verifyAccessToken.mockResolvedValue(
        failure(new Error('Token inválido'))
      );

      // Act
      const result = await endImpersonation.execute(
        invalidToken,
        dto,
        '192.168.1.1',
        'Mozilla/5.0'
      );

      // Assert
      expect(result.isSuccess).toBe(false);
      expect(result.error).toBeInstanceOf(UnauthorizedError);
      expect(result.error.message).toBe('Token de impersonación inválido o expirado');
    });

    it('debería fallar si el token no es de impersonación', async () => {
      // Arrange
      const normalToken = 'normal-token-123';
      const normalTokenPayload: TokenPayload = {
        userId: normalUser.id,
        email: normalUser.email,
        role: normalUser.rol
        // No tiene adminId ni isImpersonation
      };

      const dto = { reason: 'Token normal' };

      mockTokenService.verifyAccessToken.mockResolvedValue(success(normalTokenPayload));

      // Act
      const result = await endImpersonation.execute(
        normalToken,
        dto,
        '192.168.1.1',
        'Mozilla/5.0'
      );

      // Assert
      expect(result.isSuccess).toBe(false);
      expect(result.error).toBeInstanceOf(ValidationError);
      expect(result.error.message).toBe('No hay sesión de impersonación activa');
    });

    it('debería fallar si el administrador no existe', async () => {
      // Arrange
      const impersonationToken = 'impersonation-token-123';
      const tokenPayload: ImpersonationTokenPayload = {
        userId: normalUser.id,
        email: normalUser.email,
        role: normalUser.rol,
        adminId: 'non-existent-admin-id',
        isImpersonation: true,
        sessionId: 'session-123',
        iat: Math.floor(Date.now() / 1000) - 600,
        exp: Math.floor(Date.now() / 1000) + 3000
      };

      const dto = { reason: 'Admin inexistente' };

      mockTokenService.verifyAccessToken.mockResolvedValue(success(tokenPayload));
      mockUsuarioRepository.findById
        .mockResolvedValueOnce(failure(new NotFoundError('Admin no encontrado')))
        .mockResolvedValueOnce(success(normalUser));

      // Act
      const result = await endImpersonation.execute(
        impersonationToken,
        dto,
        '192.168.1.1',
        'Mozilla/5.0'
      );

      // Assert
      expect(result.isSuccess).toBe(false);
      expect(result.error).toBeInstanceOf(NotFoundError);
      expect(result.error.message).toBe('Administrador no encontrado');
    });

    it('debería fallar si el usuario impersonado no existe', async () => {
      // Arrange
      const impersonationToken = 'impersonation-token-123';
      const tokenPayload: ImpersonationTokenPayload = {
        userId: 'non-existent-user-id',
        email: 'nonexistent@test.com',
        role: RolUsuario.USUARIO,
        adminId: adminUser.id,
        isImpersonation: true,
        sessionId: 'session-123',
        iat: Math.floor(Date.now() / 1000) - 600,
        exp: Math.floor(Date.now() / 1000) + 3000
      };

      const dto = { reason: 'Usuario inexistente' };

      mockTokenService.verifyAccessToken.mockResolvedValue(success(tokenPayload));
      mockUsuarioRepository.findById
        .mockResolvedValueOnce(success(adminUser))
        .mockResolvedValueOnce(failure(new NotFoundError('Usuario no encontrado')));

      // Act
      const result = await endImpersonation.execute(
        impersonationToken,
        dto,
        '192.168.1.1',
        'Mozilla/5.0'
      );

      // Assert
      expect(result.isSuccess).toBe(false);
      expect(result.error).toBeInstanceOf(NotFoundError);
      expect(result.error.message).toBe('Usuario impersonado no encontrado');
    });

    it('debería fallar si el administrador ya no tiene permisos de admin', async () => {
      // Arrange
      const impersonationToken = 'impersonation-token-123';
      const tokenPayload: ImpersonationTokenPayload = {
        userId: normalUser.id,
        email: normalUser.email,
        role: normalUser.rol,
        adminId: adminUser.id,
        isImpersonation: true,
        sessionId: 'session-123',
        iat: Math.floor(Date.now() / 1000) - 600,
        exp: Math.floor(Date.now() / 1000) + 3000
      };

      // Admin que ya no es admin
      const exAdminEmail = await Email.create('exadmin@test.com');
      if (!exAdminEmail.isSuccess) throw new Error('Error creando email');
      
      const exAdminResult = Usuario.create({
        email: exAdminEmail.value,
        password: 'hashedPassword789',
        nombre: 'ExAdmin',
        apellidos: 'Test',
        rol: RolUsuario.USUARIO // Ya no es admin
      });
      
      if (!exAdminResult.isSuccess) throw new Error('Error creando ex-admin');
      const exAdmin = exAdminResult.value;

      const dto = { reason: 'Admin sin permisos' };

      mockTokenService.verifyAccessToken.mockResolvedValue(success(tokenPayload));
      mockUsuarioRepository.findById
        .mockResolvedValueOnce(success(exAdmin))  // Ex-admin
        .mockResolvedValueOnce(success(normalUser));

      // Act
      const result = await endImpersonation.execute(
        impersonationToken,
        dto,
        '192.168.1.1',
        'Mozilla/5.0'
      );

      // Assert
      expect(result.isSuccess).toBe(false);
      expect(result.error).toBeInstanceOf(UnauthorizedError);
      expect(result.error.message).toBe('Permisos de administrador revocados');
    });

    it('debería calcular correctamente la duración de la sesión', async () => {
      // Arrange
      const impersonationToken = 'impersonation-token-123';
      const sessionId = 'session-123';
      const issuedAt = Math.floor(Date.now() / 1000) - 7320; // 2 horas y 2 minutos atrás
      
      const tokenPayload: ImpersonationTokenPayload = {
        userId: normalUser.id,
        email: normalUser.email,
        role: normalUser.rol,
        adminId: adminUser.id,
        isImpersonation: true,
        sessionId,
        iat: issuedAt,
        exp: Math.floor(Date.now() / 1000) + 3000
      };

      const dto = { reason: 'Test duración' };

      mockTokenService.verifyAccessToken.mockResolvedValue(success(tokenPayload));
      mockUsuarioRepository.findById
        .mockResolvedValueOnce(success(adminUser))
        .mockResolvedValueOnce(success(normalUser));

      mockTokenService.generateAccessToken.mockResolvedValue(success('new-token'));

      // Act
      const result = await endImpersonation.execute(
        impersonationToken,
        dto,
        '192.168.1.1',
        'Mozilla/5.0'
      );

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.terminatedSession.duration).toBe('2h 2m');
    });

    it('debería formatear duración menor a 1 hora correctamente', async () => {
      // Arrange
      const impersonationToken = 'impersonation-token-123';
      const sessionId = 'session-123';
      const issuedAt = Math.floor(Date.now() / 1000) - 1800; // 30 minutos atrás
      
      const tokenPayload: ImpersonationTokenPayload = {
        userId: normalUser.id,
        email: normalUser.email,
        role: normalUser.rol,
        adminId: adminUser.id,
        isImpersonation: true,
        sessionId,
        iat: issuedAt,
        exp: Math.floor(Date.now() / 1000) + 3000
      };

      const dto = { reason: 'Test duración corta' };

      mockTokenService.verifyAccessToken.mockResolvedValue(success(tokenPayload));
      mockUsuarioRepository.findById
        .mockResolvedValueOnce(success(adminUser))
        .mockResolvedValueOnce(success(normalUser));

      mockTokenService.generateAccessToken.mockResolvedValue(success('new-token'));

      // Act
      const result = await endImpersonation.execute(
        impersonationToken,
        dto,
        '192.168.1.1',
        'Mozilla/5.0'
      );

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(result.value.terminatedSession.duration).toBe('30m');
    });
  });
});