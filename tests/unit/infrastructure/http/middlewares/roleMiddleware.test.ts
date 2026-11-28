/**
 * Tests unitarios para roleMiddleware: requireRole, requireAdmin,
 * requireAdminOrOwner y extractores de ownerId.
 */

import {
  requireRole,
  requireAdmin,
  requireAdminOrOwner,
  extractOwnerIdFromParams,
  extractOwnerIdFromBody
} from '../../../../../src/infrastructure/http/middlewares/roleMiddleware';
import { RolUsuario } from '../../../../../src/domain/entities/Usuario';

const makeRes = () => {
  const res: any = { statusCode: 0 };
  res.status = jest.fn((c: number) => { res.statusCode = c; return res; });
  res.json = jest.fn((b: unknown) => { res.body = b; return res; });
  return res;
};

const makeReq = (user?: Record<string, unknown> | null) =>
  ({
    user,
    path: '/test',
    method: 'GET',
    ip: '127.0.0.1',
    get: jest.fn().mockReturnValue('UA'),
    params: { userId: 'owner-1' },
    body: {}
  }) as any;

const usuarioValido = { id: 'u1', email: 'a@b.com', rol: RolUsuario.USUARIO };

describe('requireRole', () => {
  const handler = requireRole([RolUsuario.USUARIO, RolUsuario.ADMIN]);

  it('pasa al next con usuario válido y rol permitido', () => {
    const res = makeRes();
    const next = jest.fn();
    handler(makeReq(usuarioValido), res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('401 sin autenticación', () => {
    const res = makeRes();
    const next = jest.fn();
    handler(makeReq(null), res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.body.code).toBe('AUTH_TOKEN_REQUIRED');
  });

  it('401 con datos incompletos', () => {
    const res = makeRes();
    const next = jest.fn();
    handler(makeReq({ id: 'u1', email: 'a@b.com' }), res, next);
    expect(res.statusCode).toBe(401);
    expect(res.body.code).toBe('INCOMPLETE_USER_DATA');
  });

  it('403 usuario inactivo', () => {
    const res = makeRes();
    const next = jest.fn();
    handler(makeReq({ ...usuarioValido, activo: false }), res, next);
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('INACTIVE_USER');
  });

  it('403 rol inválido (no está en el enum)', () => {
    const res = makeRes();
    const next = jest.fn();
    handler(makeReq({ ...usuarioValido, rol: 'HACKER' }), res, next);
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('INVALID_USER_ROLE');
  });

  it('403 rol insuficiente para el endpoint', () => {
    const adminOnly = requireRole([RolUsuario.ADMIN]);
    const res = makeRes();
    const next = jest.fn();
    adminOnly(makeReq(usuarioValido), res, next);
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('INSUFFICIENT_ROLE');
    expect(res.body.requiredRoles).toEqual([RolUsuario.ADMIN]);
  });

  it('403 con código personalizado cuando se pasa insufficientRoleCode', () => {
    const adminOnly = requireRole([RolUsuario.ADMIN], {
      insufficientRoleCode: 'ADMIN_ROLE_REQUIRED'
    });
    const res = makeRes();
    const next = jest.fn();
    adminOnly(makeReq(usuarioValido), res, next);
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('ADMIN_ROLE_REQUIRED');
    expect(res.body.requiredRoles).toEqual([RolUsuario.ADMIN]);
  });
});

describe('requireAdmin', () => {
  it('pasa al next con admin verificado', () => {
    const res = makeRes();
    const next = jest.fn();
    requireAdmin(makeReq({
      id: 'a1', email: 'admin@b.com', rol: RolUsuario.ADMIN, emailVerificado: true
    }), res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('401 sin usuario', () => {
    const res = makeRes();
    const next = jest.fn();
    requireAdmin(makeReq(null), res, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('403 si no es admin (ADMIN_ROLE_REQUIRED)', () => {
    const res = makeRes();
    const next = jest.fn();
    requireAdmin(makeReq(usuarioValido), res, next);
    expect(res.statusCode).toBe(403);
    // requireAdmin devuelve ADMIN_ROLE_REQUIRED en los endpoints de administración
    expect(res.body.code).toBe('ADMIN_ROLE_REQUIRED');
  });

  it('403 admin con email no verificado', () => {
    const res = makeRes();
    const next = jest.fn();
    requireAdmin(makeReq({
      id: 'a1', email: 'admin@b.com', rol: RolUsuario.ADMIN, emailVerificado: false
    }), res, next);
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('EMAIL_NOT_VERIFIED');
  });
});

describe('requireAdminOrOwner', () => {
  const getOwnerId = (req: any) => req.params['userId'];
  const middleware = requireAdminOrOwner(getOwnerId);

  it('401 sin autenticación válida', () => {
    const res = makeRes();
    const next = jest.fn();
    middleware(makeReq(null), res, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('403 usuario inactivo y rol inválido', () => {
    const r1 = makeRes();
    middleware(makeReq({ ...usuarioValido, activo: false }), r1, jest.fn());
    expect(r1.statusCode).toBe(403);
    expect(r1.body.code).toBe('INACTIVE_USER');

    const r2 = makeRes();
    middleware(makeReq({ ...usuarioValido, rol: 'X' }), r2, jest.fn());
    expect(r2.statusCode).toBe(403);
    expect(r2.body.code).toBe('INVALID_USER_ROLE');
  });

  it('admin verificado pasa sin comprobar ownership', () => {
    const res = makeRes();
    const next = jest.fn();
    middleware(makeReq({
      id: 'a1', email: 'admin@b.com', rol: RolUsuario.ADMIN, emailVerificado: true
    }), res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('admin no verificado → 403 EMAIL_NOT_VERIFIED', () => {
    const res = makeRes();
    const next = jest.fn();
    middleware(makeReq({
      id: 'a1', email: 'admin@b.com', rol: RolUsuario.ADMIN, emailVerificado: false
    }), res, next);
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe('EMAIL_NOT_VERIFIED');
    expect(next).not.toHaveBeenCalled();
  });

  it('owner pasa al next', () => {
    const res = makeRes();
    const next = jest.fn();
    middleware(makeReq({ ...usuarioValido, id: 'owner-1' }), res, next);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('no-owner → 403 y error extrayendo ownerId → 400', () => {
    const res = makeRes();
    middleware(makeReq({ ...usuarioValido, id: 'intruso' }), res, jest.fn());
    expect(res.statusCode).toBe(403);

    const throwingGetter = () => { throw new Error('no params'); };
    const res2 = makeRes();
    requireAdminOrOwner(throwingGetter)(makeReq(usuarioValido), res2, jest.fn());
    expect(res2.statusCode).toBe(400);
    expect(res2.body.code).toBe('OWNER_VALIDATION_ERROR');
  });

  it('ownerId vacío → 400', () => {
    const res = makeRes();
    requireAdminOrOwner(() => '   ')(makeReq(usuarioValido), res, jest.fn());
    expect(res.statusCode).toBe(400);
  });
});

describe('extractores de ownerId', () => {
  it('extractOwnerIdFromParams', () => {
    expect(extractOwnerIdFromParams('userId')(makeReq({ id: 'x' }))).toBe('owner-1');
  });

  it('extractOwnerIdFromBody', () => {
    const req = makeReq({ id: 'x' });
    req.body = { userId: 'from-body' };
    expect(extractOwnerIdFromBody('userId')(req)).toBe('from-body');
  });
});
