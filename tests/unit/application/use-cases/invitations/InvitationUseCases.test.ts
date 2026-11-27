/**
 * Tests unitarios para los casos de uso de invitaciones (CU-15..CU-18):
 * ShareList, AccessSharedList, ManagePermissions y CancelInvitation.
 */

import { ShareList } from '../../../../../src/application/use-cases/invitations/ShareList';
import { AccessSharedList } from '../../../../../src/application/use-cases/invitations/AccessSharedList';
import { ManagePermissions } from '../../../../../src/application/use-cases/invitations/ManagePermissions';
import { CancelInvitation } from '../../../../../src/application/use-cases/invitations/CancelInvitation';
import { Lista } from '../../../../../src/domain/entities/Lista';
import { Usuario } from '../../../../../src/domain/entities/Usuario';
import { Invitacion } from '../../../../../src/domain/entities/Invitacion';
import { Permiso } from '../../../../../src/domain/entities/Permiso';
import { Hash } from '../../../../../src/domain/value-objects/Hash';
import { PermissionType } from '../../../../../src/domain/value-objects/PermissionType';
import { Email } from '../../../../../src/domain/value-objects/Email';

const VALID_HASH = (() => {
  const r = Hash.create('abcd1234efgh5678ijkl9012mnop3456');
  if (r.isFailure) throw (r as any).value;
  return (r as { value: Hash }).value;
})();


const makeUsuario = (id: string): Usuario => {
  const r = Usuario.create({
    email: Email.createUnsafe(`${id}@test.local`),
    password: 'hashedPassword123',
    nombre: 'Nombre'
  });
  if (r.isFailure) throw (r as any).value;
  const usuario = (r as { value: Usuario }).value;
  Object.defineProperty(usuario, '_id', { value: id });
  return usuario;
};

const makeLista = (propietarioId = 'owner-1'): Lista => {
  const r = Lista.create({ id: 'l1', nombre: 'Semanal', propietarioId });
  if (r.isFailure) throw (r as any).value;
  return (r as { value: Lista }).value;
};

const makeInvitacion = (opts: { inactiva?: boolean } = {}): Invitacion => {
  const r = Invitacion.create('inv-1', 'l1', VALID_HASH, PermissionType.lectura());
  if (r.isFailure) throw (r as any).value;
  const inv = (r as { value: Invitacion }).value;
  if (opts.inactiva) {
    const d = inv.desactivar();
    return d.isSuccess ? (d as { value: Invitacion }).value : inv;
  }
  return inv;
};

const makePermiso = (tipo = 'LECTURA'): Permiso => {
  const tipoResult = PermissionType.create(tipo);
  const tipoPermiso = tipoResult.isSuccess ? (tipoResult as { value: PermissionType }).value : PermissionType.lectura();
  const r = Permiso.create('perm-1', 'colab-1', 'l1', tipoPermiso);
  if (r.isFailure) throw (r as any).value;
  return (r as { value: Permiso }).value;
};

const successResult = <T>(value: T) => ({ isSuccess: true, isFailure: false, value });

const makeRepos = () => {
  const lista = makeLista();
  const repos = {
    listaRepository: {
      findById: jest.fn().mockResolvedValue(successResult(lista)),
      update: jest.fn()
    },
    usuarioRepository: {
      findById: jest.fn().mockImplementation(async (id: string) => successResult(makeUsuario(id)))
    },
    invitacionRepository: {
      findById: jest.fn().mockResolvedValue(makeInvitacion()),
      getAllActiveHashes: jest.fn().mockResolvedValue([]),
      save: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue(undefined),
      findByHash: jest.fn().mockResolvedValue(makeInvitacion())
    },
    permisoRepository: {
      findByUsuarioAndLista: jest.fn().mockResolvedValue([]),
      findUniqueByUsuarioAndLista: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined)
    },
    hashGenerator: {
      generateUniqueHash: jest.fn().mockReturnValue(successResult(VALID_HASH))
    },
    outboxService: {
      saveEvent: jest.fn().mockResolvedValue(undefined)
    }
  };
  return repos;
};

