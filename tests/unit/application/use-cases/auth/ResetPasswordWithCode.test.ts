/**
 * Tests unitarios para ResetPasswordWithCode (item 9c)
 */

import { ResetPasswordWithCode } from '../../../../../src/application/use-cases/auth/ResetPasswordWithCode';
import type { IUsuarioRepository } from '../../../../../src/application/ports/repositories/IUsuarioRepository';
import type { IPasswordResetCodeRepository } from '../../../../../src/application/ports/repositories/IPasswordResetCodeRepository';
import { Usuario } from '../../../../../src/domain/entities/Usuario';
import { Email } from '../../../../../src/domain/value-objects/Email';
import { success, failure } from '../../../../../src/shared/result';
import { hmacResetCode } from '../../../../../src/infrastructure/security/password-reset-crypto';

describe('ResetPasswordWithCode', () => {
  let useCase: ResetPasswordWithCode;
  let usuarioRepository: jest.Mocked<IUsuarioRepository>;
  let codigoRepository: jest.Mocked<IPasswordResetCodeRepository>;
  let passwordHasher: { hash: jest.Mock; verify: jest.Mock; needsRehash: jest.Mock };

  const buildUser = (emailVerificado = false): Usuario => {
    const emailResult = Email.create('juan.perez@example.com');
    if (!emailResult.isSuccess) throw new Error('Failed to create email');
    const userResult = Usuario.create({
      id: 'user-id',
      email: emailResult.value,
      password: 'hashed-password-123',
      nombre: 'Juan',
      apellidos: 'Pérez García',
      emailVerificado,
    });
    if (!userResult.isSuccess) throw new Error('Failed to create user');
    return userResult.value;
  };

  const pendingRow = (intentos = 0) => ({
    id: 'code-id',
    usuarioId: 'user-id',
    codeHash: hmacResetCode('482913'),
    intentos,
    expiraAt: new Date(Date.now() + 900000),
    usado: false,
    usadoAt: null,
    createdAt: new Date(),
  });

  beforeEach(() => {
    usuarioRepository = { findByEmail: jest.fn(), update: jest.fn() } as any;
    codigoRepository = {
      create: jest.fn(),
      findLatestPendingByUsuarioId: jest.fn(),
      findLatestByUsuarioId: jest.fn(),
      incrementAttempts: jest.fn(),
      markUsed: jest.fn(),
    } as any;

    passwordHasher = { hash: jest.fn(), verify: jest.fn(), needsRehash: jest.fn() } as any;
    passwordHasher.hash.mockResolvedValue(success('nuevo-hash-bcrypt-0123456789'));

    useCase = new ResetPasswordWithCode(usuarioRepository, codigoRepository, passwordHasher);
  });

  it('debería verificar el correo con el código correcto', async () => {
    const usuario = buildUser(false);
    usuarioRepository.findByEmail.mockResolvedValue(success(usuario));
    codigoRepository.findLatestPendingByUsuarioId.mockResolvedValue(success(pendingRow()));
    codigoRepository.markUsed.mockResolvedValue(success(undefined));
    usuarioRepository.update.mockResolvedValue(success(usuario));

    const result = await useCase.execute({ email: 'juan.perez@example.com', codigo: '482913', nuevaPassword: 'NuevaPass123!' });

    expect(result.isSuccess).toBe(true);
    if (!result.isSuccess) return;
    expect(result.value.mensaje).toContain('contraseña ha sido cambiada');
    expect(codigoRepository.markUsed).toHaveBeenCalledWith('code-id');
    expect(usuario.password).toBe('nuevo-hash-bcrypt-0123456789');
    expect(usuarioRepository.update).toHaveBeenCalledWith(usuario);
  });

  it('debería aceptar el código con espacios', async () => {
    const usuario = buildUser(false);
    usuarioRepository.findByEmail.mockResolvedValue(success(usuario));
    codigoRepository.findLatestPendingByUsuarioId.mockResolvedValue(success(pendingRow()));
    codigoRepository.markUsed.mockResolvedValue(success(undefined));
    usuarioRepository.update.mockResolvedValue(success(usuario));

    const result = await useCase.execute({ email: 'juan.perez@example.com', codigo: '482 913', nuevaPassword: 'NuevaPass123!' });

    expect(result.isSuccess).toBe(true);
  });

  it('debería rechazar un código con formato inválido con el mensaje genérico', async () => {
    const result = await useCase.execute({ email: 'juan.perez@example.com', codigo: '123', nuevaPassword: 'NuevaPass123!' });
    expect(result.isFailure).toBe(true);
    if (!result.isFailure) return;
    expect(result.error.message).toBe('El código no es válido o ha caducado.');
    expect(usuarioRepository.findByEmail).not.toHaveBeenCalled();
  });

  it('no debería revelar si el correo no existe', async () => {
    usuarioRepository.findByEmail.mockResolvedValue(success(null));
    const result = await useCase.execute({ email: 'nadie@example.com', codigo: '482913', nuevaPassword: 'NuevaPass123!' });
    expect(result.isFailure).toBe(true);
    if (!result.isFailure) return;
    expect(result.error.message).toBe('El código no es válido o ha caducado.');
    expect(codigoRepository.findLatestPendingByUsuarioId).not.toHaveBeenCalled();
  });

  it('debería rechazar una cuenta desactivada con el mensaje genérico', async () => {
    const usuario = buildUser(false);
    usuario.solicitarEliminacion();
    usuarioRepository.findByEmail.mockResolvedValue(success(usuario));
    const result = await useCase.execute({ email: 'juan.perez@example.com', codigo: '482913', nuevaPassword: 'NuevaPass123!' });
    expect(result.isFailure).toBe(true);
    if (!result.isFailure) return;
    expect(result.error.message).toBe('El código no es válido o ha caducado.');
    expect(codigoRepository.findLatestPendingByUsuarioId).not.toHaveBeenCalled();
  });

  it('debería rechazar una contraseña nueva débil sin consumir el código', async () => {
    const usuario = buildUser(false);
    usuarioRepository.findByEmail.mockResolvedValue(success(usuario));
    codigoRepository.findLatestPendingByUsuarioId.mockResolvedValue(success(pendingRow()));
    const result = await useCase.execute({ email: 'juan.perez@example.com', codigo: '482913', nuevaPassword: 'corta' });
    expect(result.isFailure).toBe(true);
    if (!result.isFailure) return;
    expect(result.error.message).toContain('no cumple los requisitos');
    expect(codigoRepository.markUsed).not.toHaveBeenCalled();
    expect(usuarioRepository.update).not.toHaveBeenCalled();
  });

  it('debería rechazar si no hay código pendiente', async () => {
    usuarioRepository.findByEmail.mockResolvedValue(success(buildUser(false)));
    codigoRepository.findLatestPendingByUsuarioId.mockResolvedValue(success(null));
    const result = await useCase.execute({ email: 'juan.perez@example.com', codigo: '482913', nuevaPassword: 'NuevaPass123!' });
    expect(result.isFailure).toBe(true);
    if (!result.isFailure) return;
    expect(result.error.message).toBe('El código no es válido o ha caducado.');
  });

  it('debería rechazar si se agotaron los intentos', async () => {
    usuarioRepository.findByEmail.mockResolvedValue(success(buildUser(false)));
    codigoRepository.findLatestPendingByUsuarioId.mockResolvedValue(success(pendingRow(5)));
    const result = await useCase.execute({ email: 'juan.perez@example.com', codigo: '482913', nuevaPassword: 'NuevaPass123!' });
    expect(result.isFailure).toBe(true);
    if (!result.isFailure) return;
    expect(result.error.message).toBe('El código no es válido o ha caducado.');
    expect(codigoRepository.incrementAttempts).not.toHaveBeenCalled();
  });

  it('debería contar el intento y decir cuántos quedan con un código incorrecto', async () => {
    usuarioRepository.findByEmail.mockResolvedValue(success(buildUser(false)));
    codigoRepository.findLatestPendingByUsuarioId.mockResolvedValue(success(pendingRow(1)));
    codigoRepository.incrementAttempts.mockResolvedValue(success(2));

    const result = await useCase.execute({ email: 'juan.perez@example.com', codigo: '111111', nuevaPassword: 'NuevaPass123!' });

    expect(result.isFailure).toBe(true);
    if (!result.isFailure) return;
    expect(result.error.message).toBe('Código incorrecto. Te quedan 3 intentos.');
    expect(codigoRepository.incrementAttempts).toHaveBeenCalledWith('code-id', 5);
    expect(codigoRepository.markUsed).not.toHaveBeenCalled();
  });

  it('debería dar el mensaje genérico al agotar el último intento', async () => {
    usuarioRepository.findByEmail.mockResolvedValue(success(buildUser(false)));
    codigoRepository.findLatestPendingByUsuarioId.mockResolvedValue(success(pendingRow(4)));
    codigoRepository.incrementAttempts.mockResolvedValue(success(5));

    const result = await useCase.execute({ email: 'juan.perez@example.com', codigo: '111111', nuevaPassword: 'NuevaPass123!' });

    expect(result.isFailure).toBe(true);
    if (!result.isFailure) return;
    expect(result.error.message).toBe('El código no es válido o ha caducado.');
  });

  it('debería propagar el fallo de markUsed', async () => {
    usuarioRepository.findByEmail.mockResolvedValue(success(buildUser(false)));
    codigoRepository.findLatestPendingByUsuarioId.mockResolvedValue(success(pendingRow()));
    codigoRepository.markUsed.mockResolvedValue(failure(new Error('db caída')));

    const result = await useCase.execute({ email: 'juan.perez@example.com', codigo: '482913', nuevaPassword: 'NuevaPass123!' });

    expect(result.isFailure).toBe(true);
    expect(usuarioRepository.update).not.toHaveBeenCalled();
  });
});
