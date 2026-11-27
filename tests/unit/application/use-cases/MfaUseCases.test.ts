/**
 * Tests de use cases MFA (TOTP fase 1)
 * Máquina de estados, challenge de un uso, cap de intentos,
 * backup de un solo uso y login sin TOTP compatible hacia atrás.
 */

// Clave base64 de 32 bytes para los tests (antes de cualquier uso de mfa-crypto)
process.env['MFA_ENCRYPTION_KEY'] = Buffer.alloc(32, 7).toString('base64');

import { Usuario } from '@domain/entities/Usuario';
import { Email } from '@domain/value-objects/Email';
import type { Password } from '@domain/value-objects/Password';
import {
  MfaChallengeExpiredError,
  MfaTooManyAttemptsError,
  MfaNotSetupError,
  MfaSetupLockedError,
  MfaAlreadyEnabledError,
  TotpCodeInvalidError,
} from '@domain/errors/MfaError';
import { SetupTotp } from '@application/use-cases/auth/SetupTotp';
import { VerifyEnableTotp } from '@application/use-cases/auth/VerifyEnableTotp';
import { DisableTotp } from '@application/use-cases/auth/DisableTotp';
import { MfaLogin } from '@application/use-cases/auth/MfaLogin';
import { AuthenticateUser } from '@application/use-cases/auth/AuthenticateUser';
import { success } from '@shared/result';
import { totpCodeAt } from '@infrastructure/security/totp';
import type { Result } from '@shared/result';

function val<T, E>(r: Result<T, E>): T {
  if (r.isSuccess) return r.value;
  throw new Error(`esperado éxito, falló: ${String(r.error)}`);
}
function err<T, E>(r: Result<T, E>): E {
  if (!r.isSuccess) return r.error;
  throw new Error('esperado fallo, fue éxito');
}

// ===== Fakes =====

function makeUsuario(email: string, opts: { totpSecret?: string | null; totpEnabled?: boolean } = {}): Usuario {
  const emailRes = Email.create(email);
  if (emailRes.isFailure) throw emailRes.error;
  const uRes = Usuario.create({
    id: 'u1',
    email: emailRes.value,
    password: 'hashed-password-very-long',
    nombre: 'Ana',
    // Usuarios ya registrados: el login exige el correo verificado (item 3)
    emailVerificado: true,
  });
  if (uRes.isFailure) throw uRes.error;
  const u = uRes.value;
  if (opts.totpSecret !== undefined) u.setTotpPending(opts.totpSecret as string);
  if (opts.totpEnabled) u.enableTotp();
  return u;
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
    // revoca vivos del usuario
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
  async deleteExpiredChallenges() { return success(0); }
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
  async countActiveBackupCodes(usuarioId: string) {
    let n = 0;
    for (const b of this.backups.values()) if (b.usuarioId === usuarioId && !b.usado) n++;
    return success(n);
  }
  async deleteBackupCodes(usuarioId: string) {
    for (const [id, b] of this.backups) if (b.usuarioId === usuarioId) this.backups.delete(id);
    return success(undefined);
  }
}

const fakeHasher = {
  verify: async (password: Password, _hash: string) => success(password.value === 'Password1!'),
  hash: async (_p: Password) => success('hashed-password-very-long'),
  needsRehash: async () => success(false),
} as never;

const fakeEmail = { sendEmail: async () => ({ success: true }) } as never;

const fakeTokens = {
  generateTokenPair: async (_payload: unknown) => success({ accessToken: 'access-token', refreshToken: 'refresh-token' }),
  verifyAccessToken: async () => success({ userId: 'x', email: 'x@y.z', role: 'USUARIO' }),
} as never;