describe('ShareList (CU-15)', () => {
  let repos: ReturnType<typeof makeRepos>;
  let useCase: ShareList;

  beforeEach(() => {
    repos = makeRepos();
    useCase = new ShareList(
      repos.listaRepository as any,
      repos.usuarioRepository as any,
      repos.invitacionRepository as any,
      repos.permisoRepository as any,
      repos.hashGenerator as any,
      repos.outboxService as any,
      'https://test.local'
    );
  });

  it('propietario comparte con LECTURA y publica evento', async () => {
    const r = (await useCase.execute({
      listaId: 'l1', usuarioComparteId: 'owner-1', tipoPermiso: 'LECTURA', emailInvitado: 'Invitado@Test.local'
    })) as any;

    expect(r.isSuccess).toBe(true);
    expect(r.value.hash).toBe('abcd1234efgh5678ijkl9012mnop3456');
    expect(r.value.tipoPermiso).toBe('LECTURA');
    expect(r.value.enlaceInvitacion).toContain('https://test.local');
    expect(repos.invitacionRepository.save).toHaveBeenCalled();
    expect(repos.outboxService.saveEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'ListaCompartida' })
    );
  });

  it('validaciones de entrada', async () => {
    const r1 = (await useCase.execute({ listaId: '', usuarioComparteId: 'u1', tipoPermiso: 'LECTURA' })) as any;
    const r2 = (await useCase.execute({ listaId: 'l1', usuarioComparteId: '', tipoPermiso: 'LECTURA' })) as any;
    const r3 = (await useCase.execute({ listaId: 'l1', usuarioComparteId: 'u1', tipoPermiso: '' })) as any;
    const r4 = (await useCase.execute({ listaId: 'l1', usuarioComparteId: 'u1', tipoPermiso: 'LECTURA', diasExpiracion: 400 })) as any;
    const r5 = (await useCase.execute({ listaId: 'l1', usuarioComparteId: 'u1', tipoPermiso: 'LECTURA', emailInvitado: 'no-es-email' })) as any;
    expect(r1.error.message).toContain('lista');
    expect(r2.error.message).toContain('usuario');
    expect(r3.error.message).toContain('permiso');
    expect(r4.error.message).toContain('365');
    expect(r5.error.message).toContain('Email');
  });

  it('404 lista o usuario inexistentes', async () => {
    repos.listaRepository.findById.mockResolvedValue(successResult(null));
    const r1 = (await useCase.execute({ listaId: 'x', usuarioComparteId: 'owner-1', tipoPermiso: 'LECTURA' })) as any;
    expect(r1.error.message).toContain('no encontrad');

    repos.listaRepository.findById.mockResolvedValue(successResult(makeLista()));
    repos.usuarioRepository.findById.mockResolvedValueOnce(successResult(null));
    const r2 = (await useCase.execute({ listaId: 'l1', usuarioComparteId: 'nadie', tipoPermiso: 'LECTURA' })) as any;
    expect(r2.error.message).toContain('no encontrad');
  });

  it('unauthorized si no es propietario ni admin', async () => {
    repos.usuarioRepository.findById.mockResolvedValue(successResult(makeUsuario('colab-1')));
    repos.permisoRepository.findByUsuarioAndLista.mockResolvedValue([]);
    const r = (await useCase.execute({ listaId: 'l1', usuarioComparteId: 'colab-1', tipoPermiso: 'LECTURA' })) as any;
    expect(r.error.message).toContain('No tienes permisos');
  });

  it('colaborador con permiso ADMIN puede compartir', async () => {
    repos.usuarioRepository.findById.mockResolvedValue(successResult(makeUsuario('colab-1')));
    repos.permisoRepository.findByUsuarioAndLista.mockResolvedValue([makePermiso('ADMIN')]);
    const r = (await useCase.execute({ listaId: 'l1', usuarioComparteId: 'colab-1', tipoPermiso: 'LECTURA' })) as any;
    expect(r.isSuccess).toBe(true);
  });

  it('tipo de permiso inválido → ValidationError', async () => {
    const r = (await useCase.execute({ listaId: 'l1', usuarioComparteId: 'owner-1', tipoPermiso: 'NOEXISTE' })) as any;
    expect(r.error.message).toContain('inválido');
  });
});

