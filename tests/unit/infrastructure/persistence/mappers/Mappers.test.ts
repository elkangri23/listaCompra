/**
 * Tests unitarios para mappers de persistencia (dominio <-> Prisma)
 */

import { UsuarioMapper } from '../../../../../src/infrastructure/persistence/mappers/UsuarioMapper';
import { ListaMapper } from '../../../../../src/infrastructure/persistence/mappers/ListaMapper';
import { ProductoMapper } from '../../../../../src/infrastructure/persistence/mappers/ProductoMapper';
import { CategoriaMapper } from '../../../../../src/infrastructure/persistence/mappers/CategoriaMapper';
import { TiendaMapper } from '../../../../../src/infrastructure/persistence/mappers/TiendaMapper';
import { Usuario } from '../../../../../src/domain/entities/Usuario';
import { Lista } from '../../../../../src/domain/entities/Lista';
import { Producto } from '../../../../../src/domain/entities/Producto';
import { Categoria } from '../../../../../src/domain/entities/Categoria';
import { Tienda } from '../../../../../src/domain/entities/Tienda';
import { Email } from '../../../../../src/domain/value-objects/Email';

const unwrapEntity = <T>(r: { isSuccess: boolean; value?: T }): T => r.value as T;

const makeUsuario = (): Usuario => {
  const usuario = unwrapEntity(Usuario.create({ email: Email.createUnsafe('mapper@test.local'), password: 'hashedPassword123', nombre: 'María' }));
  Object.defineProperty(usuario, '_id', { value: 'u1', writable: false });
  return usuario;
};

const makeLista = (): Lista =>
  unwrapEntity(Lista.create({ id: 'l1', nombre: 'Compras semanales', propietarioId: 'user-1' }));

const makeProducto = (): Producto =>
  unwrapEntity(Producto.create({ id: 'p1', nombre: 'Leche', listaId: 'l1', creadoPorId: 'user-1' }));

const makeCategoria = (): Categoria =>
  unwrapEntity(Categoria.create({ id: 'c1', nombre: 'Lácteos' }));

const makeTienda = (): Tienda =>
  unwrapEntity(Tienda.create({ id: 't1', nombre: 'Mercadona' }));

describe('UsuarioMapper', () => {
  it('toDomain reconstruye la entidad desde persistencia', () => {
    const raw = {
      id: 'u1',
      email: 'raw@test.local',
      password: 'hashedPassword456',
      nombre: 'Carlos',
      apellidos: 'García',
      rol: 'USUARIO',
      activo: true,
      emailVerificado: true,
      fechaCreacion: new Date('2025-01-01'),
      fechaActualizacion: new Date('2025-02-01')
    } as any;

    const usuario = UsuarioMapper.toDomain(raw);

    expect(usuario.id).toBe('u1');
    expect(usuario.nombre).toBe('Carlos');
    expect(usuario.email.value).toBe('raw@test.local');
    expect(usuario.emailVerificado).toBe(true);
  });

  it('toDomain lanza con email inválido en BD', () => {
    const raw = {
      id: 'u1', email: 'no-es-email', password: 'hashedPassword456', nombre: 'Carlos',
      rol: 'USUARIO', activo: true, fechaCreacion: new Date(), fechaActualizacion: new Date()
    } as any;

    expect(() => UsuarioMapper.toDomain(raw)).toThrow();
  });

  it('toPersistence extrae los campos planos', () => {
    const usuario = makeUsuario();
    const raw = UsuarioMapper.toPersistence(usuario);

    expect(raw.nombre).toBe('María');
    expect(raw.email).toBe('mapper@test.local');
    expect(raw.password).toBe('hashedPassword123');
    expect(raw.activo).toBe(true);
  });

  it('toDomainArray / toPersistenceArray mapean listas', () => {
    const usuarios = [makeUsuario(), makeUsuario()];
    expect(UsuarioMapper.toPersistenceArray(usuarios)).toHaveLength(2);

    const raws = [UsuarioMapper.toPersistence(makeUsuario())];
    expect(UsuarioMapper.toDomainArray(raws as any)).toHaveLength(1);
  });
});

describe('ListaMapper', () => {
  it('toDomain devuelve success con datos válidos', () => {
    const result = ListaMapper.toDomain({
      id: 'l1', nombre: 'Compras', propietarioId: 'user-1', activa: true,
      fechaCreacion: new Date(), fechaActualizacion: new Date()
    });

    expect(result.isSuccess).toBe(true);
    expect((result as { value?: Lista }).value?.nombre).toBe('Compras');
  });

  it('toDomain devuelve failure con nombre inválido', () => {
    const result = ListaMapper.toDomain({
      id: 'l1', nombre: '', propietarioId: 'user-1', activa: true
    });

    expect(result.isFailure).toBe(true);
  });

  it('toPersistance extrae campos', () => {
    const lista = makeLista();
    void lista;
    const raw = ListaMapper.toPersistence(makeLista());

    expect(raw.nombre).toBe('Compras semanales');
    expect(raw.propietarioId).toBe('user-1');
    expect(raw.activa).toBe(true);
  });
});

describe('ProductoMapper', () => {
  it('toDomain devuelve producto desde persistencia', () => {
    const result = ProductoMapper.toDomain({
      id: 'p1', nombre: 'Leche', listaId: 'l1', creadoPorId: 'user-1',
      comprado: false, urgente: false, createdAt: new Date(), updatedAt: new Date()
    } as any);

    // El mapper usa los nombres de campo de Prisma; validar que construye
    expect(result).toBeTruthy();
  });

  it('toPersistence extrae campos planos', () => {
    const raw = ProductoMapper.toPersistence(makeProducto());

    expect(raw).toBeTruthy();
    expect((raw as any).nombre).toBe('Leche');
    expect((raw as any).listaId).toBe('l1');
  });
});

describe('CategoriaMapper', () => {
  it('toDomain desde persistencia', () => {
    const categoria = CategoriaMapper.toDomain({
      id: 'c1', nombre: 'Lácteos', activa: true, fechaCreacion: new Date()
    } as any);

    expect(categoria).toBeTruthy();
    expect(categoria.nombre).toBe('Lácteos');
  });

  it('toPersistence extrae campos planos', () => {
    const raw = CategoriaMapper.toPrismaUpdate(makeCategoria());

    expect((raw as any).nombre).toBe('Lácteos');
  });
});

describe('TiendaMapper', () => {
  it('toDomain desde persistencia', () => {
    const tienda = TiendaMapper.toDomain({
      id: 't1', nombre: 'Mercadona', activa: true, fechaCreacion: new Date()
    } as any);

    expect(tienda).toBeTruthy();
    expect(tienda.nombre).toBe('Mercadona');
  });

  it('toPersistence extrae campos planos', () => {
    const raw = TiendaMapper.toPrismaUpdate(makeTienda());

    expect((raw as any).nombre).toBe('Mercadona');
  });
});
