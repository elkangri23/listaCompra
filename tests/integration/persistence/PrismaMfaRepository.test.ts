/**
 * Tests de integración — repositorios MFA (fases 1-2) contra PostgreSQL real
 * Valida las operaciones atómicas: challenges de un uso, cap de intentos,
 * consumo race-safe de backups, ciclo de vida de passkeys.
 */

import { PrismaClient } from '@prisma/client';
import { PrismaMfaRepository } from '@infrastructure/persistence/repositories/PrismaMfaRepository';
import { PrismaPasskeyRepository } from '@infrastructure/persistence/repositories/PrismaPasskeyRepository';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();
const mfaRepo = new PrismaMfaRepository(prisma);
const passkeyRepo = new PrismaPasskeyRepository(prisma);

async function createTestUsuario(): Promise<{ id: string; email: string }> {
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(7);
  const email = `mfa-it-${timestamp}-${randomId}@example.com`;
  const usuario = await prisma.usuario.create({
    data: {
      nombre: `MFA IT ${timestamp}-${randomId}`,
      email,
      password: 'hashedpassword',
      activo: true,
      emailVerificado: true,
      totpEnabled: true,
      totpSecret: 'v1:enc:secret',
    },
  });
  return { id: usuario.id, email };
}

afterAll(async () => {
  await prisma.$disconnect();
});

/** TS exige narrowing del Result */
function must<T>(r: { isSuccess: boolean; error?: unknown; value?: T }): T {
  if (r.isSuccess) return r.value as T;
  throw new Error(`fallo inesperado: ${String(r.error)}`);
}

describe('PrismaMfaRepository — challenges TOTP (integración)', () => {
  it('createTotpChallenge revoca challenges vivos previos y crea uno nuevo', async () => {
    const { id: usuarioId } = await createTestUsuario();

    const first = await mfaRepo.createTotpChallenge(usuarioId, 300);
    expect(first.isSuccess).toBe(true);
    const second = await mfaRepo.createTotpChallenge(usuarioId, 300);
    expect(second.isSuccess).toBe(true);
    const secondId = must(second).id;

    // Solo queda el último
    const vivos = await prisma.mfaChallenge.findMany({ where: { usuarioId, tipo: 'TOTP' } });
    expect(vivos).toHaveLength(1);
    expect(vivos[0]!.id).toBe(secondId);

    // findChallengeById
    const found = await mfaRepo.findChallengeById(secondId);
    expect(must(found)?.tipo).toBe('TOTP');

    await mfaRepo.deleteChallenge(secondId);
    expect(must(await mfaRepo.findChallengeById(secondId))).toBeNull();
  });

  it('incrementChallengeAttempts: atómico con cap en maxAttempts', async () => {
    const { id: usuarioId } = await createTestUsuario();
    const challenge = await mfaRepo.createTotpChallenge(usuarioId, 300);
    const challengeId = must(challenge).id;

    expect(must<number>(await mfaRepo.incrementChallengeAttempts(challengeId, 5))).toBe(1);
    expect(must<number>(await mfaRepo.incrementChallengeAttempts(challengeId, 5))).toBe(2);

    // Bloqueado: -1 cuando intentos ya >= cap… el cap comprueba lt max:
    for (let i = 0; i < 3; i++) {
      await mfaRepo.incrementChallengeAttempts(challengeId, 5);
    }
    expect(must<number>(await mfaRepo.incrementChallengeAttempts(challengeId, 5))).toBe(-1);
  });
});

describe('PrismaMfaRepository — backup codes (integración)', () => {
  it('replaceBackupCodes + consumeBackupCode de un solo uso', async () => {
    const { id: usuarioId } = await createTestUsuario();

    await mfaRepo.replaceBackupCodes(usuarioId, ['hash-AAA', 'hash-BBB']);
    const active = await mfaRepo.listActiveBackupCodes(usuarioId);
    const codes = must(await active);
    expect(codes).toHaveLength(2);

    const codeId = (codes as { id: string }[])![0]!.id;
    // Primer consumo OK
    expect(must<boolean>(await mfaRepo.consumeBackupCode(codeId))).toBe(true);
    // Segundo consumo (race-safe): false
    expect(must<boolean>(await mfaRepo.consumeBackupCode(codeId))).toBe(false);
    expect(must(await mfaRepo.countActiveBackupCodes(usuarioId))).toBe(1);

    // Borrado total al desactivar
    await mfaRepo.deleteBackupCodes(usuarioId);
    expect(must(await mfaRepo.countActiveBackupCodes(usuarioId))).toBe(0);
  });
});

