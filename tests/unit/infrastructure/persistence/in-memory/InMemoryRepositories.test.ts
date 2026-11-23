/**
 * Tests unitarios para repositorios in-memory (dobles de testing de persistencia)
 * Usuario, Lista, Producto, Categoría, Tienda y Permiso.
 */

import { InMemoryUsuarioRepository } from '../../../../../src/infrastructure/persistence/in-memory/InMemoryUsuarioRepository';
import { InMemoryListaRepository } from '../../../../../src/infrastructure/persistence/in-memory/InMemoryListaRepository';
import { InMemoryProductoRepository } from '../../../../../src/infrastructure/persistence/in-memory/InMemoryProductoRepository';
import { InMemoryCategoriaRepository } from '../../../../../src/infrastructure/persistence/in-memory/InMemoryCategoriaRepository';
import { InMemoryTiendaRepository } from '../../../../../src/infrastructure/persistence/in-memory/InMemoryTiendaRepository';
import { InMemoryPermisoRepository } from '../../../../../src/infrastructure/persistence/in-memory/InMemoryPermisoRepository';
import { Usuario } from '../../../../../src/domain/entities/Usuario';
import { Lista } from '../../../../../src/domain/entities/Lista';
import { Producto } from '../../../../../src/domain/entities/Producto';
import { Categoria } from '../../../../../src/domain/entities/Categoria';
import { Tienda } from '../../../../../src/domain/entities/Tienda';
import { Permiso } from '../../../../../src/domain/entities/Permiso';
import { PermissionType } from '../../../../../src/domain/value-objects/PermissionType';
import { Email } from '../../../../../src/domain/value-objects/Email';
import type { Result } from '../../../../../src/shared/result';

const unwrap = <T>(r: Result<T, Error>): T => (r.isSuccess ? (r as { value: T }).value : (undefined as unknown as T));
const unwrapOpt = <T>(r: Result<T | null, Error>): T | null => (r.isSuccess ? (r as { value: T | null }).value : null);

const unwrapDomain = <T>(r: { isSuccess: boolean; value?: T }): T => r.value as T;

const makeUsuario = (id: string, email: string, nombre = 'María', activo = true): Usuario => {
  const u = unwrapDomain(Usuario.create({ email: Email.createUnsafe(email), password: 'hashedPassword123', nombre }));
  (u as unknown as { _id?: string; _activo?: boolean })._id = id;
  (u as unknown as { _activo?: boolean })._activo = activo;
  return u;
};

const makeLista = (id: string, propietarioId: string, nombre = 'Compras', activa = true): Lista =>
  unwrapDomain(Lista.create({ id, nombre, propietarioId, activa }));

const makeProducto = (id: string, listaId: string, nombre = 'Leche', overrides: Record<string, unknown> = {}): Producto =>
  unwrapDomain(Producto.create({ id, nombre, listaId, creadoPorId: 'user-1', ...overrides }));

describe('InMemoryUsuarioRepository', () => {
  let repo: InMemoryUsuarioRepository;

  beforeEach(() => { repo = new InMemoryUsuarioRepository(); });

  it('save + findById + findByEmail', async () => {
    await repo.save(makeUsuario('u1', 'a@test.local'));

    expect(unwrapOpt(await repo.findById('u1'))).toBeTruthy();
    expect(unwrapOpt(await repo.findByEmail(Email.createUnsafe('a@test.local')))).toBeTruthy();
    expect(unwrap(await repo.existsByEmail(Email.createUnsafe('a@test.local')))).toBe(true);
    expect(unwrap(await repo.existsByEmail(Email.createUnsafe('nope@test.local')))).toBe(false);
  });

  it('update modifica un usuario existente', async () => {
    const usuario = makeUsuario('u1', 'a@test.local', 'Nombre Original');
    await repo.save(usuario);
    const saved = unwrapOpt(await repo.findById('u1'))!;

    const actualizado = unwrapDomain(Usuario.create({ id: 'u1', email: Email.createUnsafe('a@test.local'), password: 'hashedPassword123', nombre: 'Nombre Nuevo' }));
    await repo.update(actualizado);

    const after = unwrapOpt(await repo.findById('u1'))!;
    expect(after.nombre).toBe('Nombre Nuevo');
    expect(after.nombre).not.toBe(saved.nombre);
  });

  it('findById devuelve null para id inexistente', async () => {
    expect(unwrapOpt(await repo.findById('nope'))).toBeNull();
  });

  it('findAll y findActive paginan', async () => {
    await repo.save(makeUsuario('u1', 'a@test.local'));
    await repo.save(makeUsuario('u2', 'b@test.local'));
    await repo.save(makeUsuario('u3', 'c@test.local', 'Carlos', false));

    const all = unwrap(await repo.findAll({ page: 1, limit: 10 }));
    expect(all.total).toBe(3);

    const active = unwrap(await repo.findActive({ page: 1, limit: 10 }));
    expect(active.total).toBe(2);
  });

  it('deleteById elimina y count/countActive cuentan', async () => {
    await repo.save(makeUsuario('u1', 'a@test.local'));
    await repo.save(makeUsuario('u2', 'b@test.local', 'User', false));

    expect(unwrap(await repo.countActive())).toBe(1);

    await repo.deleteById('u1');

    expect(unwrap(await repo.count())).toBe(1);
  });

  it('hardDelete elimina el registro', async () => {
    await repo.save(makeUsuario('u1', 'a@test.local'));

    await repo.hardDelete('u1');

    expect(unwrapOpt(await repo.findById('u1'))).toBeNull();
    expect(unwrap(await repo.count())).toBe(0);
  });
});

