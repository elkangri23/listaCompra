import { InMemoryUsuarioRepository } from '@infrastructure/persistence/in-memory/InMemoryUsuarioRepository';
import { Usuario, type UsuarioProps, RolUsuario } from '@domain/entities/Usuario';
import { Email } from '@domain/value-objects/Email';

describe('InMemoryUsuarioRepository', () => {
  const createUsuario = (overrides: Partial<UsuarioProps> = {}) => {
    const props: UsuarioProps = {
      email: overrides.email ?? Email.createUnsafe(`user${Math.random()}@example.com`),
      password: overrides.password ?? 'hashed-password',
      nombre: overrides.nombre ?? 'Juan',
    };

    if (overrides.apellidos !== undefined) {
      props.apellidos = overrides.apellidos;
    }

    if (overrides.rol !== undefined) {
      props.rol = overrides.rol;
    }

    if (overrides.activo !== undefined) {
      props.activo = overrides.activo;
    }

    if (overrides.emailVerificado !== undefined) {
      props.emailVerificado = overrides.emailVerificado;
    }

    if (overrides.id !== undefined) {
      props.id = overrides.id;
    }

    if (overrides.fechaCreacion !== undefined) {
      props.fechaCreacion = overrides.fechaCreacion;
    }

    if (overrides.fechaActualizacion !== undefined) {
      props.fechaActualizacion = overrides.fechaActualizacion;
    }

    const result = Usuario.create(props);

    if (result.isFailure) {
      throw result.error;
    }

    return result.value;
  };

  it('should persist, update and retrieve usuarios', async () => {
    const repository = new InMemoryUsuarioRepository();
    const usuario = createUsuario({ id: 'user-1' });

    const saveResult = await repository.save(usuario);
    expect(saveResult.isSuccess).toBe(true);

    const fetched = await repository.findById('user-1');
    expect(fetched.isSuccess).toBe(true);
    if (fetched.isSuccess) {
      expect(fetched.value).toBe(usuario);
    }

    const renameResult = usuario.actualizarNombre('Juan Actualizado');
    expect(renameResult.isSuccess).toBe(true);

    const updateResult = await repository.update(usuario);
    expect(updateResult.isSuccess).toBe(true);
    if (updateResult.isSuccess) {
      expect(updateResult.value.nombre).toBe('Juan Actualizado');
    }

    const updateMissing = await repository.update(createUsuario({ id: 'unknown-user' }));
    expect(updateMissing.isFailure).toBe(true);
    if (updateMissing.isFailure) {
      expect(updateMissing.error).toBeInstanceOf(Error);
      expect(updateMissing.error.message).toBe('Usuario no encontrado');
    }
  });

  it('should search by email and verify existence helpers', async () => {
    const repository = new InMemoryUsuarioRepository();
    const email = Email.createUnsafe('tester@example.com');
    const usuario = createUsuario({ id: 'user-1', email });
    await repository.save(usuario);

    const byEmail = await repository.findByEmail(Email.createUnsafe('tester@example.com'));
    expect(byEmail.isSuccess).toBe(true);
    if (byEmail.isSuccess) {
      expect(byEmail.value).toBe(usuario);
    }

    const exists = await repository.existsByEmail(email);
    expect(exists.isSuccess).toBe(true);
    if (exists.isSuccess) {
      expect(exists.value).toBe(true);
    }

    const notExists = await repository.existsByEmail(Email.createUnsafe('other@example.com'));
    expect(notExists.isSuccess).toBe(true);
    if (notExists.isSuccess) {
      expect(notExists.value).toBe(false);
    }
  });

  it('should paginate full list, active users and by role', async () => {
    const repository = new InMemoryUsuarioRepository();
    const usuarios = [
      createUsuario({ id: 'user-1', nombre: 'Ana', rol: RolUsuario.ADMIN }),
      createUsuario({ id: 'user-2', nombre: 'Beto', rol: RolUsuario.USUARIO }),
      createUsuario({ id: 'user-3', nombre: 'Caro', rol: RolUsuario.ADMIN, activo: false }),
      createUsuario({ id: 'user-4', nombre: 'Dani', rol: RolUsuario.USUARIO }),
    ];

    await Promise.all(usuarios.map(usuario => repository.save(usuario)));

    const all = await repository.findAll({ page: 1, limit: 2 });
    expect(all.isSuccess).toBe(true);
    if (all.isSuccess) {
      expect(all.value.data).toHaveLength(2);
      expect(all.value.total).toBe(4);
      expect(all.value.totalPages).toBe(2);
      expect(all.value.hasNext).toBe(true);
      expect(all.value.hasPrevious).toBe(false);
    }

    const active = await repository.findActive({ page: 1, limit: 10 });
    expect(active.isSuccess).toBe(true);
    if (active.isSuccess) {
      expect(active.value.total).toBe(3);
      expect(active.value.data.every(usuario => usuario.activo)).toBe(true);
    }

    const byRole = await repository.findByRole(RolUsuario.ADMIN, { page: 1, limit: 10 });
    expect(byRole.isSuccess).toBe(true);
    if (byRole.isSuccess) {
      expect(byRole.value.total).toBe(2);
      expect(byRole.value.data.every(usuario => usuario.rol === RolUsuario.ADMIN)).toBe(true);
    }
  });

  it('should handle deletion flows and counters', async () => {
    const repository = new InMemoryUsuarioRepository();
    const usuario = createUsuario({ id: 'user-1', emailVerificado: true });
    await repository.save(usuario);

    const countBefore = await repository.count();
    expect(countBefore.isSuccess).toBe(true);
    if (countBefore.isSuccess) {
      expect(countBefore.value).toBe(1);
    }

    const countActiveBefore = await repository.countActive();
    expect(countActiveBefore.isSuccess).toBe(true);
    if (countActiveBefore.isSuccess) {
      expect(countActiveBefore.value).toBe(1);
    }

    const deleteResult = await repository.delete('user-1');
    expect(deleteResult.isSuccess).toBe(true);

    const afterDelete = await repository.findById('user-1');
    expect(afterDelete.isSuccess).toBe(true);
    if (afterDelete.isSuccess && afterDelete.value) {
      expect(afterDelete.value.activo).toBe(false);
    }

    const hardDelete = await repository.hardDelete('user-1');
    expect(hardDelete.isSuccess).toBe(true);

    const countAfter = await repository.count();
    expect(countAfter.isSuccess).toBe(true);
    if (countAfter.isSuccess) {
      expect(countAfter.value).toBe(0);
    }
  });

  it('should search across email, nombre and apellidos', async () => {
    const repository = new InMemoryUsuarioRepository();
    const usuario = createUsuario({
      id: 'user-1',
      email: Email.createUnsafe('buscar@example.com'),
      nombre: 'María',
      apellidos: 'García',
    });
    await repository.save(usuario);

    const searchByEmail = await repository.search('BUSCAR', { page: 1, limit: 10 });
    expect(searchByEmail.isSuccess).toBe(true);
    if (searchByEmail.isSuccess) {
      expect(searchByEmail.value.total).toBe(1);
      expect(searchByEmail.value.data[0]).toBe(usuario);
    }

    const searchByNombre = await repository.search('mar', { page: 1, limit: 10 });
    expect(searchByNombre.isSuccess).toBe(true);
    if (searchByNombre.isSuccess) {
      expect(searchByNombre.value.total).toBe(1);
    }

    const searchByApellidos = await repository.search('garc', { page: 1, limit: 10 });
    expect(searchByApellidos.isSuccess).toBe(true);
    if (searchByApellidos.isSuccess) {
      expect(searchByApellidos.value.total).toBe(1);
    }
  });
});
