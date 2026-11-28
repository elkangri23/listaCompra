/**
 * Tests del registro de intentos de inicio de sesión en AuthenticateUser
 * (fase 5): un intento por login, con el motivo real, best-effort.
 */

import { AuthenticateUser } from '@application/use-cases/auth/AuthenticateUser';
import { Usuario, RolUsuario } from '@domain/entities/Usuario';
import { Email } from '@domain/value-objects/Email';
import type { Password } from '@domain/value-objects/Password';
import { InMemoryUsuarioRepository } from '@infrastructure/persistence/in-memory/InMemoryUsuarioRepository';
import { success } from '@shared/result';
import type { ILoginAttemptRecorder, LoginAttemptInput } from '@application/ports/external/ILoginAttemptRecorder';

const VALID_PASSWORD = 'SecurePass123!';

function makeUser(props: {
  email: string;
  activo?: boolean;
  emailVerificado?: boolean;
  totpEnabled?: boolean;
}): Usuario {
  const result = Usuario.create({
    id: `user-${props.email}`,
    email: Email.createUnsafe(props.email),
    password: 'hashed-password-very-long',
    nombre: 'Test',
    apellidos: 'User',
    rol: RolUsuario.USUARIO,
    activo: props.activo ?? true,
    emailVerificado: props.emailVerificado ?? true,
    totpEnabled: props.totpEnabled ?? false,
  });
  if (result.isFailure) {
    throw result.error;
  }
  return result.value;
}

function makeRecorder(): { recorder: ILoginAttemptRecorder; recorded: LoginAttemptInput[] } {
  const recorded: LoginAttemptInput[] = [];
  const recorder: ILoginAttemptRecorder = {
    record: async (input: LoginAttemptInput) => {
      recorded.push(input);
    },
  };
  return { recorder, recorded };
}

describe('AuthenticateUser — registro de intentos de login', () => {
  const passwordHasher = {
    verify: async (password: Password) => success(password.value === VALID_PASSWORD),
    hash: async () => success('hashed'),
    needsRehash: async () => success(false),
  } as never;
  const tokenService = {
    generateTokenPair: async () => success({ accessToken: 'access', refreshToken: 'refresh' }),
  } as never;
  const mfaRepository = {
    createTotpChallenge: async () => success({ id: 'ch-1' }),
  } as never;

  async function build(props?: { withRecorder?: boolean; throwingRecorder?: boolean }) {
    const users = new InMemoryUsuarioRepository();
    await users.save(makeUser({ email: 'ana@ejemplo.com' }));
    await users.save(makeUser({ email: 'inactivo@ejemplo.com', activo: false }));
    await users.save(makeUser({ email: 'sinverificar@ejemplo.com', emailVerificado: false }));
    await users.save(makeUser({ email: 'mfa@ejemplo.com', totpEnabled: true }));

    const { recorder, recorded } = makeRecorder();
    const throwingRecorder: ILoginAttemptRecorder = {
      record: async () => {
        throw new Error('BD caída');
      },
    };
    const useCase = new AuthenticateUser(
      users,
      passwordHasher,
      tokenService,
      mfaRepository,
      props?.throwingRecorder ? throwingRecorder : props?.withRecorder === false ? undefined : recorder
    );
    return { useCase, recorded };
  }

  it('login correcto registra success con email, IP y agente', async () => {
    const { useCase, recorded } = await build();
    const result = await useCase.execute({
      email: 'Ana@Ejemplo.com',
      password: VALID_PASSWORD,
      ipAddress: '9.9.9.9',
      userAgent: 'test-agent',
    });
    expect(result.isSuccess).toBe(true);
    expect(recorded).toHaveLength(1);
    expect(recorded[0]).toMatchObject({
      email: 'ana@ejemplo.com',
      success: true,
      reason: null,
      ipAddress: '9.9.9.9',
      userAgent: 'test-agent',
    });
  });

  it('contraseña incorrecta registra WRONG_PASSWORD y el login falla igual', async () => {
    const { useCase, recorded } = await build();
    const result = await useCase.execute({ email: 'ana@ejemplo.com', password: 'WrongPass123!' });
    expect(result.isFailure).toBe(true);
    expect(recorded).toHaveLength(1);
    expect(recorded[0]).toMatchObject({ email: 'ana@ejemplo.com', success: false, reason: 'WRONG_PASSWORD' });
  });

  it('usuario inexistente registra USER_NOT_FOUND', async () => {
    const { useCase, recorded } = await build();
    const result = await useCase.execute({ email: 'nadie@ejemplo.com', password: VALID_PASSWORD });
    expect(result.isFailure).toBe(true);
    expect(recorded[0]).toMatchObject({ email: 'nadie@ejemplo.com', success: false, reason: 'USER_NOT_FOUND' });
  });

  it('email sin verificar registra UNVERIFIED_EMAIL', async () => {
    const { useCase, recorded } = await build();
    const result = await useCase.execute({ email: 'sinverificar@ejemplo.com', password: VALID_PASSWORD });
    expect(result.isFailure).toBe(true);
    expect(recorded[0]).toMatchObject({ success: false, reason: 'UNVERIFIED_EMAIL' });
  });

  it('cuenta inactiva registra INACTIVE_ACCOUNT', async () => {
    const { useCase, recorded } = await build();
    const result = await useCase.execute({ email: 'inactivo@ejemplo.com', password: VALID_PASSWORD });
    expect(result.isFailure).toBe(true);
    expect(recorded[0]).toMatchObject({ success: false, reason: 'INACTIVE_ACCOUNT' });
  });

  it('paso 1 con TOTP (mfaRequired) NO registra nada: el login no está completo', async () => {
    const { useCase, recorded } = await build();
    const result = await useCase.execute({ email: 'mfa@ejemplo.com', password: VALID_PASSWORD });
    if (result.isFailure) {
      throw result.error;
    }
    expect('mfaRequired' in result.value).toBe(true);
    expect(recorded).toHaveLength(0);
  });

  it('un recorder que falla no rompe el login correcto ni el fallido', async () => {
    const { useCase: okCase } = await build({ throwingRecorder: true });
    const ok = await okCase.execute({ email: 'ana@ejemplo.com', password: VALID_PASSWORD });
    expect(ok.isSuccess).toBe(true);
    const { useCase: failCase } = await build({ throwingRecorder: true });
    const fail = await failCase.execute({ email: 'ana@ejemplo.com', password: 'WrongPass123!' });
    expect(fail.isFailure).toBe(true);
  });

  it('sin recorder el login funciona exactamente igual', async () => {
    const { useCase } = await build({ withRecorder: false });
    const result = await useCase.execute({ email: 'ana@ejemplo.com', password: VALID_PASSWORD });
    expect(result.isSuccess).toBe(true);
  });
});