describe('InMemoryListaRepository', () => {
  let repo: InMemoryListaRepository;

  beforeEach(() => { repo = new InMemoryListaRepository(); });

  it('save + findById + findByIdAndOwner', async () => {
    await repo.save(makeLista('l1', 'user-1'));

    expect(unwrapOpt(await repo.findById('l1'))).toBeTruthy();
    expect(unwrapOpt(await repo.findByIdAndOwner('l1', 'user-1'))).toBeTruthy();
    expect(unwrapOpt(await repo.findByIdAndOwner('l1', 'otro'))).toBeNull();
  });

  it('findByOwner filtra por propietario y estado', async () => {
    await repo.save(makeLista('l1', 'user-1'));
    await repo.save(makeLista('l2', 'user-1', 'Inactiva', false));
    await repo.save(makeLista('l3', 'user-2'));

    const own = unwrap(await repo.findByOwner('user-1'));
    expect(own.total).toBe(2);

    const onlyActive = unwrap(await repo.findByOwner('user-1', { activa: true }));
    expect(onlyActive.items).toHaveLength(1);
    expect(onlyActive.items[0]?.id).toBe('l1');
  });

  it('existsByNameAndOwner y countByOwner', async () => {
    await repo.save(makeLista('l1', 'user-1', 'Compras'));

    expect(unwrap(await repo.existsByNameAndOwner('Compras', 'user-1'))).toBe(true);
    expect(unwrap(await repo.existsByNameAndOwner('Compras', 'user-2'))).toBe(false);
    expect(unwrap(await repo.countByOwner('user-1'))).toBe(1);
  });

  it('updateActiveStatus cambia el estado', async () => {
    await repo.save(makeLista('l1', 'user-1'));

    await repo.updateActiveStatus('l1', false);

    const lista = unwrapOpt(await repo.findById('l1'))!;
    expect(lista.activa).toBe(false);
  });

  it('deleteById es soft delete (desactiva)', async () => {
    await repo.save(makeLista('l1', 'user-1'));

    await repo.deleteById('l1');

    const lista = unwrapOpt(await repo.findById('l1'))!;
    expect(lista.activa).toBe(false);
  });
});

describe('InMemoryProductoRepository', () => {
  let repo: InMemoryProductoRepository;

  beforeEach(() => { repo = new InMemoryProductoRepository(); });

  it('save + findById + findByIdAndList', async () => {
    await repo.save(makeProducto('p1', 'l1'));

    expect(unwrapOpt(await repo.findById('p1'))).toBeTruthy();
    expect(unwrapOpt(await repo.findByIdAndList('p1', 'l1'))).toBeTruthy();
    expect(unwrapOpt(await repo.findByIdAndList('p1', 'otra'))).toBeNull();
  });

  it('findByList filtra por comprado', async () => {
    await repo.save(makeProducto('p1', 'l1'));
    await repo.save(makeProducto('p2', 'l1', 'Pan', { comprado: true }));
    await repo.save(makeProducto('p3', 'l2'));

    const activos = unwrap(await repo.findByList('l1', { comprado: false }));
    expect(activos.items).toHaveLength(1);

    const comprados = unwrap(await repo.findByList('l1', { comprado: true }));
    expect(comprados.items).toHaveLength(1);

    const todos = unwrap(await repo.findByList('l1'));
    expect(todos.items).toHaveLength(2);
  });

  it('countByList y getResumenByList', async () => {
    await repo.save(makeProducto('p1', 'l1'));
    await repo.save(makeProducto('p2', 'l1', 'Pan', { comprado: true }));

    expect(unwrap(await repo.countByList('l1'))).toBe(2);

    const resumen = unwrap(await repo.getResumenByList('l1'));
    expect(resumen).toBeTruthy();
  });

  it('markAllAsPurchased marca todos los de la lista', async () => {
    await repo.save(makeProducto('p1', 'l1'));
    await repo.save(makeProducto('p2', 'l1'));
    await repo.save(makeProducto('p3', 'l2'));

    const count = unwrap(await repo.markAllAsPurchased('l1', true));

    expect(count).toBe(2);
    expect((unwrapOpt(await repo.findById('p1'))!) as unknown as { comprado: boolean }).toHaveProperty('comprado', true);
    expect((unwrapOpt(await repo.findById('p3'))!) as unknown as { comprado: boolean }).toHaveProperty('comprado', false);
  });

  it('deleteAllByList elimina solo de esa lista', async () => {
    await repo.save(makeProducto('p1', 'l1'));
    await repo.save(makeProducto('p2', 'l1'));
    await repo.save(makeProducto('p3', 'l2'));

    const count = unwrap(await repo.deleteAllByList('l1'));

    expect(count).toBe(2);
    expect(unwrapOpt(await repo.findById('p1'))).toBeNull();
    expect(unwrapOpt(await repo.findById('p3'))).toBeTruthy();
  });

  it('deleteById elimina un producto', async () => {
    await repo.save(makeProducto('p1', 'l1'));

    await repo.deleteById('p1');

    expect(unwrapOpt(await repo.findById('p1'))).toBeNull();
  });
});

