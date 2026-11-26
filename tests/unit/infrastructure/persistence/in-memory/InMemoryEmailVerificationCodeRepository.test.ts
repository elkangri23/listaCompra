/**
 * Tests unitarios para InMemoryEmailVerificationCodeRepository (item 3)
 * Doble en memoria del repositorio de códigos, usado por el container
 * en NODE_ENV=test. No necesita mocks.
 */

import { InMemoryEmailVerificationCodeRepository } from '../../../../../src/infrastructure/persistence/in-memory/InMemoryEmailVerificationCodeRepository';
import type { Result } from '../../../../../src/shared/result';

const unwrap = <T>(r: Result<T, Error>): T | null | undefined =>
  (r.isSuccess ? (r as { value: T | null }).value : undefined);

describe('InMemoryEmailVerificationCodeRepository', () => {
  let repo: InMemoryEmailVerificationCodeRepository;

  beforeEach(() => {
    repo = new InMemoryEmailVerificationCodeRepository();
  });

  it('create guarda el código con TTL y expiraAt en el futuro', async () => {
    const before = Date.now();
    const result = await repo.create({
      usuarioId: 'user-id',
      codeHash: 'hash',
      ttlSeconds: 900,
    });

    expect(result.isSuccess).toBe(true);
    const created = unwrap(result);
    expect(created?.usuarioId).toBe('user-id');
    expect(created?.codeHash).toBe('hash');
    expect(created?.intentos).toBe(0);
    expect(created?.usado).toBe(false);
    expect(created?.expiraAt.getTime()).toBeGreaterThanOrEqual(before + 900 * 1000);
  });

  it('create invalida los pendientes anteriores del mismo usuario', async () => {
    const first = await repo.create({ usuarioId: 'user-id', codeHash: 'h1', ttlSeconds: 900 });
    await repo.create({ usuarioId: 'user-id', codeHash: 'h2', ttlSeconds: 900 });

    const pending = await repo.findLatestPendingByUsuarioId('user-id');
    expect(unwrap(pending)?.codeHash).toBe('h2');
    const latest = await repo.findLatestByUsuarioId('user-id');
    expect(unwrap(latest)?.codeHash).toBe('h2');
    expect(unwrap(first)?.id).not.toBe(unwrap(latest)?.id);
  });

  it('create no invalida los códigos de otros usuarios', async () => {
    await repo.create({ usuarioId: 'user-a', codeHash: 'ha', ttlSeconds: 900 });
    await repo.create({ usuarioId: 'user-b', codeHash: 'hb', ttlSeconds: 900 });

    expect(unwrap(await repo.findLatestPendingByUsuarioId('user-a'))?.codeHash).toBe('ha');
    expect(unwrap(await repo.findLatestPendingByUsuarioId('user-b'))?.codeHash).toBe('hb');
  });

  it('findLatestPendingByUsuarioId devuelve null sin códigos y tras marcar usado', async () => {
    expect(unwrap(await repo.findLatestPendingByUsuarioId('user-id'))).toBeNull();

    const created = await repo.create({ usuarioId: 'user-id', codeHash: 'h', ttlSeconds: 900 });
    await repo.markUsed(unwrap(created)!.id);

    expect(unwrap(await repo.findLatestPendingByUsuarioId('user-id'))).toBeNull();
  });

  it('incrementAttempts suma hasta el máximo y devuelve 0 al llegar', async () => {
    const created = await repo.create({ usuarioId: 'user-id', codeHash: 'h', ttlSeconds: 900 });
    const id = unwrap(created)!.id;

    expect(unwrap(await repo.incrementAttempts(id, 2))).toBe(1);
    expect(unwrap(await repo.incrementAttempts(id, 2))).toBe(2);
    expect(unwrap(await repo.incrementAttempts(id, 2))).toBe(0);
    expect(unwrap(await repo.incrementAttempts('inexistente', 2))).toBe(0);
  });

  it('markUsed marca usado y usadoAt, y ya no aparece como pendiente', async () => {
    const created = await repo.create({ usuarioId: 'user-id', codeHash: 'h', ttlSeconds: 900 });
    const id = unwrap(created)!.id;

    const result = await repo.markUsed(id);
    expect(result.isSuccess).toBe(true);
    const latest = await repo.findLatestByUsuarioId('user-id');
    expect(unwrap(latest)?.usado).toBe(true);
    expect(unwrap(latest)?.usadoAt).not.toBeNull();
    expect(unwrap(await repo.findLatestPendingByUsuarioId('user-id'))).toBeNull();
  });

  it('setCodeHashForTest fija un hash conocido en la fila pendiente', async () => {
    const created = await repo.create({ usuarioId: 'user-id', codeHash: 'h', ttlSeconds: 900 });
    const id = unwrap(created)!.id;

    repo.setCodeHashForTest(id, 'hash-conocido');

    expect(unwrap(await repo.findLatestPendingByUsuarioId('user-id'))?.codeHash).toBe(
      'hash-conocido',
    );
  });
});
