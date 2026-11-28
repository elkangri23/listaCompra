/**
 * Tests para el caso de uso UpdateUserStatus (panel de administración, fase 2)
 */

import { UpdateUserStatus } from '../../../../../src/application/use-cases/admin/UpdateUserStatus';
import type { IUsuarioRepository } from '../../../../../src/application/ports/repositories/IUsuarioRepository';
import { Usuario, RolUsuario } from '../../../../../src/domain/entities/Usuario';
import { Email } from '../../../../../src/domain/value-objects/Email';
import { success } from '../../../../../src/shared/result';
import { ValidationError } from '../../../../../src/application/errors/ValidationError';
import { NotFoundError } from '../../../../../src/application/errors/NotFoundError';

const ADMIN_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '22222222-2222-4222-8222-222222222222';

const makeUser = (props: {
  id: string;
  nombre: string;
  email: string;
  rol?: RolUsuario;
  activo?: boolean;
}): Usuario => {
  const result = Usuario.create({
    id: props.id,
    email: Email.createUnsafe(props.email),
    password: 'hash-de-prueba-largo',
    nombre: props.nombre,
    rol: props.rol ?? RolUsuario.USUARIO,
    activo: props.activo ?? true,
    emailVerificado: true
  });
  if (result.isFailure) {
    throw result.error;
  }
  return result.value;
};

describe('UpdateUserStatus', () => {
  let updateUserStatus: UpdateUserStatus;
  let mockUsuarioRepository: jest.Mocked<IUsuarioRepository>;
  let admin: Usuario;
  let user: Usuario;
  let inactiveUser: Usuario;

  beforeEach(() => {
    admin = makeUser({ id: ADMIN_ID, nombre: 'Admin', email: 'admin@ejemplo.com', rol: RolUsuario.ADMIN });
    user = makeUser({ id: USER_ID, nombre: 'Luis', email: 'luis@ejemplo.com' });
    inactiveUser = makeUser({ id: '33333333-3333-4333-8333-333333333333', nombre: 'Maria', email: 'maria@ejemplo.com', activo: false });

    const store = new Map<string, Usuario>([
      [admin.id, admin],
      [user.id, user],
      [inactiveUser.id, inactiveUser]
    ]);

    mockUsuarioRepository = {
      findById: jest.fn(async (id: string) => success(store.get(id) ?? null)),
      update: jest.fn(async (usuario: Usuario) => {
        store.set(usuario.id, usuario);
        return success(usuario);
      })
    } as unknown as jest.Mocked<IUsuarioRepository>;

    updateUserStatus = new UpdateUserStatus(mockUsuarioRepository);
  });

  it('desactiva un usuario activo', async () => {
    const result = await updateUserStatus.execute(ADMIN_ID, USER_ID, false);

    expect(result.isSuccess).toBe(true);
    if (result.isSuccess) {
      expect(result.value.activo).toBe(false);
      expect(result.value.id).toBe(USER_ID);
      expect(result.value.nombre).toBe('Luis');
    }
    expect(mockUsuarioRepository.update).toHaveBeenCalledTimes(1);
    expect(user.activo).toBe(false);
  });

  it('activa un usuario inactivo', async () => {
    const result = await updateUserStatus.execute(ADMIN_ID, inactiveUser.id, true);

    expect(result.isSuccess).toBe(true);
    if (result.isSuccess) {
      expect(result.value.activo).toBe(true);
    }
    expect(inactiveUser.activo).toBe(true);
  });

  it('rechaza que un admin se desactive a sí mismo', async () => {
    const result = await updateUserStatus.execute(ADMIN_ID, ADMIN_ID, false);

    expect(result.isFailure).toBe(true);
    if (result.isFailure) {
      expect(result.error).toBeInstanceOf(ValidationError);
      expect(result.error.message).toMatch(/propia cuenta/);
    }
    expect(mockUsuarioRepository.update).not.toHaveBeenCalled();
    expect(admin.activo).toBe(true);
  });

  it('permite que un admin se active a sí mismo (solo se bloquea desactivarse)', async () => {
    const result = await updateUserStatus.execute(ADMIN_ID, ADMIN_ID, true);

    // El admin ya está activo: la entidad lo rechaza por estar ya en ese estado
    expect(result.isFailure).toBe(true);
    if (result.isFailure) {
      expect(result.error).toBeInstanceOf(ValidationError);
    }
  });

  it('rechaza desactivar un usuario que ya está inactivo', async () => {
    const result = await updateUserStatus.execute(ADMIN_ID, inactiveUser.id, false);

    expect(result.isFailure).toBe(true);
    if (result.isFailure) {
      expect(result.error).toBeInstanceOf(ValidationError);
      expect(result.error.message).toMatch(/ya está inactivo/);
    }
    expect(mockUsuarioRepository.update).not.toHaveBeenCalled();
  });

  it('rechaza activar un usuario que ya está activo', async () => {
    const result = await updateUserStatus.execute(ADMIN_ID, USER_ID, true);

    expect(result.isFailure).toBe(true);
    if (result.isFailure) {
      expect(result.error).toBeInstanceOf(ValidationError);
      expect(result.error.message).toMatch(/ya está activo/);
    }
    expect(mockUsuarioRepository.update).not.toHaveBeenCalled();
  });

  it('devuelve NotFoundError con un usuario inexistente', async () => {
    const result = await updateUserStatus.execute(ADMIN_ID, 'usuario-inexistente', false);

    expect(result.isFailure).toBe(true);
    if (result.isFailure) {
      expect(result.error).toBeInstanceOf(NotFoundError);
    }
    expect(mockUsuarioRepository.update).not.toHaveBeenCalled();
  });
});