describe('AccessSharedList (CU-16)', () => {
  let repos: ReturnType<typeof makeRepos>;
  let useCase: AccessSharedList;

  beforeEach(() => {
    repos = makeRepos();
    useCase = new AccessSharedList(
      repos.listaRepository as any,
      repos.usuarioRepository as any,
      repos.invitacionRepository as any,
      repos.permisoRepository as any
    );
  });

  it('accede con hash válido y crea permiso nuevo', async () => {
    repos.usuarioRepository.findById.mockResolvedValue(successResult(makeUsuario('u1')));
    const r = (await useCase.execute({ hash: 'abcd1234efgh5678ijkl9012mnop3456', usuarioId: 'u1' })) as any;

    expect(r.isSuccess).toBe(true);
    expect(r.value.lista.id).toBe('l1');
    expect(r.value.lista.propietarioNombre).toContain('Nombre');
    expect(r.value.permiso.tipoPermiso).toBe('LECTURA');
    expect(repos.permisoRepository.save).toHaveBeenCalled();
  });

  it('hash inválido → ValidationError; hash desconocido → 404', async () => {
    const r1 = (await useCase.execute({ hash: 'corto', usuarioId: 'u1' })) as any;
    expect(r1.error.message).toContain('Hash');

    repos.invitacionRepository.findByHash.mockResolvedValue(null);
    const r2 = (await useCase.execute({ hash: 'abcd1234efgh5678ijkl9012mnop3456', usuarioId: 'u1' })) as any;
    expect(r2.error.message).toContain('no encontrad');
  });

  it('invitación inactiva o expirada → Unauthorized', async () => {
    repos.invitacionRepository.findByHash.mockResolvedValue(makeInvitacion({ inactiva: true }));
    const r = (await useCase.execute({ hash: 'abcd1234efgh5678ijkl9012mnop3456', usuarioId: 'u1' })) as any;
    expect(r.error.message).toContain('activa');
  });

  it('usuario o lista inexistentes → 404', async () => {
    repos.usuarioRepository.findById.mockResolvedValueOnce(successResult(null));
    const r1 = (await useCase.execute({ hash: 'abcd1234efgh5678ijkl9012mnop3456', usuarioId: 'nadie' })) as any;
    expect(r1.error.message).toContain('no encontrad');

    repos.listaRepository.findById.mockResolvedValue(successResult(null));
    repos.usuarioRepository.findById.mockResolvedValue(successResult(makeUsuario('u1')));
    const r2 = (await useCase.execute({ hash: 'abcd1234efgh5678ijkl9012mnop3456', usuarioId: 'u1' })) as any;
    expect(r2.error.message).toContain('no encontrad');
  });

  it('permiso existente de menor nivel se eleva', async () => {
    repos.usuarioRepository.findById.mockResolvedValue(successResult(makeUsuario('u1')));
    const permisoLectura = makePermiso('LECTURA');
    Object.defineProperty(permisoLectura, '_id', { value: 'perm-1' });
    repos.permisoRepository.findUniqueByUsuarioAndLista.mockResolvedValue(permisoLectura);
    repos.invitacionRepository.findByHash.mockResolvedValue(
      (() => {
        const r = Invitacion.create('inv-1', 'l1', VALID_HASH, PermissionType.escritura());
        return (r as { value: Invitacion }).value;
      })()
    );

    const r = (await useCase.execute({ hash: 'abcd1234efgh5678ijkl9012mnop3456', usuarioId: 'u1' })) as any;
    expect(r.isSuccess).toBe(true);
    expect(repos.permisoRepository.update).toHaveBeenCalled();
  });

  it('permiso existente igual no se re-guarda', async () => {
    repos.usuarioRepository.findById.mockResolvedValue(successResult(makeUsuario('u1')));
    repos.permisoRepository.findUniqueByUsuarioAndLista.mockResolvedValue(makePermiso('LECTURA'));
    const r = (await useCase.execute({ hash: 'abcd1234efgh5678ijkl9012mnop3456', usuarioId: 'u1' })) as any;
    expect(r.isSuccess).toBe(true);
    expect(repos.permisoRepository.save).not.toHaveBeenCalled();
    expect(repos.permisoRepository.update).not.toHaveBeenCalled();
  });
});