describe('SetupTotp — máquina de estados', () => {
  it('sin TOTP → crea secret pendiente y devuelve otpauth/QR', async () => {
    const usuarios = new Map([['u1', makeUsuario('ana@test.es')]]);
    const useCase = new SetupTotp(new FakeUsuarioRepo(usuarios) as never, fakeHasher);
    const result = await useCase.execute({ usuarioId: 'u1', password: 'Password1!' });
    expect(result.isSuccess).toBe(true);
    expect(val(result).otpauthUrl).toContain('otpauth://totp/ListaCompra');
    expect(val(result).qrDataUrl).toContain('data:image/png');
    const u = usuarios.get('u1')!;
    expect(u.totpPendiente).toBe(true);
    expect(u.totpSecret).not.toBeNull();
  });

  it('TOTP activo → 409 MFA_ALREADY_ENABLED', async () => {
    const usuarios = new Map([['u1', makeUsuario('ana@test.es', { totpEnabled: true })]]);
    const useCase = new SetupTotp(new FakeUsuarioRepo(usuarios) as never, fakeHasher);
    const result = await useCase.execute({ usuarioId: 'u1', password: 'Password1!' });
    expect(result.isFailure).toBe(true);
    expect(err(result)).toBeInstanceOf(MfaAlreadyEnabledError);
  });

  it('contraseña incorrecta → Unauthorized', async () => {
    const usuarios = new Map([['u1', makeUsuario('ana@test.es')]]);
    const useCase = new SetupTotp(new FakeUsuarioRepo(usuarios) as never, fakeHasher);
    const result = await useCase.execute({ usuarioId: 'u1', password: 'MalaPassword1!' });
    expect(result.isFailure).toBe(true);
  });
});

describe('VerifyEnableTotp — confirmación con cap de 5 intentos', () => {
  function buildSuite() {
    const usuarios = new Map<string, Usuario>();
    const mfa = new FakeMfaRepo();
    const useCase = new VerifyEnableTotp(new FakeUsuarioRepo(usuarios) as never, mfa as never, fakeHasher, fakeEmail);
    const setup = new SetupTotp(new FakeUsuarioRepo(usuarios) as never, fakeHasher);
    const create = async (email = 'ana@test.es') => {
      usuarios.set('u1', makeUsuario(email));
      const r = await setup.execute({ usuarioId: 'u1', password: 'Password1!' });
      // Recupera el secret en claro del otpauth URL para calcular códigos
      const otpauth = val(r).otpauthUrl;
      const secret = decodeURIComponent(otpauth.split('secret=')[1]!.split('&')[0]!);
      return secret;
    };
    return { usuarios, mfa, useCase, create };
  }

  it('código válido → activa y devuelve 10 backup codes en claro', async () => {
    const s = buildSuite();
    const secret = await s.create();
    const code = totpCodeAt(secret, Math.floor(Date.now() / 1000));
    const result = await s.useCase.execute({ usuarioId: 'u1', password: 'Password1!', code });
    expect(result.isSuccess).toBe(true);
    expect(val(result).backupCodes).toHaveLength(10);
    const u = s.usuarios.get('u1')!;
    expect(u.totpEnabled).toBe(true);
  });

  it('código inválido → TOTP_CODE_INVALID y cuenta intentos', async () => {
    const s = buildSuite();
    await s.create();
    const result = await s.useCase.execute({ usuarioId: 'u1', password: 'Password1!', code: '000000' });
    expect(result.isFailure).toBe(true);
    expect(err(result)).toBeInstanceOf(TotpCodeInvalidError);
    expect(s.usuarios.get('u1')!.totpPendIntentos).toBe(1);
  });

  it('5 fallos → bloquea y borra el secret pendiente (MFA_SETUP_LOCKED)', async () => {
    const s = buildSuite();
    await s.create();
    for (let i = 0; i < 4; i++) {
      await s.useCase.execute({ usuarioId: 'u1', password: 'Password1!', code: '000000' });
    }
    // 5º fallo → bloqueo
    const result = await s.useCase.execute({ usuarioId: 'u1', password: 'Password1!', code: '000000' });
    expect(err(result)).toBeInstanceOf(MfaSetupLockedError);
    expect(s.usuarios.get('u1')!.totpSecret).toBeNull();
  });

  it('verify-enable sin setup → 409 MFA_NOT_SETUP', async () => {
    const usuarios = new Map([['u1', makeUsuario('ana@test.es')]]);
    const useCase = new VerifyEnableTotp(new FakeUsuarioRepo(usuarios) as never, new FakeMfaRepo() as never, fakeHasher, fakeEmail);
    const result = await useCase.execute({ usuarioId: 'u1', password: 'Password1!', code: '123456' });
    expect(err(result)).toBeInstanceOf(MfaNotSetupError);
  });
});

