/**
 * Tests unitarios para InMemoryInvitacionRepository y
 * InMemoryPermisoRepository.
 */

import { InMemoryInvitacionRepository } from '../../../../../src/infrastructure/persistence/in-memory/InMemoryInvitacionRepository';
import { Invitacion } from '../../../../../src/domain/entities/Invitacion';
import { Hash } from '../../../../../src/domain/value-objects/Hash';
import { PermissionType } from '../../../../../src/domain/value-objects/PermissionType';

const HASH = 'abcd1234efgh5678ijkl9012mnop3456';

const makeInv = (over: {
  id?: string; listaId?: string; hash?: string; tipo?: string;
  email?: string | null; creadaEn?: Date; expiraEn?: Date; activa?: boolean;
} = {}): Invitacion => {
  const h = Hash.create(over.hash ?? HASH);
  const t = PermissionType.create(over.tipo ?? 'LECTURA');
  const r = Invitacion.create(
    over.id ?? 'inv-1',
    over.listaId ?? 'l1',
    (h as { value: Hash }).value,
    (t as { value: PermissionType }).value,
    over.creadaEn ?? new Date(),
    over.expiraEn,
    over.activa ?? true,
    over.email === undefined ? null : over.email
  );
  if (r.isFailure) throw (r as any).value;
  return (r as { value: Invitacion }).value;
};

// invitación expirada: creada en el pasado, expiró hace un día
const fechaPasada = (dias: number) => new Date(Date.now() - dias * 24 * 60 * 60 * 1000);

describe('InMemoryInvitacionRepository', () => {
  let repo: InMemoryInvitacionRepository;

  beforeEach(() => {
    repo = new InMemoryInvitacionRepository();
  });

  it('save/findById/findHash roundtrip', async () => {
    await repo.save(makeInv());
    expect(await repo.findById('inv-1')).not.toBeNull();
    expect(await repo.findById('no')).toBeNull();
    expect(await repo.findByHash(HASH)).not.toBeNull();
    expect(await repo.findByHash('zzzz')).toBeNull();
  });

  it('findByListaId y findActiveByListaId', async () => {
    const activa = makeInv({ id: 'a' });
    const inactiva = makeInv({ id: 'b', activa: false });
    const d = inactiva.desactivar();
    await repo.save(activa);
    await repo.save(d.isSuccess ? (d as { value: Invitacion }).value : inactiva);
    await repo.save(makeInv({ id: 'c', listaId: 'otra' }));

    expect(await repo.findByListaId('l1')).toHaveLength(2);
    expect(await repo.findActiveByListaId('l1')).toHaveLength(1);
    expect((await repo.findActiveByListaId('l1'))[0]?.id).toBe('a');
  });

  it('findPendingByEmail normaliza y ordena descendente', async () => {
    const vieja = makeInv({ id: 'v', email: 'A@B.COM', creadaEn: new Date(Date.now() - 60000) });
    const nueva = makeInv({ id: 'n', email: 'a@b.com' });
    await repo.save(vieja);
    await repo.save(nueva);

    const pending = await repo.findPendingByEmail('A@B.com');
    expect(pending).toHaveLength(2);
    expect(pending[0]?.id).toBe('n'); // más nueva primero

    const expirada = makeInv({ id: 'x', email: 'a@b.com', creadaEn: fechaPasada(10), expiraEn: fechaPasada(9) });
    await repo.save(expirada);
    expect(await repo.findPendingByEmail('a@b.com')).toHaveLength(2);
  });

  it('getAllActiveHashes devuelve solo las válidas', async () => {
    const inactiva = makeInv({ id: 'b' });
    const d = inactiva.desactivar();
    await repo.save(makeInv({ id: 'a' }));
    await repo.save(d.isSuccess ? (d as { value: Invitacion }).value : inactiva);
    await repo.save(makeInv({ id: 'x', creadaEn: fechaPasada(10), expiraEn: fechaPasada(9) })); // expirada

    const hashes = await repo.getAllActiveHashes();
    expect(hashes).toEqual([HASH]);
  });

  it('delete/update', async () => {
    await repo.save(makeInv());
    const nueva = makeInv({ tipo: 'ESCRITURA' });
    await repo.update(nueva);
    expect((await repo.findById('inv-1'))?.tipoPermiso.value).toBe('ESCRITURA');
    await repo.delete('inv-1');
    expect(await repo.findById('inv-1')).toBeNull();
  });

  it('findExpired y deactivateExpired', async () => {
    await repo.save(makeInv({ id: 'x', creadaEn: fechaPasada(10), expiraEn: fechaPasada(9) }));
    await repo.save(makeInv({ id: 'y' })); // vigente
    await repo.save(makeInv({ id: 'z', creadaEn: fechaPasada(10), expiraEn: fechaPasada(9), activa: false }));

    const expired = await repo.findExpired();
    expect(expired.map(e => e.id).sort()).toEqual(['x', 'z']);

    const count = await repo.deactivateExpired();
    expect(count).toBe(1); // z ya inactiva; x se desactiva
    expect((await repo.findById('x'))?.activa).toBe(false);
  });
});