describe('ManagePermissions (CU-17)', () => {
  let repos: ReturnType<typeof makeRepos>;
  let useCase: ManagePermissions;

  beforeEach(() => {
    repos = makeRepos();
    useCase = new ManagePermissions(
      repos.listaRepository as any,
      repos.usuarioRepository as any,
      repos.permisoRepository as any
    );
  });

  const baseDto = {
    listaId: 'l1', adminUsuarioId: 'owner-1', targetUsuarioId: 'colab-1',
    accion: 'cambiar' as const, nuevoTipoPermiso: 'ESCRITURA' as const
  };

  it('cambia permiso a ESCRITURA', async () => {
    repos.permisoRepository.findUniqueByUsuarioAndLista.mockResolvedValue(makePermiso('LECTURA'));
    const r = (await useCase.execute({ ...baseDto, nuevoTipoPermiso: 'ESCRITURA' })) as any;

    expect(r.isSuccess).toBe(true);
    expect(r.value.mensaje).toContain('ESCRITURA');
    expect(repos.permisoRepository.update).toHaveBeenCalled();
  });

  it('elimina permiso', async () => {
    repos.permisoRepository.findUniqueByUsuarioAndLista.mockResolvedValue(makePermiso('LECTURA'));
    const r = (await useCase.execute({ ...baseDto, accion: 'eliminar' })) as any;
    expect(r.isSuccess).toBe(true);
    expect(repos.permisoRepository.delete).toHaveBeenCalledWith('perm-1');
  });

  it('validaciones: ids, acción inválida, nuevoTipoPermiso requerido', async () => {
    const r1 = (await useCase.execute({ ...baseDto, listaId: '' })) as any;
    const r2 = (await useCase.execute({ ...baseDto, adminUsuarioId: '' })) as any;
    const r3 = (await useCase.execute({ ...baseDto, targetUsuarioId: '' })) as any;
    const r4 = (await useCase.execute({ ...baseDto, accion: 'noexiste' as never })) as any;
    const r5 = (await useCase.execute({ ...baseDto, nuevoTipoPermiso: '' })) as any;
    expect(r1.error.message).toContain('lista');
    expect(r2.error.message).toContain('administrador');
    expect(r3.error.message).toContain('objetivo');
    // la validación de acción ocurre antes del switch
    expect(r4.error.message).toContain('Acción debe ser');
    expect(r5.error.message).toContain('Nuevo tipo de permiso');
  });

  it('404 lista/admin/objetivo/permiso inexistentes', async () => {
    repos.listaRepository.findById.mockResolvedValue(successResult(null));
    expect(((await useCase.execute(baseDto)) as any).error.message).toContain('no encontrad');

    repos.listaRepository.findById.mockResolvedValue(successResult(makeLista()));
    repos.usuarioRepository.findById.mockImplementation(async (id: string) =>
      id === 'colab-1' ? successResult(makeUsuario(id)) : successResult(null)
    );
    expect(((await useCase.execute(baseDto)) as any).error.message).toContain('administrador');

    repos.usuarioRepository.findById.mockImplementation(async (id: string) =>
      id.startsWith('owner') ? successResult(makeUsuario(id)) : successResult(null)
    );
    expect(((await useCase.execute(baseDto)) as any).error.message).toContain('objetivo');

    repos.usuarioRepository.findById.mockResolvedValue(successResult(makeUsuario('owner-1')));
    repos.permisoRepository.findUniqueByUsuarioAndLista.mockResolvedValue(null);
    expect(((await useCase.execute(baseDto)) as any).error.message).toContain('no encontrad');
  });

  it('unauthorized no-admin y objetivo=propietario', async () => {
    repos.usuarioRepository.findById.mockImplementation(async (id: string) => successResult(makeUsuario(id)));
    repos.permisoRepository.findByUsuarioAndLista.mockResolvedValue([]);
    repos.permisoRepository.findUniqueByUsuarioAndLista.mockResolvedValue(makePermiso('LECTURA'));
    const r1 = (await useCase.execute({ ...baseDto, adminUsuarioId: 'colab-2' })) as any;
    expect(r1.error.message).toContain('permisos de administrador');

    // admin (no propietario) con permiso ADMIN intenta gestionar al propietario
    repos.usuarioRepository.findById.mockImplementation(async (id: string) => successResult(makeUsuario(id)));
    repos.permisoRepository.findByUsuarioAndLista.mockResolvedValue([makePermiso('ADMIN')]);
    const r2 = (await useCase.execute({ ...baseDto, adminUsuarioId: 'admin-2', targetUsuarioId: 'owner-1' })) as any;
    expect(r2.error.message).toContain('propietario');
  });
});

