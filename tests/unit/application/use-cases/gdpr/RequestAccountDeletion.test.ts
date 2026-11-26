/**
 * Tests para RequestAccountDeletion (GDPR, item 15)
 */

import { RequestAccountDeletion } from '../../../../../src/application/use-cases/gdpr/RequestAccountDeletion';
import { IUsuarioRepository } from '../../../../../src/application/ports/repositories/IUsuarioRepository';
import { IPasswordHasher } from '../../../../../src/application/ports/auth/IPasswordHasher';
import { Usuario } from '../../../../../src/domain/entities/Usuario';
import { Email } from '../../../../../src/domain/value-objects/Email';
import { success } from '../../../../../src/shared/result';
import { NotFoundError } from '../../../../../src/application/errors/NotFoundError';
import { UnauthorizedError } from '../../../../../src/application/errors/UnauthorizedError';
import { ValidationError } from '../../../../../src/application/errors/ValidationError';
import { v4 as uuidv4 } from 'uuid';

describe('RequestAccountDeletion', () => {
  let requestAccountDeletion: RequestAccountDeletion;
  let usuarioRepository: jest.Mocked<IUsuarioRepository>;
  let passwordHasher: jest.Mocked<IPasswordHasher>;

  const buildUsuario = () => {
    const emailResult = Email.create('antonio@example.com');
    if (emailResult.isFailure) throw new Error('Email de prueba inválido');
    const userResult = Usuario.create({
      id: uuidv4(),
      email: emailResult.value,
      password: 'hashed-password-1234567890',
      nombre: 'Antonio',
      apellidos: 'Moles Leiva',
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
      findAll: jest.fn(),
    } as any;

    passwordHasher = {
      hash: jest.fn(),
      verify: jest.fn(),
      needsRehash: jest.fn(),
    } as any;

    requestAccountDeletion = new RequestAccountDeletion(usuarioRepository, passwordHasher);
  });

  it('solicita la eliminación con la contraseña correcta: desactiva y fija la fecha', async () => {
    const usuario = buildUsuario();
    usuarioRepository.findById.mockResolvedValue(success(usuario));
    passwordHasher.verify.mockResolvedValue(success(true));
    usuarioRepository.update.mockResolvedValue(success(usuario));

    const result = await requestAccountDeletion.execute({
      usuarioId: usuario.id,
      password: 'SecurePass123!',
    });

    expect(result.isSuccess).toBe(true);
    expect(usuario.activo).toBe(false);
    expect(usuario.eliminacionSolicitadaEn).toBeInstanceOf(Date);
    if (result.isSuccess) {
      expect(result.value.eliminacionSolicitadaEn).toBe(
        usuario.eliminacionSolicitadaEn?.toISOString()
      );
      const solicitada = new Date(result.value.eliminacionSolicitadaEn);
      const definitiva = new Date(result.value.eliminacionDefinitivaEn);
      expect(definitiva.getTime() - solicitada.getTime()).toBe(30 * 24 * 60 * 60 * 1000);
    }
    expect(usuarioRepository.update).toHaveBeenCalledWith(usuario);
  });

  it('rechaza la solicitud con la contraseña incorrecta', async () => {
    const usuario = buildUsuario();
    usuarioRepository.findById.mockResolvedValue(success(usuario));
    passwordHasher.verify.mockResolvedValue(success(false));

    const result = await requestAccountDeletion.execute({
      usuarioId: usuario.id,
      password: 'ClaveMala123!',
    });

    expect(result.isFailure).toBe(true);
    if (result.isFailure) {
      expect(result.error).toBeInstanceOf(UnauthorizedError);
    }
    expect(usuario.activo).toBe(true);
    expect(usuarioRepository.update).not.toHaveBeenCalled();
  });

  it('rechaza la solicitud si el usuario no existe', async () => {
    usuarioRepository.findById.mockResolvedValue(success(null));

    const result = await requestAccountDeletion.execute({
      usuarioId: 'usuario-inexistente',
      password: 'SecurePass123!',
    });

    expect(result.isFailure).toBe(true);
    if (result.isFailure) {
      expect(result.error).toBeInstanceOf(NotFoundError);
    }
    expect(passwordHasher.verify).not.toHaveBeenCalled();
  });

  it('es idempotente si la eliminación ya se solicitó', async () => {
    const usuario = buildUsuario();
    usuario.solicitarEliminacion();
    const fechaSolicitada = usuario.eliminacionSolicitadaEn as Date;
    usuarioRepository.findById.mockResolvedValue(success(usuario));

    const result = await requestAccountDeletion.execute({
      usuarioId: usuario.id,
      password: 'SecurePass123!',
    });

    expect(result.isSuccess).toBe(true);
    if (result.isSuccess) {
      expect(result.value.eliminacionSolicitadaEn).toBe(fechaSolicitada.toISOString());
    }
    expect(passwordHasher.verify).not.toHaveBeenCalled();
    expect(usuarioRepository.update).not.toHaveBeenCalled();
  });

  it('rechaza la solicitud si la cuenta está inactiva sin solicitud previa', async () => {
    const usuario = buildUsuario();
    usuario.desactivar();
    usuarioRepository.findById.mockResolvedValue(success(usuario));

    const result = await requestAccountDeletion.execute({
      usuarioId: usuario.id,
      password: 'SecurePass123!',
    });

    expect(result.isFailure).toBe(true);
    if (result.isFailure) {
      expect(result.error).toBeInstanceOf(ValidationError);
    }
    expect(passwordHasher.verify).not.toHaveBeenCalled();
  });
});
