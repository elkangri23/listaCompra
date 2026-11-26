/**
 * Tests para ChangePassword (13A)
 */

import { ChangePassword } from '../../../../../src/application/use-cases/auth/ChangePassword';
import { IUsuarioRepository } from '../../../../../src/application/ports/repositories/IUsuarioRepository';
import { IPasswordHasher } from '../../../../../src/application/ports/auth/IPasswordHasher';
import { Usuario } from '../../../../../src/domain/entities/Usuario';
import { Email } from '../../../../../src/domain/value-objects/Email';
import { success } from '../../../../../src/shared/result';
import { v4 as uuidv4 } from 'uuid';

describe('ChangePassword', () => {
  let changePassword: ChangePassword;
  let usuarioRepository: jest.Mocked<IUsuarioRepository>;
  let passwordHasher: jest.Mocked<IPasswordHasher>;

  const buildUsuario = () => {
    const emailResult = Email.create('antonio@example.com');
    if (emailResult.isFailure) throw new Error('Email de prueba inválido');
    const userResult = Usuario.create({
      id: uuidv4(),
      email: emailResult.value,
      password: 'hashed-password-actual',
      nombre: 'Antonio',
      apellidos: 'Moles Leiva'
    });
    if (userResult.isFailure) throw new Error('Usuario de prueba inválido');
    return userResult.value;
  };

  beforeEach(() => {
    usuarioRepository = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      existsByEmail: jest.fn(),
      findAll: jest.fn()
    } as any;

    passwordHasher = {
      hash: jest.fn(),
      verify: jest.fn(),
      needsRehash: jest.fn()
    } as any;

    changePassword = new ChangePassword(usuarioRepository, passwordHasher);
  });

  it('debería cambiar la contraseña con la actual correcta', async () => {
    const usuario = buildUsuario();
    usuarioRepository.findById.mockResolvedValue(success(usuario));
    usuarioRepository.update.mockResolvedValue(success(usuario));
    passwordHasher.verify.mockResolvedValue(success(true));
    passwordHasher.hash.mockResolvedValue(success('nuevo-hash-seguro'));

    const result = await changePassword.execute({
      usuarioId: usuario.id,
      currentPassword: 'Actual123',
      newPassword: 'Nueva456'
    });

    expect(result.isSuccess).toBe(true);
    expect(passwordHasher.verify).toHaveBeenCalledWith(expect.anything(), 'hashed-password-actual');
    expect(passwordHasher.hash).toHaveBeenCalledTimes(1);
    expect(usuarioRepository.update).toHaveBeenCalledTimes(1);
  });

  it('debería fallar si la contraseña actual no es correcta', async () => {
    const usuario = buildUsuario();
    usuarioRepository.findById.mockResolvedValue(success(usuario));
    passwordHasher.verify.mockResolvedValue(success(false));

    const result = await changePassword.execute({
      usuarioId: usuario.id,
      currentPassword: 'Actual123',
      newPassword: 'Nueva456'
    });

    expect(result.isFailure).toBe(true);
    expect(passwordHasher.hash).not.toHaveBeenCalled();
    expect(usuarioRepository.update).not.toHaveBeenCalled();
  });

  it('debería fallar si la nueva contraseña es igual a la actual', async () => {
    const usuario = buildUsuario();
    usuarioRepository.findById.mockResolvedValue(success(usuario));

    const result = await changePassword.execute({
      usuarioId: usuario.id,
      currentPassword: 'Actual123',
      newPassword: 'Actual123'
    });

    expect(result.isFailure).toBe(true);
    expect(passwordHasher.verify).not.toHaveBeenCalled();
  });

  it('debería fallar si la nueva contraseña es débil', async () => {
    const usuario = buildUsuario();
    usuarioRepository.findById.mockResolvedValue(success(usuario));
    passwordHasher.verify.mockResolvedValue(success(true));

    const result = await changePassword.execute({
      usuarioId: usuario.id,
      currentPassword: 'Actual123',
      newPassword: 'corta'
    });

    expect(result.isFailure).toBe(true);
    expect(passwordHasher.hash).not.toHaveBeenCalled();
  });
});
