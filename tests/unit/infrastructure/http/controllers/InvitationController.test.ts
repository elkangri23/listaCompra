/**
 * Tests unitarios para InvitationController (CU-15..CU-18, panel 13A).
 * Use cases mockeados; se verifica el mapeo HTTP completo.
 */

import { InvitationController } from '../../../../../src/infrastructure/http/controllers/InvitationController';
import { ValidationError } from '../../../../../src/application/errors/ValidationError';
import { NotFoundError } from '../../../../../src/application/errors/NotFoundError';
import { UnauthorizedError } from '../../../../../src/application/errors/UnauthorizedError';
import { Usuario } from '../../../../../src/domain/entities/Usuario';
import { Email } from '../../../../../src/domain/value-objects/Email';

const makeRes = () => {
  const res: any = { statusCode: 0 };
  res.status = jest.fn((c: number) => { res.statusCode = c; return res; });
  res.json = jest.fn((b: unknown) => { res.body = b; return res; });
  res.send = jest.fn((b: unknown) => { res.body = b; return res; });
  return res;
};

const makeUsuario = (id: string, nombre = 'Ana'): Usuario => {
  const r = Usuario.create({
    email: Email.createUnsafe(`${id}@test.local`),
    password: 'hashedPassword123',
    nombre
  });
  if (r.isFailure) throw (r as any).value;
  return (r as { value: Usuario }).value;
};

const invitacionDTO = () => ({
  id: 'inv-1',
  listaId: 'l1',
  hash: { value: 'abcd1234efgh5678ijkl9012mnop3456' },
  tipoPermiso: { value: 'LECTURA' },
  creadaEn: new Date('2024-01-01T10:00:00Z'),
  expiraEn: new Date('2024-01-08T10:00:00Z'),
  activa: true
});

const permisoDTO = (usuarioId = 'colab-1') => ({
  id: 'perm-1',
  usuarioId,
  listaId: 'l1',
  tipoPermiso: { value: 'ESCRITURA' },
  creadoEn: new Date('2024-01-02T10:00:00Z')
});

const listaDTO = () => ({
  id: 'l1',
  nombre: 'Semanal',
  propietarioId: 'owner-1',
  fechaCreacion: new Date('2024-01-01T09:00:00Z')
});

const makeServices = () => ({
  shareList: { execute: jest.fn().mockResolvedValue({ isSuccess: true, isFailure: false, value: { hash: 'h' } }) },
  accessSharedList: { execute: jest.fn().mockResolvedValue({ isSuccess: true, isFailure: false, value: { lista: {} } }) },
  managePermissions: { execute: jest.fn().mockResolvedValue({ isSuccess: true, isFailure: false, value: { mensaje: 'ok', permiso: { id: 'perm-1', creadoEn: new Date('2024-01-02T10:00:00Z') } } }) },
  cancelInvitation: { execute: jest.fn().mockResolvedValue({ isSuccess: true, isFailure: false, value: { mensaje: 'cancelada' } }) },
  declineInvitation: { execute: jest.fn().mockResolvedValue({ isSuccess: true, isFailure: false, value: { mensaje: 'rechazada' } }) },
  invitacionRepository: {
    findPendingByEmail: jest.fn().mockResolvedValue([invitacionDTO()]),
    findActiveByListaId: jest.fn().mockResolvedValue([invitacionDTO()])
  },
  permisoRepository: {
    findByListaId: jest.fn().mockResolvedValue([permisoDTO()])
  },
  usuarioRepository: {
    findById: jest.fn().mockImplementation(async (id: string) => ({ isSuccess: true, isFailure: false, value: makeUsuario(id) }))
  },
  listaRepository: {
    findById: jest.fn().mockResolvedValue({ isSuccess: true, isFailure: false, value: listaDTO() })
  }
});

const makeController = (over: Record<string, unknown> = {}) => {
  const s = makeServices();
  Object.assign(s, over);
  const controller = new InvitationController(
    s.shareList as any,
    s.accessSharedList as any,
    s.managePermissions as any,
    s.cancelInvitation as any,
    s.invitacionRepository as any,
    s.permisoRepository as any,
    s.declineInvitation as any,
    s.usuarioRepository as any,
    s.listaRepository as any
  );
  return { controller, s };
};

const req = (over: Record<string, unknown> = {}) => ({ user: { userId: 'owner-1' }, params: {}, body: {}, ...over }) as any;

