/**
 * Tests unitarios para VerifyEmailCode (item 3)
 */

import { VerifyEmailCode } from '../../../../../src/application/use-cases/auth/VerifyEmailCode';
import type { IUsuarioRepository } from '../../../../../src/application/ports/repositories/IUsuarioRepository';
import type { IEmailVerificationCodeRepository } from '../../../../../src/application/ports/repositories/IEmailVerificationCodeRepository';
import { Usuario } from '../../../../../src/domain/entities/Usuario';
import { Email } from '../../../../../src/domain/value-objects/Email';
import { success, failure } from '../../../../../src/shared/result';
import { hmacVerificationCode } from '../../../../../src/infrastructure/security/email-verification-crypto';

describe('VerifyEmailCode', () => {
  let useCase: VerifyEmailCode;
  let usuarioRepository: jest.Mocked<IUsuarioRepository>;
  let codigoRepository: jest.Mocked<IEmailVerificationCodeRepository>;

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
    codeHash: hmacVerificationCode('482913'),
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

    useCase = new VerifyEmailCode(usuarioRepository, codigoRepository);
  });

  it('debería verificar el correo con el código correcto', async () => {
    const usuario = buildUser(false);
    usuarioRepository.findByEmail.mockResolvedValue(success(usuario));
    codigoRepository.findLatestPendingByUsuarioId.mockResolvedValue(success(pendingRow()));
    codigoRepository.markUsed.mockResolvedValue(success(undefined));
    usuarioRepository.update.mockResolvedValue(success(usuario));

    const result = await useCase.execute({ email: 'juan.perez@example.com', codigo: '482913' });

    expect(result.isSuccess).toBe(true);
    if (!result.isSuccess) return;
    expect(result.value.emailVerificado).toBe(true);
    expect(codigoRepository.markUsed).toHaveBeenCalledWith('code-id');
    expect(usuario.emailVerificado).toBe(true);
    expect(usuarioRepository.update).toHaveBeenCalledWith(usuario);
  });

  it('debería aceptar el código con espacios', async () => {
    const usuario = buildUser(false);
    usuarioRepository.findByEmail.mockResolvedValue(success(usuario));
    codigoRepository.findLatestPendingByUsuarioId.mockResolvedValue(success(pendingRow()));
    codigoRepository.markUsed.mockResolvedValue(success(undefined));
    usuarioRepository.update.mockResolvedValue(success(usuario));

    const result = await useCase.execute({ email: 'juan.perez@example.com', codigo: '482 913' });

    expect(result.isSuccess).toBe(true);
  });

  it('debería rechazar un código con formato inválido con el mensaje genérico', async () => {
    const result = await useCase.execute({ email: 'juan.perez@example.com', codigo: '123' });
    expect(result.isFailure).toBe(true);
    if (!result.isFailure) return;
    expect(result.error.message).toBe('El código no es válido o ha caducado.');
    expect(usuarioRepository.findByEmail).not.toHaveBeenCalled();
  });

  it('no debería revelar si el correo no existe', async () => {
    usuarioRepository.findByEmail.mockResolvedValue(success(null));
    const result = await useCase.execute({ email: 'nadie@example.com', codigo: '482913' });
    expect(result.isFailure).toBe(true);
    if (!result.isFailure) return;
    expect(result.error.message).toBe('El código no es válido o ha caducado.');
    expect(codigoRepository.findLatestPendingByUsuarioId).not.toHaveBeenCalled();
  });

  it('debería ser idempotente si el correo ya está verificado', async () => {
    usuarioRepository.findByEmail.mockResolvedValue(success(buildUser(true)));
    const result = await useCase.execute({ email: 'juan.perez@example.com', codigo: '000000' });
    expect(result.isSuccess).toBe(true);
    if (!result.isSuccess) return;
    expect(result.value.emailVerificado).toBe(true);
    expect(codigoRepository.findLatestPendingByUsuarioId).not.toHaveBeenCalled();
  });

  it('debería rechazar si no hay código pendiente', async () => {
    usuarioRepository.findByEmail.mockResolvedValue(success(buildUser(false)));
    codigoRepository.findLatestPendingByUsuarioId.mockResolvedValue(success(null));
    const result = await useCase.execute({ email: 'juan.perez@example.com', codigo: '482913' });
    expect(result.isFailure).toBe(true);
    if (!result.isFailure) return;
    expect(result.error.message).toBe('El código no es válido o ha caducado.');
  });

  it('debería rechazar si se agotaron los intentos', async () => {
    usuarioRepository.findByEmail.mockResolvedValue(success(buildUser(false)));
    codigoRepository.findLatestPendingByUsuarioId.mockResolvedValue(success(pendingRow(5)));
    const result = await useCase.execute({ email: 'juan.perez@example.com', codigo: '482913' });
    expect(result.isFailure).toBe(true);
    if (!result.isFailure) return;
    expect(result.error.message).toBe('El código no es válido o ha caducado.');
    expect(codigoRepository.incrementAttempts).not.toHaveBeenCalled();
  });

  it('debería contar el intento y decir cuántos quedan con un código incorrecto', async () => {
    usuarioRepository.findByEmail.mockResolvedValue(success(buildUser(false)));
    codigoRepository.findLatestPendingByUsuarioId.mockResolvedValue(success(pendingRow(1)));
    codigoRepository.incrementAttempts.mockResolvedValue(success(2));

    const result = await useCase.execute({ email: 'juan.perez@example.com', codigo: '111111' });

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

    const result = await useCase.execute({ email: 'juan.perez@example.com', codigo: '111111' });

    expect(result.isFailure).toBe(true);
    if (!result.isFailure) return;
    expect(result.error.message).toBe('El código no es válido o ha caducado.');
  });

  it('debería propagar el fallo de markUsed', async () => {
    usuarioRepository.findByEmail.mockResolvedValue(success(buildUser(false)));
    codigoRepository.findLatestPendingByUsuarioId.mockResolvedValue(success(pendingRow()));
    codigoRepository.markUsed.mockResolvedValue(failure(new Error('db caída')));

    const result = await useCase.execute({ email: 'juan.perez@example.com', codigo: '482913' });

    expect(result.isFailure).toBe(true);
    expect(usuarioRepository.update).not.toHaveBeenCalled();
  });
});
