/**
 * Tests unitarios para PrismaPermisoRepository y PrismaInvitacionRepository
 * Mockea el PrismaClient: CRUD, búsquedas y conteos.
 */

import { PrismaPermisoRepository } from '../../../../../src/infrastructure/persistence/repositories/PrismaPermisoRepository';
import { PrismaInvitacionRepository } from '../../../../../src/infrastructure/persistence/repositories/PrismaInvitacionRepository';
import { Permiso } from '../../../../../src/domain/entities/Permiso';
import { Invitacion } from '../../../../../src/domain/entities/Invitacion';
import { Hash } from '../../../../../src/domain/value-objects/Hash';
import { PermissionType } from '../../../../../src/domain/value-objects/PermissionType';

const VALID_HASH = (() => {
  const r = Hash.create('abcd1234efgh5678ijkl9012mnop3456');
  if (r.isFailure) throw (r as any).value;
  return (r as { value: Hash }).value;
})();

const PRISMA_PERMISO = {
  id: 'pm1',
  usuarioId: 'u1',
  listaId: 'l1',
  tipoPermiso: 'LECTURA',
  fechaCreacion: new Date('2025-01-01')
};

const PRISMA_INVITACION = {
  id: 'inv1',
  hash: 'abcd1234efgh5678ijkl9012mnop3456',
  listaId: 'l1',
  tipoPermiso: 'LECTURA',
  fechaCreacion: new Date('2025-01-01'),
  fechaExpiracion: new Date('2099-01-01'),
  activa: true
};

const makePermiso = (): Permiso => {
  const r = Permiso.create('pm1', 'u1', 'l1', PermissionType.lectura());
  if (r.isFailure) throw (r as any).value;
  return (r as { value: Permiso }).value;
};

const makeInvitacion = (): Invitacion => {
  const r = Invitacion.create('inv1', 'l1', VALID_HASH, PermissionType.lectura());
  if (r.isFailure) throw (r as any).value;
  return (r as { value: Invitacion }).value;
};

describe('PrismaPermisoRepository', () => {
  let prisma: any;
  let repo: PrismaPermisoRepository;

  beforeEach(() => {
    prisma = {
      permiso: {
        upsert: jest.fn().mockResolvedValue(PRISMA_PERMISO),
        findUnique: jest.fn().mockResolvedValue(PRISMA_PERMISO),
        findMany: jest.fn().mockResolvedValue([PRISMA_PERMISO]),
        update: jest.fn().mockResolvedValue(PRISMA_PERMISO),
        delete: jest.fn().mockResolvedValue(PRISMA_PERMISO),
        deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
        count: jest.fn().mockResolvedValue(1)
      }
    };
    repo = new PrismaPermisoRepository(prisma);
  });

  it('save hace upsert por usuario+lista', async () => {
    await repo.save(makePermiso());
    expect(prisma.permiso.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { usuarioId_listaId: { usuarioId: 'u1', listaId: 'l1' } },
        create: expect.objectContaining({ usuarioId: 'u1', tipoPermiso: 'LECTURA' })
      })
    );
  });

  it('findById devuelve entidad o null', async () => {
    const p = await repo.findById('pm1');
    expect(p?.usuarioId).toBe('u1');
    prisma.permiso.findUnique.mockResolvedValue(null);
    expect(await repo.findById('x')).toBeNull();
  });

  it('findByUsuarioId / findByListaId / findByUsuarioAndLista mapean', async () => {
    expect(await repo.findByUsuarioId('u1')).toHaveLength(1);
    expect(await repo.findByListaId('l1')).toHaveLength(1);
    expect(await repo.findByUsuarioAndLista('u1', 'l1')).toHaveLength(1);
    expect(prisma.permiso.findMany).toHaveBeenCalledWith({ where: { usuarioId: 'u1' } });
    expect(prisma.permiso.findMany).toHaveBeenCalledWith({ where: { usuarioId: 'u1', listaId: 'l1' } });
  });

  it('findByUsuarioId filtra mapeos inválidos', async () => {
    prisma.permiso.findMany.mockResolvedValue([PRISMA_PERMISO, { ...PRISMA_PERMISO, id: 'pm2', tipoPermiso: 'INVALIDO_XYZ' }]);
    const permisos = await repo.findByUsuarioId('u1');
    expect(permisos).toHaveLength(1);
  });

  it('findUniqueByUsuarioAndLista', async () => {
    expect((await repo.findUniqueByUsuarioAndLista('u1', 'l1'))?.id).toBe('pm1');
    prisma.permiso.findUnique.mockResolvedValue(null);
    expect(await repo.findUniqueByUsuarioAndLista('u1', 'otra')).toBeNull();
  });

  it('update actualiza tipoPermiso', async () => {
    await repo.update(makePermiso());
    expect(prisma.permiso.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'pm1' }, data: { tipoPermiso: 'LECTURA' } })
    );
  });

  it('delete / deleteByUsuarioAndLista / deleteByListaId', async () => {
    await repo.delete('pm1');
    expect(prisma.permiso.delete).toHaveBeenCalledWith({ where: { id: 'pm1' } });
    await repo.deleteByUsuarioAndLista('u1', 'l1');
    expect(prisma.permiso.deleteMany).toHaveBeenCalledWith({ where: { usuarioId: 'u1', listaId: 'l1' } });
    await repo.deleteByListaId('l1');
    expect(prisma.permiso.deleteMany).toHaveBeenCalledWith({ where: { listaId: 'l1' } });
  });

  it('hasPermission y hasPermissionType', async () => {
    expect(await repo.hasPermission('u1', 'l1')).toBe(true);
    prisma.permiso.count.mockResolvedValue(0);
    expect(await repo.hasPermission('u1', 'l1')).toBe(false);
    expect(await repo.hasPermissionType('u1', 'l1', 'ESCRITURA')).toBe(false);
    expect(prisma.permiso.count).toHaveBeenCalledWith({ where: { usuarioId: 'u1', listaId: 'l1', tipoPermiso: 'ESCRITURA' } });
  });
});

