/**
 * Tests del registro de intentos de inicio de sesión en MfaLogin (fase 5):
 * el paso 2 del login con TOTP registra éxito y MFA_FAILED, best-effort.
 */

// Clave base64 de 32 bytes para los tests (antes de cualquier uso de mfa-crypto)
process.env['MFA_ENCRYPTION_KEY'] = Buffer.alloc(32, 7).toString('base64');

import { Usuario } from '@domain/entities/Usuario';
import { Email } from '@domain/value-objects/Email';
import type { Password } from '@domain/value-objects/Password';
import { MfaLogin } from '@application/use-cases/auth/MfaLogin';
import { AuthenticateUser } from '@application/use-cases/auth/AuthenticateUser';
import { SetupTotp } from '@application/use-cases/auth/SetupTotp';
import { VerifyEnableTotp } from '@application/use-cases/auth/VerifyEnableTotp';
import { success } from '@shared/result';
import { totpCodeAt } from '@infrastructure/security/totp';
import type { Result } from '@shared/result';
import type { ILoginAttemptRecorder, LoginAttemptInput } from '@application/ports/external/ILoginAttemptRecorder';

function val<T, E>(r: Result<T, E>): T {
  if (r.isSuccess) return r.value;
  throw new Error(`esperado éxito, falló: ${String(r.error)}`);
}

function makeUsuario(email: string): Usuario {
  const emailRes = Email.create(email);
  if (emailRes.isFailure) throw emailRes.error;
  const uRes = Usuario.create({
    id: 'u1',
    email: emailRes.value,
    password: 'hashed-password-very-long',
    nombre: 'Ana',
    emailVerificado: true,
  });
  if (uRes.isFailure) throw uRes.error;
  return uRes.value;
}

class FakeUsuarioRepo {
  constructor(public usuarios: Map<string, Usuario>) {}
  async findById(id: string) {
    return success(this.usuarios.get(id) ?? null);
  }
  async findByEmail(email: Email) {
    for (const u of this.usuarios.values()) {
      if (u.email.value === email.value) return success(u);
    }
    return success(null);
  }
  async update(usuario: Usuario) {
    this.usuarios.set(usuario.id, usuario);
    return success(usuario);
  }
}

class FakeMfaRepo {
  challenges = new Map<string, { id: string; usuarioId: string | null; tipo: string; intentos: number; expiraAt: Date }>();
  backups = new Map<string, { id: string; usuarioId: string; codeHash: string; usado: boolean }>();
  private seq = 0;

  async createTotpChallenge(usuarioId: string, ttl: number) {
    for (const [id, c] of this.challenges) {
      if (c.usuarioId === usuarioId && c.tipo === 'TOTP') this.challenges.delete(id);
    }
    const id = `ch-${++this.seq}`;
    this.challenges.set(id, { id, usuarioId, tipo: 'TOTP', intentos: 0, expiraAt: new Date(Date.now() + ttl * 1000) });
    return success({ id, usuarioId, tipo: 'TOTP' as const, challenge: null, intentos: 0, expiraAt: new Date(Date.now() + ttl * 1000) });
  }
  async findChallengeById(id: string) {
    const c = this.challenges.get(id);
    return success(c ? { ...c, challenge: null } : null);
  }
  async deleteChallenge(id: string) {
    this.challenges.delete(id);
    return success(undefined);
  }
  async incrementChallengeAttempts(id: string, max: number) {
    const c = this.challenges.get(id);
    if (!c || c.intentos >= max) return success(-1);
    c.intentos += 1;
    return success(c.intentos);
  }
  async listActiveBackupCodes(usuarioId: string) {
    const list = [...this.backups.values()]
      .filter((b) => b.usuarioId === usuarioId && !b.usado)
      .map((b) => ({ ...b, usadoAt: null }));
    return success(list);
  }
  async replaceBackupCodes(usuarioId: string, hashes: string[]) {
    for (const [id, b] of this.backups) if (b.usuarioId === usuarioId) this.backups.delete(id);
    hashes.forEach((h, i) => this.backups.set(`${usuarioId}-bc-${i}`, { id: `${usuarioId}-bc-${i}`, usuarioId, codeHash: h, usado: false }));
    return success(undefined);
  }
  async consumeBackupCode(id: string) {
    const b = this.backups.get(id);
    if (!b || b.usado) return success(false);
    b.usado = true;
    return success(true);
  }
}

