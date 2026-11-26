import { RegisterUser } from '../../../../../src/application/use-cases/auth/RegisterUser';
import type { ITurnstileVerifier } from '../../../../../src/application/ports/auth/ITurnstileVerifier';
import { IUsuarioRepository } from '../../../../../src/application/ports/repositories/IUsuarioRepository';
import { IPasswordHasher } from '../../../../../src/application/ports/auth/IPasswordHasher';
import { Usuario } from '../../../../../src/domain/entities/Usuario';
import { Email } from '../../../../../src/domain/value-objects/Email';
import { success, failure } from '../../../../../src/shared/result';

describe('RegisterUser', () => {
  let registerUser: RegisterUser;
  let usuarioRepository: jest.Mocked<IUsuarioRepository>;
  let passwordHasher: jest.Mocked<IPasswordHasher>;
  let turnstileVerifier: jest.Mocked<ITurnstileVerifier>;

  beforeEach(() => {
    usuarioRepository = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      save: jest.fn(),
      findByIdList: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findAll: jest.fn(),
      existsByEmail: jest.fn().mockResolvedValue(success(false))
    } as any;

    passwordHasher = {
      hash: jest.fn(),
      verify: jest.fn(),
      needsRehash: jest.fn()
    } as any;

    turnstileVerifier = {
      enabled: jest.fn().mockReturnValue(false),
      verify: jest.fn(),
    } as unknown as jest.Mocked<ITurnstileVerifier>;

    registerUser = new RegisterUser(usuarioRepository, passwordHasher, turnstileVerifier);
  });

  describe('execute', () => {
    const validInput = {
      nombre: 'Juan',
      apellidos: 'Pérez García',
      email: 'juan.perez@example.com',
      password: 'SecurePass123!',
      aceptoTerminos: true
    };

    it('debería registrar un usuario exitosamente', async () => {
      // Arrange
      usuarioRepository.existsByEmail.mockResolvedValue(success(false));
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
      expect(usuarioRepository.existsByEmail).toHaveBeenCalled();
      const emailArg = usuarioRepository.existsByEmail.mock.calls[0]?.[0];
      expect(emailArg).toBeDefined();
      expect(emailArg?.value).toBe('juan.perez@example.com');
      expect(passwordHasher.hash).toHaveBeenCalled();
      expect(usuarioRepository.save).toHaveBeenCalled();
    });

    it('debería fallar con datos de entrada inválidos', async () => {
      // Arrange
      const invalidInput = {
        nombre: '',
        apellidos: 'Pérez',
        email: 'invalid-email',
        password: '123',
        aceptoTerminos: true
      };

      // Act
      const result = await registerUser.execute(invalidInput);

      // Assert
      expect(result.isSuccess).toBe(false);
      expect(usuarioRepository.findByEmail).not.toHaveBeenCalled();
    });

    it('debería fallar si no se aceptan los Términos de Servicio', async () => {
      // Act
      const result = await registerUser.execute({ ...validInput, aceptoTerminos: false });

      // Assert
      expect(result.isSuccess).toBe(false);
      expect(usuarioRepository.existsByEmail).not.toHaveBeenCalled();
      expect(usuarioRepository.save).not.toHaveBeenCalled();
    });

    it('debería fallar si falta la aceptación de los Términos de Servicio', async () => {
      // Arrange
      const sinAceptacion = {
        nombre: 'Juan',
        apellidos: 'Pérez García',
        email: 'juan.perez@example.com',
        password: 'Password123!'
      };

      // Act
      const result = await registerUser.execute(sinAceptacion as any);

      // Assert
      expect(result.isSuccess).toBe(false);
      expect(usuarioRepository.save).not.toHaveBeenCalled();
    });

    it('debería rechazar el registro sin token de captcha cuando Turnstile está activo', async () => {
      turnstileVerifier.enabled.mockReturnValue(true);

      const result = await registerUser.execute(validInput);

      expect(result.isFailure).toBe(true);
      if (result.isFailure) {
        expect(result.error.message).toContain('verificación de seguridad');
      }
      expect(turnstileVerifier.verify).not.toHaveBeenCalled();
      expect(usuarioRepository.save).not.toHaveBeenCalled();
    });

    it('debería rechazar el registro cuando Cloudflare no valida el token', async () => {
      turnstileVerifier.enabled.mockReturnValue(true);
      turnstileVerifier.verify.mockResolvedValue(false);

      const result = await registerUser.execute({ ...validInput, turnstileToken: 'token-malo' });

      expect(result.isFailure).toBe(true);
      expect(turnstileVerifier.verify).toHaveBeenCalledWith('token-malo');
      expect(usuarioRepository.save).not.toHaveBeenCalled();
    });

    it('debería registrar cuando Turnstile está activo y el token es válido', async () => {
      turnstileVerifier.enabled.mockReturnValue(true);
      turnstileVerifier.verify.mockResolvedValue(true);
      passwordHasher.hash.mockResolvedValue(success('hashed-password'));
      usuarioRepository.save.mockImplementation(async (usuario: Usuario) => success(usuario));

      const result = await registerUser.execute({ ...validInput, turnstileToken: 'token-valido' });

      expect(result.isSuccess).toBe(true);
      expect(turnstileVerifier.verify).toHaveBeenCalledWith('token-valido');
    });

    it('debería guardar la fecha de aceptación de los Términos al registrar', async () => {
      // Arrange
      usuarioRepository.existsByEmail.mockResolvedValue(success(false));
      passwordHasher.hash.mockResolvedValue(success('hashed-password'));
      usuarioRepository.save.mockImplementation(async (usuario: Usuario) => success(usuario));

      // Act
      const result = await registerUser.execute(validInput);

      // Assert
      expect(result.isSuccess).toBe(true);
      if (!result.isSuccess) throw new Error('Expected success');
      expect(result.value.terminosAceptadosEn).toBeDefined();
      const usuarioGuardado = usuarioRepository.save.mock.calls[0]?.[0] as Usuario;
      expect(usuarioGuardado.terminosAceptadosEn).toBeInstanceOf(Date);
    });

    it('debería fallar si el email ya está registrado', async () => {
      // Arrange
      usuarioRepository.existsByEmail.mockResolvedValue(success(true));
      passwordHasher.hash.mockResolvedValue(success('hashed-password'));

      // Act
      const result = await registerUser.execute(validInput);

      // Assert
      expect(result.isSuccess).toBe(false);
      expect(passwordHasher.hash).not.toHaveBeenCalled();
      expect(usuarioRepository.save).not.toHaveBeenCalled();
    });

    it('debería manejar errores del repositorio al buscar email', async () => {
      // Arrange
      usuarioRepository.existsByEmail.mockResolvedValue(failure(new Error('Database error')));
      passwordHasher.hash.mockResolvedValue(success('hashed-password'));

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

    it('debería enviar el código de verificación tras registrar', async () => {
      // Arrange
      usuarioRepository.existsByEmail.mockResolvedValue(success(false));
      passwordHasher.hash.mockResolvedValue(success('hashed-password'));

      const emailResult = Email.create('juan.perez@example.com');
      if (!emailResult.isSuccess) throw new Error('Failed to create email');
      const userResult = Usuario.create({
        id: 'new-id',
        email: emailResult.value,
        password: 'hashed-password',
        nombre: 'Juan',
        apellidos: 'Pérez García',
      });
      if (!userResult.isSuccess) throw new Error('Failed to create user');
      usuarioRepository.save.mockResolvedValue(success(userResult.value));

      const requestVerificationCode = {
        execute: jest.fn().mockResolvedValue(success({ emailSent: true, mensaje: 'ok' })),
      } as any;
      const registerWithCode = new RegisterUser(
        usuarioRepository,
        passwordHasher,
        turnstileVerifier,
        requestVerificationCode
      );

      // Act
      const result = await registerWithCode.execute(validInput);

      // Assert
      expect(result.isSuccess).toBe(true);
      if (!result.isSuccess) return;
      expect(result.value.verificationEmailSent).toBe(true);
      expect(requestVerificationCode.execute).toHaveBeenCalledWith({
        email: 'juan.perez@example.com',
      });
    });

    it('debería registrar aunque el envío del código falle', async () => {
      // Arrange
      usuarioRepository.existsByEmail.mockResolvedValue(success(false));
      passwordHasher.hash.mockResolvedValue(success('hashed-password'));

      const emailResult = Email.create('juan.perez@example.com');
      if (!emailResult.isSuccess) throw new Error('Failed to create email');
      const userResult = Usuario.create({
        id: 'new-id',
        email: emailResult.value,
        password: 'hashed-password',
        nombre: 'Juan',
        apellidos: 'Pérez García',
      });
      if (!userResult.isSuccess) throw new Error('Failed to create user');
      usuarioRepository.save.mockResolvedValue(success(userResult.value));

      const requestVerificationCode = {
        execute: jest.fn().mockResolvedValue(success({ emailSent: false, mensaje: 'sin correo' })),
      } as any;
      const registerWithCode = new RegisterUser(
        usuarioRepository,
        passwordHasher,
        turnstileVerifier,
        requestVerificationCode
      );

      // Act
      const result = await registerWithCode.execute(validInput);

      // Assert
      expect(result.isSuccess).toBe(true);
      if (!result.isSuccess) return;
      expect(result.value.verificationEmailSent).toBe(false);
    });
  });
});