describe('InMemoryCategoriaRepository', () => {
  let repo: InMemoryCategoriaRepository;

  const makeCategoria = (id: string, nombre = 'Lácteos'): Categoria =>
    unwrapDomain(Categoria.create({ id, nombre }));

  beforeEach(() => { repo = new InMemoryCategoriaRepository(); });

  it('save + findById', async () => {
    await repo.save(makeCategoria('c1'));

    expect(unwrapOpt(await repo.findById('c1'))).toBeTruthy();
    expect(unwrapOpt(await repo.findById('nope'))).toBeNull();
  });

  it('update y delete', async () => {
    await repo.save(makeCategoria('c1'));

    const categoria = unwrapOpt(await repo.findById('c1'))!;
    void categoria;

    await repo.save(makeCategoria('c1', 'Panadería'));
    const updated = unwrapOpt(await repo.findById('c1'))!;
    expect(updated.nombre).toBe('Panadería');

    await repo.delete('c1');
    expect(unwrapOpt(await repo.findById('c1'))).toBeNull();
  });
});

describe('InMemoryTiendaRepository', () => {
  let repo: InMemoryTiendaRepository;

  const makeTienda = (id: string, nombre = 'Mercadona'): Tienda =>
    unwrapDomain(Tienda.create({ id, nombre }));

  beforeEach(() => { repo = new InMemoryTiendaRepository(); });

  it('save + findById', async () => {
    await repo.save(makeTienda('t1'));

    expect(unwrapOpt(await repo.findById('t1'))).toBeTruthy();
    expect(unwrapOpt(await repo.findById('nope'))).toBeNull();
  });

  it('update y delete', async () => {
    await repo.save(makeTienda('t1'));

    await repo.save(makeTienda('t1', 'Carrefour'));
    const updated = unwrapOpt(await repo.findById('t1'))!;
    expect(updated.nombre).toBe('Carrefour');

    await repo.delete('t1');
    expect(unwrapOpt(await repo.findById('t1'))).toBeNull();
  });
});

describe('InMemoryPermisoRepository', () => {
  let repo: InMemoryPermisoRepository;

  const makePermiso = (id: string, usuarioId: string, listaId: string, tipo: PermissionType): Permiso =>
    unwrapDomain(Permiso.create(id, usuarioId, listaId, tipo));

  beforeEach(() => { repo = new InMemoryPermisoRepository(); });

  it('save + findById + findByUsuarioId + findByListaId', async () => {
    await repo.save(makePermiso('pm1', 'u1', 'l1', PermissionType.lectura()));

    expect(await repo.findById('pm1')).toBeTruthy();
    expect(await repo.findByUsuarioId('u1')).toHaveLength(1);
    expect(await repo.findByListaId('l1')).toHaveLength(1);
    expect(await repo.findByUsuarioId('otro')).toHaveLength(0);
  });

  it('findUniqueByUsuarioAndLista', async () => {
    await repo.save(makePermiso('pm1', 'u1', 'l1', PermissionType.lectura()));

    expect(await repo.findUniqueByUsuarioAndLista('u1', 'l1')).toBeTruthy();
    expect(await repo.findUniqueByUsuarioAndLista('u1', 'otra')).toBeNull();
  });

  it('hasPermission y hasPermissionType', async () => {
    await repo.save(makePermiso('pm1', 'u1', 'l1', PermissionType.lectura()));

    expect(await repo.hasPermission('u1', 'l1')).toBe(true);
    expect(await repo.hasPermission('u2', 'l1')).toBe(false);
    expect(await repo.hasPermissionType('u1', 'l1', 'LECTURA')).toBe(true);
    expect(await repo.hasPermissionType('u1', 'l1', 'ADMIN')).toBe(false);
  });

  it('delete y deleteByListaId', async () => {
    await repo.save(makePermiso('pm1', 'u1', 'l1', PermissionType.lectura()));
    await repo.save(makePermiso('pm2', 'u2', 'l1', PermissionType.escritura()));

    await repo.delete('pm1');
    expect(await repo.findByListaId('l1')).toHaveLength(1);

    await repo.deleteByListaId('l1');
    expect(await repo.findByListaId('l1')).toHaveLength(0);
  });

  it('deleteByUsuarioAndLista elimina solo ese par', async () => {
    await repo.save(makePermiso('pm1', 'u1', 'l1', PermissionType.lectura()));
    await repo.save(makePermiso('pm2', 'u1', 'l2', PermissionType.lectura()));

    await repo.deleteByUsuarioAndLista('u1', 'l1');

    expect(await repo.findByUsuarioId('u1')).toHaveLength(1);
  });
});