const fakeHasher = {
  verify: async (password: Password) => success(password.value === 'Password1!'),
  hash: async () => success('hashed-password-very-long'),
  needsRehash: async () => success(false),
} as never;

const fakeEmail = { sendEmail: async () => ({ success: true }) } as never;

const fakeTokens = {
  generateTokenPair: async () => success({ accessToken: 'access-token', refreshToken: 'refresh-token' }),
} as never;

function makeRecorder(): { recorder: ILoginAttemptRecorder; recorded: LoginAttemptInput[] } {
  const recorded: LoginAttemptInput[] = [];
  const recorder: ILoginAttemptRecorder = {
    record: async (input: LoginAttemptInput) => {
      recorded.push(input);
    },
  };
  return { recorder, recorded };
}

describe('MfaLogin — registro de intentos de login', () => {
  async function buildSuite(recorder?: ILoginAttemptRecorder) {
    const usuarios = new Map<string, Usuario>();
    const mfa = new FakeMfaRepo();
    const userRepo = new FakeUsuarioRepo(usuarios) as never;
    const setup = new SetupTotp(userRepo, fakeHasher);
    const verify = new VerifyEnableTotp(userRepo, mfa as never, fakeHasher, fakeEmail);
    const login = new MfaLogin(userRepo, mfa as never, fakeTokens as never, recorder);
    const auth = new AuthenticateUser(userRepo, fakeHasher, fakeTokens as never, mfa as never);

    usuarios.set('u1', makeUsuario('ana@test.es'));
    const r = await setup.execute({ usuarioId: 'u1', password: 'Password1!' });
    const secret = decodeURIComponent(val(r).otpauthUrl.split('secret=')[1]!.split('&')[0]!);
    const code = totpCodeAt(secret, Math.floor(Date.now() / 1000));
    await verify.execute({ usuarioId: 'u1', password: 'Password1!', code });

    const step1 = await auth.execute({ email: 'ana@test.es', password: 'Password1!' });
    const challengeId = (val(step1) as { mfa: { challengeId: string } }).mfa.challengeId;
    return { login, secret, challengeId };
  }

  it('TOTP correcto registra success con email, IP y agente', async () => {
    const { recorder, recorded } = makeRecorder();
    const { login, secret, challengeId } = await buildSuite(recorder);
    const code = totpCodeAt(secret, Math.floor(Date.now() / 1000));
    const result = await login.execute({ challengeId, code, ipAddress: '5.5.5.5', userAgent: 'mfa-agent' });
    expect(result.isSuccess).toBe(true);
    expect(recorded).toHaveLength(1);
    expect(recorded[0]).toMatchObject({
      email: 'ana@test.es',
      success: true,
      reason: null,
      ipAddress: '5.5.5.5',
      userAgent: 'mfa-agent',
    });
  });

  it('TOTP incorrecto registra MFA_FAILED y el login falla', async () => {
    const { recorder, recorded } = makeRecorder();
    const { login, challengeId } = await buildSuite(recorder);
    const result = await login.execute({ challengeId, code: '000000' });
    expect(result.isFailure).toBe(true);
    expect(recorded).toHaveLength(1);
    expect(recorded[0]).toMatchObject({ email: 'ana@test.es', success: false, reason: 'MFA_FAILED' });
  });

  it('código de respaldo incorrecto registra MFA_FAILED', async () => {
    const { recorder, recorded } = makeRecorder();
    const { login, challengeId } = await buildSuite(recorder);
    const result = await login.execute({ challengeId, backupCode: 'NOEXISTE1234' });
    expect(result.isFailure).toBe(true);
    expect(recorded).toHaveLength(1);
    expect(recorded[0]).toMatchObject({ success: false, reason: 'MFA_FAILED' });
  });

  it('un recorder que falla no rompe el login MFA correcto', async () => {
    const throwingRecorder: ILoginAttemptRecorder = {
      record: async () => {
        throw new Error('BD caída');
      },
    };
    const { login, secret, challengeId } = await buildSuite(throwingRecorder);
    const code = totpCodeAt(secret, Math.floor(Date.now() / 1000));
    const result = await login.execute({ challengeId, code });
    expect(result.isSuccess).toBe(true);
  });
});