describe('InvitationController', () => {
  describe('shareList', () => {
    it('201 compartiendo con conversión de duracionHoras a días', async () => {
      const { controller, s } = makeController();
      const res = makeRes();
      await controller.shareList(req({
        params: { listaId: 'l1' },
        body: { tipoPermiso: 'LECTURA', duracionHoras: 36, email: ' x@y.com ' }
      }), res);
      expect(res.statusCode).toBe(201);
      expect(s.shareList.execute).toHaveBeenCalledWith(expect.objectContaining({
        listaId: 'l1', usuarioComparteId: 'owner-1', tipoPermiso: 'LECTURA',
        diasExpiracion: 2, emailInvitado: 'x@y.com'
      }));
    });

    it('400 sin listaId y 401 sin usuario', async () => {
      const { controller } = makeController();
      const res = makeRes();
      await controller.shareList(req({ params: {}, user: { userId: 'u1' } }), res);
      expect(res.statusCode).toBe(400);

      const res2 = makeRes();
      await controller.shareList(req({ params: { listaId: 'l1' }, user: undefined }), res2);
      expect(res2.statusCode).toBe(401);
    });

    it('mapea errores del use case', async () => {
      const cases: [Error, number][] = [
        [new ValidationError('bad', 'tipoPermiso', 'x'), 400],
        [new NotFoundError('Lista', 'l1'), 404],
        [new UnauthorizedError('sin permisos'), 403]
      ];
      for (const [error, status] of cases) {
        const { controller, s } = makeController();
        s.shareList.execute.mockResolvedValueOnce({ isSuccess: false, isFailure: true, error });
        const res = makeRes();
        await controller.shareList(req({ params: { listaId: 'l1' }, body: { tipoPermiso: 'X' } }), res);
        expect(res.statusCode).toBe(status);
      }
    });

    it('500 si el use case lanza', async () => {
      const { controller, s } = makeController();
      s.shareList.execute.mockRejectedValue(new Error('boom'));
      const res = makeRes();
      await controller.shareList(req({ params: { listaId: 'l1' }, body: {} }), res);
      expect(res.statusCode).toBe(500);
    });
  });

  describe('accessSharedList', () => {
    it('200 con hash y usuario', async () => {
      const { controller, s } = makeController();
      const res = makeRes();
      await controller.accessSharedList(req({ params: { hash: 'abcd1234efgh5678ijkl9012mnop3456' } }), res);
      expect(res.statusCode).toBe(200);
      expect(s.accessSharedList.execute).toHaveBeenCalledWith({
        hash: 'abcd1234efgh5678ijkl9012mnop3456', usuarioId: 'owner-1'
      });
    });

    it('400 sin hash y 401 sin usuario', async () => {
      const { controller } = makeController();
      const res = makeRes();
      await controller.accessSharedList(req({ params: {} }), res);
      expect(res.statusCode).toBe(400);

      const res2 = makeRes();
      await controller.accessSharedList(req({ params: { hash: 'h' }, user: undefined }), res2);
      expect(res2.statusCode).toBe(401);
    });
  });

  describe('changePermissions / removePermissions', () => {
    it('200 cambia permisos con creadoEn ISO', async () => {
      const { controller, s } = makeController();
      const res = makeRes();
      await controller.changePermissions(req({
        params: { listaId: 'l1', targetUsuarioId: 'colab-1' },
        body: { nuevoTipoPermiso: 'ESCRITURA' }
      }), res);
      expect(res.statusCode).toBe(200);
      expect(s.managePermissions.execute).toHaveBeenCalledWith(expect.objectContaining({
        accion: 'cambiar', nuevoTipoPermiso: 'ESCRITURA'
      }));
      expect(res.body.data.creadoEn).toBe('2024-01-02T10:00:00.000Z');
    });

    it('acepta tipoPermiso alternativo y maneja respuesta sin permiso', async () => {
      const { controller, s } = makeController({
        managePermissions: { execute: jest.fn().mockResolvedValue({ isSuccess: true, isFailure: false, value: { mensaje: 'ok', permiso: null } }) }
      });
      const res = makeRes();
      await controller.changePermissions(req({
        params: { listaId: 'l1', targetUsuarioId: 'colab-1' },
        body: { tipoPermiso: 'ADMIN' }
      }), res);
      expect(res.statusCode).toBe(200);
      expect(s.managePermissions.execute).toHaveBeenCalledWith(expect.objectContaining({ nuevoTipoPermiso: 'ADMIN' }));
      expect(res.body.data.mensaje).toBe('ok');
    });

    it('removePermissions 200 con accion eliminar', async () => {
      const { controller, s } = makeController();
      const res = makeRes();
      await controller.removePermissions(req({ params: { listaId: 'l1', targetUsuarioId: 'colab-1' } }), res);
      expect(res.statusCode).toBe(200);
      expect(s.managePermissions.execute).toHaveBeenCalledWith(expect.objectContaining({ accion: 'eliminar' }));
    });

    it('validateParams: 401 sin usuario y 400 sin params', async () => {
      const { controller } = makeController();
      const res = makeRes();
      await controller.changePermissions(req({ params: { listaId: 'l1', targetUsuarioId: 'c' }, user: undefined }), res);
      expect(res.statusCode).toBe(401);

      const res2 = makeRes();
      await controller.changePermissions(req({ params: { listaId: 'l1' } }), res2);
      expect(res2.statusCode).toBe(400);
    });
  });

  describe('cancelInvitation / declineInvitation', () => {
    it('cancelInvitation 200', async () => {
      const { controller, s } = makeController();
      const res = makeRes();
      await controller.cancelInvitation(req({ params: { invitacionId: 'inv-1' } }), res);
      expect(res.statusCode).toBe(200);
      expect(s.cancelInvitation.execute).toHaveBeenCalledWith({ invitacionId: 'inv-1', adminUsuarioId: 'owner-1' });
    });

    it('declineInvitation 200 y 500 sin use case', async () => {
      const { controller, s } = makeController();
      const res = makeRes();
      await controller.declineInvitation(req({ params: { invitacionId: 'inv-1' } }), res);
      expect(res.statusCode).toBe(200);
      expect(s.declineInvitation.execute).toHaveBeenCalledWith({ invitacionId: 'inv-1', usuarioId: 'owner-1' });

      const { controller: c2 } = makeController();
      (c2 as any).declineInvitationUseCase = undefined;
      const res2 = makeRes();
      await c2.declineInvitation(req({ params: { invitacionId: 'inv-1' } }), res2);
      expect(res2.statusCode).toBe(500);
    });
  });

  describe('getPendingInvitations', () => {
    it('200 con invitaciones enriquecidas', async () => {
      const { controller } = makeController();
      const res = makeRes();
      await controller.getPendingInvitations(req(), res);
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0]).toMatchObject({
        id: 'inv-1', listaId: 'l1', listName: 'Semanal', from: 'Ana'
      });
    });

    it('401 sin usuario, 500 sin repos, 404 usuario inexistente, salta lista inexistente', async () => {
      const { controller } = makeController();
      const res = makeRes();
      await controller.getPendingInvitations(req({ user: undefined }), res);
      expect(res.statusCode).toBe(401);

      const { controller: c2 } = makeController();
      (c2 as any).usuarioRepository = undefined;
      const res2 = makeRes();
      await c2.getPendingInvitations(req(), res2);
      expect(res2.statusCode).toBe(500);

      const { controller: c3, s: s3 } = makeController();
      s3.usuarioRepository.findById.mockResolvedValueOnce({ isSuccess: true, isFailure: false, value: null });
      const res3 = makeRes();
      await c3.getPendingInvitations(req(), res3);
      expect(res3.statusCode).toBe(404);

      const { controller: c4, s: s4 } = makeController();
      s4.listaRepository.findById.mockResolvedValue({ isSuccess: true, isFailure: false, value: null });
      const res4 = makeRes();
      await c4.getPendingInvitations(req(), res4);
      expect(res4.statusCode).toBe(200);
      expect(res4.body).toEqual([]);
    });
  });

  describe('getCollaborators', () => {
    it('200 con propietario + colaboradores (mapeo editor/viewer)', async () => {
      const { controller, s } = makeController();
      s.permisoRepository.findByListaId.mockResolvedValue([permisoDTO('colab-1'), permisoDTO('owner-1')]);
      const res = makeRes();
      await controller.getCollaborators(req({ params: { listaId: 'l1' } }), res);
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveLength(2); // propietario + colab-1; owner-1 duplicado se salta
      expect(res.body[0].role).toBe('owner');
      expect(res.body[1].role).toBe('editor'); // ESCRITURA → editor
    });

    it('LECTURA mapea a viewer; usuario sin perms con permiso de usuario inexistente se salta', async () => {
      const { controller, s } = makeController();
      s.permisoRepository.findByListaId.mockResolvedValue([{ ...permisoDTO('fantasma'), tipoPermiso: { value: 'LECTURA' } }]);
      s.usuarioRepository.findById.mockImplementation(async (id: string) =>
        id === 'owner-1' ? { isSuccess: true, isFailure: false, value: makeUsuario(id) } : { isSuccess: true, isFailure: false, value: null }
      );
      const res = makeRes();
      await controller.getCollaborators(req({ params: { listaId: 'l1' } }), res);
      expect(res.body).toHaveLength(1); // solo propietario
    });

    it('404 lista inexistente', async () => {
      const { controller, s } = makeController();
      s.listaRepository.findById.mockResolvedValue({ isSuccess: true, isFailure: false, value: null });
      const res = makeRes();
      await controller.getCollaborators(req({ params: { listaId: 'l1' } }), res);
      expect(res.statusCode).toBe(404);
    });
  });

  describe('updateCollaboratorRole / removeCollaborator', () => {
    const baseReq = (body: Record<string, unknown>) => req({
      params: { listaId: 'l1', userId: 'colab-1' }, body
    });

    it('200 cambia rol a viewer y devuelve colaborador', async () => {
      const { controller, s } = makeController();
      s.managePermissions.execute.mockResolvedValue({
        isSuccess: true, isFailure: false,
        value: { mensaje: 'ok', permiso: null }
      });
      const res = makeRes();
      await controller.updateCollaboratorRole(baseReq({ role: 'viewer' }), res);
      expect(res.statusCode).toBe(200);
      expect(s.managePermissions.execute).toHaveBeenCalledWith(expect.objectContaining({
        accion: 'cambiar', nuevoTipoPermiso: 'LECTURA'
      }));
      expect(res.body.role).toBe('viewer');
    });

    it('400 role owner y rol inválido', async () => {
      const { controller } = makeController();
      const res = makeRes();
      await controller.updateCollaboratorRole(baseReq({ role: 'owner' }), res);
      expect(res.statusCode).toBe(400);

      const res2 = makeRes();
      await controller.updateCollaboratorRole(baseReq({ role: 'boss' }), res2);
      expect(res2.statusCode).toBe(400);
    });

    it('404 si el usuario objetivo no existe tras el cambio', async () => {
      const { controller, s } = makeController();
      s.usuarioRepository.findById.mockResolvedValueOnce({ isSuccess: true, isFailure: false, value: null });
      const res = makeRes();
      await controller.updateCollaboratorRole(baseReq({ role: 'editor' }), res);
      expect(res.statusCode).toBe(404);
    });

    it('removeCollaborator 204 y errores mapeados', async () => {
      const { controller, s } = makeController();
      const res = makeRes();
      await controller.removeCollaborator(baseReq({}), res);
      expect(res.statusCode).toBe(204);
      expect(res.send).toHaveBeenCalled();

      s.managePermissions.execute.mockResolvedValueOnce({
        isSuccess: false, isFailure: true, error: new UnauthorizedError('no')
      });
      const res2 = makeRes();
      await controller.removeCollaborator(baseReq({}), res2);
      expect(res2.statusCode).toBe(403);
    });
  });

  describe('getListInvitations / getListPermissions', () => {
    it('listInvitations 200 con datos de invitación', async () => {
      const { controller } = makeController();
      const res = makeRes();
      await controller.getListInvitations(req({ params: { listaId: 'l1' } }), res);
      expect(res.statusCode).toBe(200);
      expect(res.body.data[0]).toMatchObject({
        id: 'inv-1', hash: 'abcd1234efgh5678ijkl9012mnop3456', activa: true
      });
    });

    it('listPermissions 200', async () => {
      const { controller } = makeController();
      const res = makeRes();
      await controller.getListPermissions(req({ params: { listaId: 'l1' } }), res);
      expect(res.statusCode).toBe(200);
      expect(res.body.data[0].tipoPermiso).toBe('ESCRITURA');
    });

    it('400 sin listaId y 401 sin usuario en ambos', async () => {
      const { controller } = makeController();
      const res1 = makeRes();
      await controller.getListInvitations(req({ params: {} }), res1);
      const res2 = makeRes();
      await controller.getListInvitations(req({ params: { listaId: 'l1' }, user: undefined }), res2);
      expect(res1.statusCode).toBe(400);
      expect(res2.statusCode).toBe(401);

      const res3 = makeRes();
      await controller.getListPermissions(req({ params: {} }), res3);
      const res4 = makeRes();
      await controller.getListPermissions(req({ params: { listaId: 'l1' }, user: undefined }), res4);
      expect(res3.statusCode).toBe(400);
      expect(res4.statusCode).toBe(401);
    });
  });
});
