/**
 * Tests unitarios para RequestEmailVerificationCode (item 3)
 */

import { RequestEmailVerificationCode } from '../../../../../src/application/use-cases/auth/RequestEmailVerificationCode';
import type { IUsuarioRepository } from '../../../../../src/application/ports/repositories/IUsuarioRepository';
import type { IEmailVerificationCodeRepository } from '../../../../../src/application/ports/repositories/IEmailVerificationCodeRepository';
import type { IEmailService } from '../../../../../src/application/ports/external/IEmailService';
import { Usuario } from '../../../../../src/domain/entities/Usuario';
import { Email } from '../../../../../src/domain/value-objects/Email';
import { success, failure } from '../../../../../src/shared/result';

describe('RequestEmailVerificationCode', () => {
  let useCase: RequestEmailVerificationCode;
  let usuarioRepository: jest.Mocked<IUsuarioRepository>;
  let codigoRepository: jest.Mocked<IEmailVerificationCodeRepository>;
  let emailService: jest.Mocked<IEmailService>;

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

  beforeEach(() => {
    usuarioRepository = { findByEmail: jest.fn() } as any;
    codigoRepository = {
      create: jest.fn(),
      findLatestPendingByUsuarioId: jest.fn(),
      findLatestByUsuarioId: jest.fn(),
      incrementAttempts: jest.fn(),
      markUsed: jest.fn(),
    } as any;
    emailService = { sendVerificationCodeEmail: jest.fn() } as any;

    useCase = new RequestEmailVerificationCode(usuarioRepository, codigoRepository, emailService);
  });

  it('debería generar y enviar el código', async () => {
    const usuario = buildUser(false);
    usuarioRepository.findByEmail.mockResolvedValue(success(usuario));
    codigoRepository.findLatestByUsuarioId.mockResolvedValue(success(null));
    codigoRepository.create.mockResolvedValue(
      success({
        id: 'code-id',
        usuarioId: 'user-id',
        codeHash: 'hash',
        intentos: 0,
        expiraAt: new Date(Date.now() + 900000),
        usado: false,
        usadoAt: null,
        createdAt: new Date(),
      })
    );
    emailService.sendVerificationCodeEmail.mockResolvedValue({ success: true });

    const result = await useCase.execute({ email: 'juan.perez@example.com' });

    expect(result.isSuccess).toBe(true);
    if (!result.isSuccess) return;
    expect(result.value.emailSent).toBe(true);
    expect(codigoRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ usuarioId: 'user-id', ttlSeconds: 900 })
    );
    const codeHash = codigoRepository.create.mock.calls[0]?.[0]?.codeHash;
    expect(typeof codeHash).toBe('string');
    expect(codeHash?.length).toBeGreaterThan(10);
    const sentCode = emailService.sendVerificationCodeEmail.mock.calls[0]?.[2];
    expect(sentCode).toMatch(/^\d{6}$/);
    expect(emailService.sendVerificationCodeEmail).toHaveBeenCalledWith(
      'juan.perez@example.com',
      'Juan',
      sentCode
    );
  });

  it('debería rechazar un email inválido', async () => {
    const result = await useCase.execute({ email: 'no-es-email' });
    expect(result.isFailure).toBe(true);
    expect(usuarioRepository.findByEmail).not.toHaveBeenCalled();
  });

  it('no debería revelar si el correo no existe', async () => {
    usuarioRepository.findByEmail.mockResolvedValue(success(null));
    const result = await useCase.execute({ email: 'nadie@example.com' });
    expect(result.isSuccess).toBe(true);
    if (!result.isSuccess) return;
    expect(result.value.emailSent).toBe(false);
    expect(codigoRepository.create).not.toHaveBeenCalled();
    expect(emailService.sendVerificationCodeEmail).not.toHaveBeenCalled();
  });

  it('debería indicar que el correo ya está verificado', async () => {
    usuarioRepository.findByEmail.mockResolvedValue(success(buildUser(true)));
    const result = await useCase.execute({ email: 'juan.perez@example.com' });
    expect(result.isSuccess).toBe(true);
    if (!result.isSuccess) return;
    expect(result.value.emailSent).toBe(false);
    expect(result.value.mensaje).toContain('ya está verificado');
    expect(codigoRepository.create).not.toHaveBeenCalled();
  });

  it('debería respetar el enfriamiento de 60 s entre reenvíos', async () => {
    const usuario = buildUser(false);
    usuarioRepository.findByEmail.mockResolvedValue(success(usuario));
    codigoRepository.findLatestByUsuarioId.mockResolvedValue(
      success({
        id: 'code-id',
        usuarioId: 'user-id',
        codeHash: 'hash',
        intentos: 0,
        expiraAt: new Date(Date.now() + 900000),
        usado: false,
        usadoAt: null,
        createdAt: new Date(Date.now() - 10000),
      })
    );

    const result = await useCase.execute({ email: 'juan.perez@example.com' });

    expect(result.isSuccess).toBe(true);
    if (!result.isSuccess) return;
    expect(result.value.emailSent).toBe(false);
    expect(result.value.mensaje).toContain('Espera un minuto');
    expect(codigoRepository.create).not.toHaveBeenCalled();
  });

  it('debería devolver emailSent false si el envío falla (el código queda guardado)', async () => {
    const usuario = buildUser(false);
    usuarioRepository.findByEmail.mockResolvedValue(success(usuario));
    codigoRepository.findLatestByUsuarioId.mockResolvedValue(success(null));
    codigoRepository.create.mockResolvedValue(
      success({
        id: 'code-id',
        usuarioId: 'user-id',
        codeHash: 'hash',
        intentos: 0,
        expiraAt: new Date(Date.now() + 900000),
        usado: false,
        usadoAt: null,
        createdAt: new Date(),
      })
    );
    emailService.sendVerificationCodeEmail.mockResolvedValue({
      success: false,
      error: 'sin clave',
    });

    const result = await useCase.execute({ email: 'juan.perez@example.com' });

    expect(result.isSuccess).toBe(true);
    if (!result.isSuccess) return;
    expect(result.value.emailSent).toBe(false);
    expect(codigoRepository.create).toHaveBeenCalled();
  });

  it('debería propagar el fallo del repositorio', async () => {
    const usuario = buildUser(false);
    usuarioRepository.findByEmail.mockResolvedValue(success(usuario));
    codigoRepository.findLatestByUsuarioId.mockResolvedValue(failure(new Error('db caída')));

    const result = await useCase.execute({ email: 'juan.perez@example.com' });

    expect(result.isFailure).toBe(true);
  });
});
