import { RegisterUser } from '../../../../../src/application/use-cases/auth/RegisterUser';
import { IUsuarioRepository } from '../../../../../src/application/ports/repositories/IUsuarioRepository';
import { IPasswordHasher } from '../../../../../src/application/ports/auth/IPasswordHasher';
import { Usuario } from '../../../../../src/domain/entities/Usuario';
import { Email } from '../../../../../src/domain/value-objects/Email';
import { success, failure } from '../../../../../src/shared/result';

describe('RegisterUser', () => {
  let registerUser: RegisterUser;
  let usuarioRepository: jest.Mocked<IUsuarioRepository>;
  let passwordHasher: jest.Mocked<IPasswordHasher>;

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

    registerUser = new RegisterUser(usuarioRepository, passwordHasher);
  });

  describe('execute', () => {
    const validInput = {
      nombre: 'Juan',
      apellidos: 'Pérez García',
      email: 'juan.perez@example.com',
      password: 'SecurePass123!'
    };

    it('debería registrar un usuario exitosamente', async () => {
      // Arrange
      usuarioRepository.findByEmail.mockResolvedValue(success(null));
      passwordHasher.hash.mockResolvedValue(success('hashed-password'));
      
      const emailResult = Email.create('juan.perez@example.com');
      if (!emailResult.isSuccess) throw new Error('Failed to create email');
      
      const userResult = Usuario.create({
        id: 'new-id',
        email: emailResult.value,
        password: 'hashed-password',
        nombre: 'Juan',
        apellidos: 'Pérez García'
      });
      
      if (!userResult.isSuccess) throw new Error('Failed to create user');
      
      usuarioRepository.save.mockResolvedValue(success(userResult.value));

      // Act
      const result = await registerUser.execute(validInput);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(usuarioRepository.findByEmail).toHaveBeenCalledWith('juan.perez@example.com');
      expect(passwordHasher.hash).toHaveBeenCalled();
      expect(usuarioRepository.save).toHaveBeenCalled();
    });

    it('debería fallar con datos de entrada inválidos', async () => {
      // Arrange
      const invalidInput = {
        nombre: '',
        apellidos: 'Pérez',
        email: 'invalid-email',
        password: '123'
      };

      // Act
      const result = await registerUser.execute(invalidInput);

      // Assert
      expect(result.isSuccess).toBe(false);
      expect(usuarioRepository.findByEmail).not.toHaveBeenCalled();
    });

    it('debería fallar si el email ya está registrado', async () => {
      // Arrange
      const emailResult = Email.create('juan.perez@example.com');
      if (!emailResult.isSuccess) throw new Error('Failed to create email');
      
      const existingUserResult = Usuario.create({
        id: 'existing-id',
        email: emailResult.value,
        password: 'hashed-password',
        nombre: 'Existing',
        apellidos: 'User'
      });
      
      if (!existingUserResult.isSuccess) throw new Error('Failed to create existing user');

      usuarioRepository.findByEmail.mockResolvedValue(success(existingUserResult.value));

      // Act
      const result = await registerUser.execute(validInput);

      // Assert
      expect(result.isSuccess).toBe(false);
      expect(passwordHasher.hash).not.toHaveBeenCalled();
      expect(usuarioRepository.save).not.toHaveBeenCalled();
    });

    it('debería manejar errores del repositorio al buscar email', async () => {
      // Arrange
      usuarioRepository.findByEmail.mockResolvedValue(failure(new Error('Database error')));

      // Act
      const result = await registerUser.execute(validInput);

      // Assert
      expect(result.isSuccess).toBe(false);
      expect(passwordHasher.hash).not.toHaveBeenCalled();
    });

    it('debería manejar errores del password hasher', async () => {
      // Arrange
      usuarioRepository.findByEmail.mockResolvedValue(success(null));
      passwordHasher.hash.mockResolvedValue(failure(new Error('Hash error')));

      // Act
      const result = await registerUser.execute(validInput);

      // Assert
      expect(result.isSuccess).toBe(false);
      expect(usuarioRepository.save).not.toHaveBeenCalled();
    });

    it('debería manejar errores del repositorio al guardar', async () => {
      // Arrange
      usuarioRepository.findByEmail.mockResolvedValue(success(null));
      passwordHasher.hash.mockResolvedValue(success('hashed-password'));
      usuarioRepository.save.mockResolvedValue(failure(new Error('Save error')));

      // Act
      const result = await registerUser.execute(validInput);

      // Assert
      expect(result.isSuccess).toBe(false);
    });
  });
});