describe('MfaLogin — challenge de un uso + backup de un solo uso', () => {
  function buildSuite() {
    const usuarios = new Map<string, Usuario>();
    const mfa = new FakeMfaRepo();
    const userRepo = new FakeUsuarioRepo(usuarios) as never;
    const setup = new SetupTotp(userRepo, fakeHasher);
    const verify = new VerifyEnableTotp(userRepo, mfa as never, fakeHasher, fakeEmail);
    const login = new MfaLogin(userRepo, mfa as never, fakeTokens as never);
    const prepare = async () => {
      usuarios.set('u1', makeUsuario('ana@test.es'));
      const r = await setup.execute({ usuarioId: 'u1', password: 'Password1!' });
      const secret = decodeURIComponent(val(r).otpauthUrl.split('secret=')[1]!.split('&')[0]!);
      const code = totpCodeAt(secret, Math.floor(Date.now() / 1000));
      const enable = await verify.execute({ usuarioId: 'u1', password: 'Password1!', code });
      return { secret, backupCodes: val(enable).backupCodes };
    };
    return { usuarios, mfa, userRepo, login, prepare };
  }

  it('login: paso 1 → challenge; paso 2 con código → tokens + mfaInfo TOTP', async () => {
    const s = buildSuite();
    const { secret } = await s.prepare();
    // Paso 1 (via AuthenticateUser branch) — crea challenge
    const auth = new AuthenticateUser(s.userRepo, fakeHasher, fakeTokens as never, s.mfa as never);
    const step1 = await auth.execute({ email: 'ana@test.es', password: 'Password1!' });
    const step1Value = val(step1) as { mfaRequired: true; mfa: { challengeId: string } };
    expect(step1Value.mfaRequired).toBe(true);

    const code = totpCodeAt(secret, Math.floor(Date.now() / 1000));
    const step2 = await s.login.execute({ challengeId: step1Value.mfa.challengeId, code });
    expect(step2.isSuccess).toBe(true);
    expect(val(step2).tokens.accessToken).toBe('access-token');
    expect(val(step2).mfaInfo.method).toBe('TOTP');
    // Challenge consumido (un uso)
    expect(s.mfa.challenges.size).toBe(0);
  });

  it('challenge reutilizado tras éxito → CHALLENGE_EXPIRED (un uso)', async () => {
    const s = buildSuite();
    const { secret } = await s.prepare();
    const auth = new AuthenticateUser(s.userRepo, fakeHasher, fakeTokens as never, s.mfa as never);
    const step1 = await auth.execute({ email: 'ana@test.es', password: 'Password1!' });
    const challengeId = (val(step1) as { mfa: { challengeId: string } }).mfa.challengeId;
    const code = totpCodeAt(secret, Math.floor(Date.now() / 1000));
    await s.login.execute({ challengeId, code });
    const retry = await s.login.execute({ challengeId, code });
    expect(err(retry)).toBeInstanceOf(MfaChallengeExpiredError);
  });

  it('re-login revoca challenges vivos anteriores', async () => {
    const s = buildSuite();
    await s.prepare();
    const auth = new AuthenticateUser(s.userRepo, fakeHasher, fakeTokens as never, s.mfa as never);
    await auth.execute({ email: 'ana@test.es', password: 'Password1!' });
    const step1b = await auth.execute({ email: 'ana@test.es', password: 'Password1!' });
    // Solo debe existir el challenge del segundo login
    expect(s.mfa.challenges.size).toBe(1);
    expect((val(step1b) as { mfa: { challengeId: string } }).mfa.challengeId).toBe([...s.mfa.challenges.keys()][0]);
  });

  it('5 intentos fallidos → 429 y challenge borrado', async () => {
    const s = buildSuite();
    await s.prepare();
    const auth = new AuthenticateUser(s.userRepo, fakeHasher, fakeTokens as never, s.mfa as never);
    const step1 = await auth.execute({ email: 'ana@test.es', password: 'Password1!' });
    const challengeId = (val(step1) as { mfa: { challengeId: string } }).mfa.challengeId;
    let lastError: unknown;
    for (let i = 0; i < 5; i++) {
      const r = await s.login.execute({ challengeId, code: '000000' });
      if (r.isFailure) lastError = err(r);
    }
    expect(lastError).toBeInstanceOf(MfaTooManyAttemptsError);
    expect(s.mfa.challenges.size).toBe(0);
  });

  it('backup code: funciona una vez; el segundo uso falla', async () => {
    const s = buildSuite();
    const { backupCodes } = await s.prepare();
    const auth = new AuthenticateUser(s.userRepo, fakeHasher, fakeTokens as never, s.mfa as never);
    const step1 = await auth.execute({ email: 'ana@test.es', password: 'Password1!' });
    const challengeId = (val(step1) as { mfa: { challengeId: string } }).mfa.challengeId;

    const first = await s.login.execute({ challengeId, backupCode: backupCodes[0] as string });
    expect(first.isSuccess).toBe(true);
    expect(val(first).mfaInfo).toEqual({ method: 'BACKUP_CODE', backupUsed: true });

    // segundo uso del mismo backup (nuevo challenge)
    const step1b = await auth.execute({ email: 'ana@test.es', password: 'Password1!' });
    const challengeId2 = (val(step1b) as { mfa: { challengeId: string } }).mfa.challengeId;
    const second = await s.login.execute({ challengeId: challengeId2, backupCode: backupCodes[0] as string });
    expect(second.isFailure).toBe(true);
  });

  it('backup code con guiones/minúsculas/espacios se normaliza', async () => {
    const s = buildSuite();
    const { backupCodes } = await s.prepare();
    const auth = new AuthenticateUser(s.userRepo, fakeHasher, fakeTokens as never, s.mfa as never);
    const step1 = await auth.execute({ email: 'ana@test.es', password: 'Password1!' });
    const challengeId = (val(step1) as { mfa: { challengeId: string } }).mfa.challengeId;
    const r = await s.login.execute({
      challengeId,
      backupCode: ` ${(backupCodes[0] as string).toLowerCase()} `,
    });
    expect(r.isSuccess).toBe(true);
  });
});

