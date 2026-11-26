/**
 * Tests para UpdateProfile (13A)
 */

import { UpdateProfile } from '../../../../../src/application/use-cases/auth/UpdateProfile';
import { IUsuarioRepository } from '../../../../../src/application/ports/repositories/IUsuarioRepository';
import { Usuario } from '../../../../../src/domain/entities/Usuario';
import { Email } from '../../../../../src/domain/value-objects/Email';
import { success } from '../../../../../src/shared/result';
import { v4 as uuidv4 } from 'uuid';

describe('UpdateProfile', () => {
  let updateProfile: UpdateProfile;
  let usuarioRepository: jest.Mocked<IUsuarioRepository>;

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
      existsByEmail: jest.fn().mockResolvedValue(success(false)),
      findAll: jest.fn()
    } as any;

    updateProfile = new UpdateProfile(usuarioRepository);
  });

  it('debería actualizar el nombre completo dividiéndolo en nombre y apellidos', async () => {
    const usuario = buildUsuario();
    usuarioRepository.findById.mockResolvedValue(success(usuario));
    usuarioRepository.update.mockResolvedValue(success(usuario));

    const result = await updateProfile.execute({ usuarioId: usuario.id, nombre: 'Antonio García Ruiz' });

    expect(result.isSuccess).toBe(true);
    if (result.isSuccess) {
      expect(result.value.name).toBe('Antonio García Ruiz');
      expect(result.value.email).toBe('antonio@example.com');
    }
    expect(usuarioRepository.update).toHaveBeenCalledTimes(1);
  });

  it('debería actualizar el email y marcarlo como no verificado', async () => {
    const usuario = buildUsuario();
    usuarioRepository.findById.mockResolvedValue(success(usuario));
    usuarioRepository.update.mockResolvedValue(success(usuario));

    const result = await updateProfile.execute({ usuarioId: usuario.id, email: 'nuevo@example.com' });

    expect(result.isSuccess).toBe(true);
    if (result.isSuccess) {
      expect(result.value.email).toBe('nuevo@example.com');
    }
  });

  it('debería fallar si el nuevo email ya está en uso', async () => {
    const usuario = buildUsuario();
    usuarioRepository.findById.mockResolvedValue(success(usuario));
    usuarioRepository.existsByEmail.mockResolvedValue(success(true));

    const result = await updateProfile.execute({ usuarioId: usuario.id, email: 'otro@example.com' });

    expect(result.isFailure).toBe(true);
    expect(usuarioRepository.update).not.toHaveBeenCalled();
  });

  it('debería fallar si el usuario no existe', async () => {
    usuarioRepository.findById.mockResolvedValue(success(null));

    const result = await updateProfile.execute({ usuarioId: uuidv4(), nombre: 'Alguien' });

    expect(result.isFailure).toBe(true);
  });
});