describe('CancelInvitation (CU-18)', () => {
  let repos: ReturnType<typeof makeRepos>;
  let useCase: CancelInvitation;

  beforeEach(() => {
    repos = makeRepos();
    useCase = new CancelInvitation(
      repos.listaRepository as any,
      repos.usuarioRepository as any,
      repos.invitacionRepository as any,
      repos.permisoRepository as any
    );
  });

  it('propietario cancela invitación activa', async () => {
    const r = (await useCase.execute({ invitacionId: 'inv-1', adminUsuarioId: 'owner-1' })) as any;
    expect(r.isSuccess).toBe(true);
    expect(r.value.mensaje).toContain('cancelada');
    expect(repos.invitacionRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({ activa: false })
    );
  });

  it('invitación inexistente → 404', async () => {
    repos.invitacionRepository.findById.mockResolvedValue(null);
    const r = (await useCase.execute({ invitacionId: 'x', adminUsuarioId: 'owner-1' })) as any;
    expect(r.error.message).toContain('no encontrad');
  });

  it('invitación ya desactivada → ValidationError', async () => {
    repos.invitacionRepository.findById.mockResolvedValue(makeInvitacion({ inactiva: true }));
    const r = (await useCase.execute({ invitacionId: 'inv-1', adminUsuarioId: 'owner-1' })) as any;
    expect(r.error.message).toContain('desactivada');
  });

  it('lista inexistente → 404', async () => {
    repos.listaRepository.findById.mockResolvedValue(successResult(null));
    const r = (await useCase.execute({ invitacionId: 'inv-1', adminUsuarioId: 'owner-1' })) as any;
    expect(r.error.message).toContain('no encontrad');
  });

  it('no-admin → Unauthorized', async () => {
    repos.usuarioRepository.findById.mockResolvedValue(successResult(makeUsuario('colab-1')));
    repos.permisoRepository.findByUsuarioAndLista.mockResolvedValue([]);
    const r = (await useCase.execute({ invitacionId: 'inv-1', adminUsuarioId: 'colab-1' })) as any;
    expect(r.error.message).toContain('permisos de administrador');
  });

  it('validaciones de ids vacíos', async () => {
    const r1 = (await useCase.execute({ invitacionId: '', adminUsuarioId: 'owner-1' })) as any;
    const r2 = (await useCase.execute({ invitacionId: 'inv-1', adminUsuarioId: '' })) as any;
    expect(r1.error.message).toContain('invitación');
    expect(r2.error.message).toContain('administrador');
  });
});