describe('PrismaMfaRepository — challenges WebAuthn (integración)', () => {
  it('createWebauthnChallenge PASSKEY_LOGIN con usuarioId null y revocación por tipo', async () => {
    const { id: usuarioId } = await createTestUsuario();

    const loginChallenge = await mfaRepo.createWebauthnChallenge({
      usuarioId: null,
      tipo: 'PASSKEY_LOGIN',
      challenge: 'b64url-login',
      ttlSeconds: 120,
    });
    expect(loginChallenge.isSuccess).toBe(true);
    const data = must(loginChallenge) as { id: string; usuarioId: string | null; challenge: string };
    expect(data.usuarioId).toBeNull();
    expect(data.challenge).toBe('b64url-login');

    const regChallenge = await mfaRepo.createWebauthnChallenge({
      usuarioId,
      tipo: 'PASSKEY_REG',
      challenge: 'b64url-reg',
      ttlSeconds: 300,
    });
    expect(regChallenge.isSuccess).toBe(true);

    // revokeLiveChallenges solo borra del tipo indicado
    await mfaRepo.revokeLiveChallenges(usuarioId, 'PASSKEY_REG');
    const regs = await prisma.mfaChallenge.findMany({ where: { usuarioId, tipo: 'PASSKEY_REG' } });
    expect(regs).toHaveLength(0);
    expect(must(await mfaRepo.findChallengeById(data.id))).not.toBeNull();
  });
});

describe('PrismaPasskeyRepository (integración)', () => {
  it('create → findByCredentialId → contador → deactivate → delete', async () => {
    const { id: usuarioId } = await createTestUsuario();
    const credentialId = `cred-${uuidv4()}`;

    const created = await passkeyRepo.create({
      credentialId,
      usuarioId,
      publicKey: Buffer.from([1, 2, 3]),
      contador: 0,
      transports: ['internal'],
      deviceType: 'multiDevice',
      aaguid: '00000000-0000-0000-0000-000000000000',
      nombre: 'Passkey',
    });
    expect(created.isSuccess).toBe(true);
    const passkeyId = must(created).id;

    const found = must(await passkeyRepo.findByCredentialId(credentialId));
    expect(found?.deviceType).toBe('multiDevice');
    expect(found?.publicKey).toEqual(Buffer.from([1, 2, 3]));

    expect(must<number>(await passkeyRepo.countByUsuario(usuarioId))).toBe(1);

    await passkeyRepo.updateCounterAndUsage(passkeyId, 7);
    const afterCounter = must(await passkeyRepo.findById(passkeyId));
    expect(afterCounter?.contador).toBe(7);
    expect(afterCounter?.ultimoUso).not.toBeNull();

    await passkeyRepo.deactivate(passkeyId);
    expect(must<number>(await passkeyRepo.countByUsuario(usuarioId))).toBe(0);

    await passkeyRepo.delete(passkeyId);
    expect(must(await passkeyRepo.findById(passkeyId))).toBeNull();
  });

  it('credentialId es unique a nivel BD (duplicate lanza fallo controlado)', async () => {
    const { id: usuarioId } = await createTestUsuario();
    const credentialId = `cred-dup-${uuidv4()}`;

    await passkeyRepo.create({
      credentialId,
      usuarioId,
      publicKey: Buffer.from([1]),
      contador: 0,
      transports: [],
      deviceType: 'singleDevice',
      aaguid: null,
      nombre: 'Passkey',
    });
    const duplicate = await passkeyRepo.create({
      credentialId,
      usuarioId,
      publicKey: Buffer.from([2]),
      contador: 0,
      transports: [],
      deviceType: 'singleDevice',
      aaguid: null,
      nombre: 'Passkey 2',
    });
    expect(duplicate.isFailure).toBe(true);
  });

  it('rename y listByUsuario ordenado por createdAt', async () => {
    const { id: usuarioId } = await createTestUsuario();
    await passkeyRepo.create({
      credentialId: `cred-a-${uuidv4()}`,
      usuarioId,
      publicKey: Buffer.from([1]),
      contador: 0,
      transports: [],
      deviceType: 'singleDevice',
      aaguid: null,
      nombre: 'Primera',
    });
    const c2 = await passkeyRepo.create({
      credentialId: `cred-b-${uuidv4()}`,
      usuarioId,
      publicKey: Buffer.from([2]),
      contador: 0,
      transports: [],
      deviceType: 'singleDevice',
      aaguid: null,
      nombre: 'Segunda',
    });
    await passkeyRepo.rename((must(await c2) as { id: string }).id, 'Segunda renombrada');

    const list = await passkeyRepo.listByUsuario(usuarioId);
    expect((must(await list) as { nombre: string }[])!.map((passkey) => passkey.nombre)).toEqual([
      'Primera',
      'Segunda renombrada',
    ]);
  });
});