describe('PrismaInvitacionRepository', () => {
  let prisma: any;
  let repo: PrismaInvitacionRepository;

  beforeEach(() => {
    prisma = {
      invitacion: {
        upsert: jest.fn().mockResolvedValue(PRISMA_INVITACION),
        findUnique: jest.fn().mockResolvedValue(PRISMA_INVITACION),
        findMany: jest.fn().mockResolvedValue([PRISMA_INVITACION]),
        update: jest.fn().mockResolvedValue(PRISMA_INVITACION),
        updateMany: jest.fn().mockResolvedValue({ count: 3 }),
        delete: jest.fn().mockResolvedValue(PRISMA_INVITACION)
      }
    };
    repo = new PrismaInvitacionRepository(prisma);
  });

  it('save hace upsert por id', async () => {
    await repo.save(makeInvitacion());
    expect(prisma.invitacion.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'inv1' },
        create: expect.objectContaining({ hash: 'abcd1234efgh5678ijkl9012mnop3456', tipoPermiso: 'LECTURA' })
      })
    );
  });

  it('findById / findByHash', async () => {
    expect((await repo.findById('inv1'))?.listaId).toBe('l1');
    expect((await repo.findByHash('abcd1234efgh5678ijkl9012mnop3456'))?.id).toBe('inv1');
    expect(prisma.invitacion.findUnique).toHaveBeenCalledWith({ where: { hash: 'abcd1234efgh5678ijkl9012mnop3456' } });
    prisma.invitacion.findUnique.mockResolvedValue(null);
    expect(await repo.findById('x')).toBeNull();
    expect(await repo.findByHash('nope')).toBeNull();
  });

  it('findByListaId y findActiveByListaId filtran activas no expiradas', async () => {
    expect(await repo.findByListaId('l1')).toHaveLength(1);
    expect(await repo.findActiveByListaId('l1')).toHaveLength(1);
    const where = prisma.invitacion.findMany.mock.calls[1][0].where;
    expect(where.activa).toBe(true);
    expect(where.fechaExpiracion.gt).toBeInstanceOf(Date);
  });

  it('getAllActiveHashes devuelve solo hashes', async () => {
    expect(await repo.getAllActiveHashes()).toEqual(['abcd1234efgh5678ijkl9012mnop3456']);
  });

  it('update actualiza activa y tipoPermiso', async () => {
    await repo.update(makeInvitacion());
    expect(prisma.invitacion.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'inv1' }, data: expect.objectContaining({ activa: true }) })
    );
  });

  it('findExpired usa lt a ahora', async () => {
    await repo.findExpired();
    expect(prisma.invitacion.findMany.mock.calls[0][0].where.fechaExpiracion.lt).toBeInstanceOf(Date);
  });

  it('deactivateExpired devuelve count desactivado', async () => {
    expect(await repo.deactivateExpired()).toBe(3);
    const call = prisma.invitacion.updateMany.mock.calls[0][0];
    expect(call.where.fechaExpiracion.lt).toBeInstanceOf(Date);
    expect(call.where.activa).toBe(true);
    expect(call.data).toEqual({ activa: false });
  });

  it('delete borra por id', async () => {
    await repo.delete('inv1');
    expect(prisma.invitacion.delete).toHaveBeenCalledWith({ where: { id: 'inv1' } });
  });

  it('toDomain con datos inválidos devuelve null (filtrado)', async () => {
    prisma.invitacion.findMany.mockResolvedValue([
      { ...PRISMA_INVITACION, hash: 'corto' } // hash inválido
    ]);
    expect(await repo.findByListaId('l1')).toHaveLength(0);
  });
});
