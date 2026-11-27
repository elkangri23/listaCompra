/**
 * Tests para DeclineInvitation (13A)
 */

import { DeclineInvitation } from '../../../../../src/application/use-cases/invitations/DeclineInvitation';
import type { IUsuarioRepository } from '../../../../../src/application/ports/repositories/IUsuarioRepository';
import type { IInvitacionRepository } from '../../../../../src/application/ports/repositories/IInvitacionRepository';
import { Usuario } from '../../../../../src/domain/entities/Usuario';
import { Invitacion } from '../../../../../src/domain/entities/Invitacion';
import { Email } from '../../../../../src/domain/value-objects/Email';
import { Hash } from '../../../../../src/domain/value-objects/Hash';
import { PermissionType } from '../../../../../src/domain/value-objects/PermissionType';
import { success } from '../../../../../src/shared/result';
import { v4 as uuidv4 } from 'uuid';

describe('DeclineInvitation', () => {
  let declineInvitation: DeclineInvitation;
  let usuarioRepository: jest.Mocked<IUsuarioRepository>;
  let invitacionRepository: jest.Mocked<IInvitacionRepository>;

  const buildUsuario = (email: string) => {
    const emailResult = Email.create(email);
    if (emailResult.isFailure) throw new Error('Email de prueba inválido');
    const userResult = Usuario.create({
      id: uuidv4(),
      email: emailResult.value,
      password: 'hashed-password-actual',
      nombre: 'Ana',
      apellidos: 'López'
    });
    if (userResult.isFailure) throw new Error('Usuario de prueba inválido');
    return userResult.value;
  };

  const buildInvitacion = (emailInvitado: string | null) => {
    const hashResult = Hash.create('abcd1234efgh5678ijkl9012mnop3456');
    const permisoResult = PermissionType.create('LECTURA');
    if (hashResult.isFailure || permisoResult.isFailure) throw new Error('VOs de prueba inválidos');
    const result = Invitacion.create(
      uuidv4(),
      uuidv4(),
      hashResult.value,
      permisoResult.value,
      new Date(),
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      true,
      emailInvitado
    );
    if (result.isFailure) throw new Error('Invitación de prueba inválida');
    return result.value;
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

    invitacionRepository = {
      findById: jest.fn(),
      findByHash: jest.fn(),
      findByListaId: jest.fn(),
      findActiveByListaId: jest.fn(),
      findPendingByEmail: jest.fn(),
      getAllActiveHashes: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findExpired: jest.fn(),
      deactivateExpired: jest.fn()
    } as any;

    declineInvitation = new DeclineInvitation(usuarioRepository, invitacionRepository);
  });

  it('debería rechazar una invitación dirigida al usuario', async () => {
    const usuario = buildUsuario('ana@example.com');
    const invitacion = buildInvitacion('ana@example.com');
    usuarioRepository.findById.mockResolvedValue(success(usuario));
    invitacionRepository.findById.mockResolvedValue(invitacion);
    invitacionRepository.update.mockResolvedValue(undefined);

    const result = await declineInvitation.execute({ invitacionId: invitacion.id, usuarioId: usuario.id });

    expect(result.isSuccess).toBe(true);
    expect(invitacionRepository.update).toHaveBeenCalledTimes(1);
    const guardada = invitacionRepository.update.mock.calls[0]?.[0];
    expect(guardada?.activa).toBe(false);
  });

  it('debería rechazar si la invitación no es para ese usuario', async () => {
    const usuario = buildUsuario('otro@example.com');
    const invitacion = buildInvitacion('ana@example.com');
    usuarioRepository.findById.mockResolvedValue(success(usuario));
    invitacionRepository.findById.mockResolvedValue(invitacion);

    const result = await declineInvitation.execute({ invitacionId: invitacion.id, usuarioId: usuario.id });

    expect(result.isFailure).toBe(true);
    expect(invitacionRepository.update).not.toHaveBeenCalled();
  });

  it('debería rechazar si la invitación no tiene email (enlaces antiguos)', async () => {
    const usuario = buildUsuario('ana@example.com');
    const invitacion = buildInvitacion(null);
    usuarioRepository.findById.mockResolvedValue(success(usuario));
    invitacionRepository.findById.mockResolvedValue(invitacion);

    const result = await declineInvitation.execute({ invitacionId: invitacion.id, usuarioId: usuario.id });

    expect(result.isFailure).toBe(true);
    expect(invitacionRepository.update).not.toHaveBeenCalled();
  });

  it('debería fallar si la invitación no existe', async () => {
    const usuario = buildUsuario('ana@example.com');
    usuarioRepository.findById.mockResolvedValue(success(usuario));
    invitacionRepository.findById.mockResolvedValue(null);

    const result = await declineInvitation.execute({ invitacionId: uuidv4(), usuarioId: usuario.id });

    expect(result.isFailure).toBe(true);
  });
});
