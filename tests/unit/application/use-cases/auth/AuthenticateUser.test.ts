import { AuthenticateUser } from '../../../../../src/application/use-cases/auth/AuthenticateUser';
import { IUsuarioRepository } from '../../../../../src/application/ports/repositories/IUsuarioRepository';
import { IPasswordHasher } from '../../../../../src/application/ports/auth/IPasswordHasher';
import { ITokenService } from '../../../../../src/application/ports/auth/ITokenService';
import { Usuario } from '../../../../../src/domain/entities/Usuario';
import { Email } from '../../../../../src/domain/value-objects/Email';
import { success, failure } from '../../../../../src/shared/result';

describe('AuthenticateUser', () => {
  let authenticateUser: AuthenticateUser;
  let usuarioRepository: jest.Mocked<IUsuarioRepository>;
  let passwordHasher: jest.Mocked<IPasswordHasher>;
  let tokenService: jest.Mocked<ITokenService>;

  beforeEach(() => {
    usuarioRepository = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      save: jest.fn(),
      findByIdList: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findAll: jest.fn()
    } as any;

    passwordHasher = {
      hash: jest.fn(),
      verify: jest.fn(),
      needsRehash: jest.fn()
    } as any;

    tokenService = {
      generateAccessToken: jest.fn(),
      generateRefreshToken: jest.fn(),
      generateTokenPair: jest.fn(),
      verifyToken: jest.fn(),
      refreshToken: jest.fn()
    } as any;

    authenticateUser = new AuthenticateUser(
      usuarioRepository,
      passwordHasher,
      tokenService
    );
  });

  describe('execute', () => {
    const validInput = {
      email: 'juan.perez@example.com',
      password: 'SecurePass123!'
    };

    let mockEmail: Email;
    let mockUser: Usuario;

    beforeEach(() => {
      const emailResult = Email.create('juan.perez@example.com');
      
      if (!emailResult.isSuccess) {
        throw new Error('Failed to create test data');
      }
      
      mockEmail = emailResult.value;

      const userResult = Usuario.create({
        id: 'user-id',
        nombre: 'Juan',
        apellidos: 'Pérez',
        email: mockEmail,
        password: 'hashedPassword',
        activo: true,
        emailVerificado: true
      });
      
      if (!userResult.isSuccess) {
        throw new Error('Failed to create test user');
      }
      
      mockUser = userResult.value;
    });

    it('debería autenticar usuario exitosamente', async () => {
      // Arrange
      usuarioRepository.findByEmail.mockResolvedValue(success(mockUser));
      passwordHasher.verify.mockResolvedValue(success(true));
      passwordHasher.needsRehash.mockResolvedValue(success(false));
      tokenService.generateTokenPair.mockResolvedValue(success({
        accessToken: 'access-token',
        refreshToken: 'refresh-token'
      }));

      // Act
      const result = await authenticateUser.execute(validInput);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(usuarioRepository.findByEmail).toHaveBeenCalled();
      expect(passwordHasher.verify).toHaveBeenCalled();
      expect(tokenService.generateTokenPair).toHaveBeenCalled();
    });

    it('debería fallar con datos de entrada inválidos', async () => {
      // Arrange
      const invalidInput = {
        email: 'invalid-email',
        password: ''
      };

      // Act
      const result = await authenticateUser.execute(invalidInput);

      // Assert
      expect(result.isSuccess).toBe(false);
      expect(usuarioRepository.findByEmail).not.toHaveBeenCalled();
    });

    it('debería fallar si el usuario no existe', async () => {
      // Arrange
      usuarioRepository.findByEmail.mockResolvedValue(success(null));

      // Act
      const result = await authenticateUser.execute(validInput);

      // Assert
      expect(result.isSuccess).toBe(false);
      expect(passwordHasher.verify).not.toHaveBeenCalled();
    });

    it('debería fallar si la contraseña es incorrecta', async () => {
      // Arrange
      usuarioRepository.findByEmail.mockResolvedValue(success(mockUser));
      passwordHasher.verify.mockResolvedValue(success(false));

      // Act
      const result = await authenticateUser.execute(validInput);

      // Assert
      expect(result.isSuccess).toBe(false);
      expect(tokenService.generateAccessToken).not.toHaveBeenCalled();
    });

    it('debería fallar si el usuario está inactivo', async () => {
      // Arrange  
      const inactiveUserResult = Usuario.create({
        id: 'user-id',
        nombre: 'Juan',
        apellidos: 'Pérez',
        email: mockEmail,
        password: 'hashedPassword',
        activo: false,
        emailVerificado: true
      });
      
      if (!inactiveUserResult.isSuccess) {
        throw new Error('Failed to create inactive user');
      }
      
      const inactiveUser = inactiveUserResult.value;

      usuarioRepository.findByEmail.mockResolvedValue(success(inactiveUser));
      passwordHasher.verify.mockResolvedValue(success(true));

      // Act
      const result = await authenticateUser.execute(validInput);

      // Assert
      expect(result.isSuccess).toBe(false);
    });

    it('debería manejar errores del repositorio', async () => {
      // Arrange
      usuarioRepository.findByEmail.mockResolvedValue(failure(new Error('Database error')));

      // Act
      const result = await authenticateUser.execute(validInput);

      // Assert
      expect(result.isSuccess).toBe(false);
    });

    it('debería manejar errores del password hasher', async () => {
      // Arrange
      usuarioRepository.findByEmail.mockResolvedValue(success(mockUser));
      passwordHasher.verify.mockResolvedValue(failure(new Error('Hash error')));

      // Act
      const result = await authenticateUser.execute(validInput);

      // Assert
      expect(result.isSuccess).toBe(false);
    });

    it('debería manejar errores del token service', async () => {
      // Arrange
      usuarioRepository.findByEmail.mockResolvedValue(success(mockUser));
      passwordHasher.verify.mockResolvedValue(success(true));
      tokenService.generateTokenPair.mockResolvedValue(failure(new Error('Token error')));

      // Act
      const result = await authenticateUser.execute(validInput);

      // Assert
      expect(result.isSuccess).toBe(false);
    });
  });
});