describe('DisableTotp — idempotencia y step-up', () => {
  function buildSuite() {
    const usuarios = new Map<string, Usuario>();
    const mfa = new FakeMfaRepo();
    const userRepo = new FakeUsuarioRepo(usuarios) as never;
    const setup = new SetupTotp(userRepo, fakeHasher);
    const verify = new VerifyEnableTotp(userRepo, mfa as never, fakeHasher, fakeEmail);
    const disable = new DisableTotp(userRepo, mfa as never, fakeHasher, fakeEmail);
    return { usuarios, mfa, setup, verify, disable };
  }

  it('sin TOTP → 200 idempotente', async () => {
    const s = buildSuite();
    s.usuarios.set('u1', makeUsuario('ana@test.es'));
    const r = await s.disable.execute({ usuarioId: 'u1', password: 'Password1!' });
    expect(r.isSuccess).toBe(true);
    expect(val(r).mfaEnabled).toBe(false);
  });

  it('pendiente sin confirmar → se borra con solo contraseña', async () => {
    const s = buildSuite();
    s.usuarios.set('u1', makeUsuario('ana@test.es'));
    await s.setup.execute({ usuarioId: 'u1', password: 'Password1!' });
    const r = await s.disable.execute({ usuarioId: 'u1', password: 'Password1!' });
    expect(r.isSuccess).toBe(true);
    expect(s.usuarios.get('u1')!.totpSecret).toBeNull();
  });

  it('activo requiere código vigente: sin código → TOTP_CODE_INVALID', async () => {
    const s = buildSuite();
    s.usuarios.set('u1', makeUsuario('ana@test.es'));
    const setupR = await s.setup.execute({ usuarioId: 'u1', password: 'Password1!' });
    const secret = decodeURIComponent(val(setupR).otpauthUrl.split('secret=')[1]!.split('&')[0]!);
    const code = totpCodeAt(secret, Math.floor(Date.now() / 1000));
    await s.verify.execute({ usuarioId: 'u1', password: 'Password1!', code });
    const r = await s.disable.execute({ usuarioId: 'u1', password: 'Password1!' });
    expect(err(r)).toBeInstanceOf(TotpCodeInvalidError);
  });

  it('activo + código TOTP válido → desactiva y borra backups', async () => {
    const s = buildSuite();
    s.usuarios.set('u1', makeUsuario('ana@test.es'));
    const setupR = await s.setup.execute({ usuarioId: 'u1', password: 'Password1!' });
    const secret = decodeURIComponent(val(setupR).otpauthUrl.split('secret=')[1]!.split('&')[0]!);
    await s.verify.execute({ usuarioId: 'u1', password: 'Password1!', code: totpCodeAt(secret, Math.floor(Date.now() / 1000)) });
    expect(s.mfa.backups.size).toBeGreaterThan(0);
    const r = await s.disable.execute({
      usuarioId: 'u1',
      password: 'Password1!',
      code: totpCodeAt(secret, Math.floor(Date.now() / 1000) + 30),
    });
    expect(r.isSuccess).toBe(true);
    expect(s.mfa.backups.size).toBe(0);
    expect(s.usuarios.get('u1')!.totpEnabled).toBe(false);
  });

  it('activo + backup code válido → desactiva', async () => {
    const s = buildSuite();
    s.usuarios.set('u1', makeUsuario('ana@test.es'));
    const setupR = await s.setup.execute({ usuarioId: 'u1', password: 'Password1!' });
    const secret = decodeURIComponent(val(setupR).otpauthUrl.split('secret=')[1]!.split('&')[0]!);
    const enable = await s.verify.execute({ usuarioId: 'u1', password: 'Password1!', code: totpCodeAt(secret, Math.floor(Date.now() / 1000)) });
    const r = await s.disable.execute({
      usuarioId: 'u1',
      password: 'Password1!',
      code: val(enable).backupCodes[1] as string,
    });
    expect(r.isSuccess).toBe(true);
    expect(s.usuarios.get('u1')!.totpEnabled).toBe(false);
  });
});

describe('AuthenticateUser — compatibilidad hacia atrás', () => {
  it('login sin TOTP → respuesta idéntica (tokens, sin mfaRequired)', async () => {
    const usuarios = new Map([['u1', makeUsuario('ana@test.es')]]);
    const mfa = new FakeMfaRepo();
    const auth = new AuthenticateUser(new FakeUsuarioRepo(usuarios) as never, fakeHasher, fakeTokens as never, mfa as never);
    const r = await auth.execute({ email: 'ana@test.es', password: 'Password1!' });
    expect(r.isSuccess).toBe(true);
    const value = val(r) as { user?: unknown; tokens?: unknown; mfaRequired?: boolean };
    expect((value as { mfaRequired?: boolean }).mfaRequired).toBeUndefined();
    expect((value as { tokens: unknown }).tokens).toEqual({ accessToken: 'access-token', refreshToken: 'refresh-token' });
    // sin challenges creados
    expect(mfa.challenges.size).toBe(0);
  });
});
