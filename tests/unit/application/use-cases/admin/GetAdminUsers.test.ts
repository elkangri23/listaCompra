/**
 * Tests para el caso de uso GetAdminUsers (panel de administración, fase 2)
 */

import { GetAdminUsers } from '../../../../../src/application/use-cases/admin/GetAdminUsers';
import type { IUsuarioRepository } from '../../../../../src/application/ports/repositories/IUsuarioRepository';
import type { IListaRepository } from '../../../../../src/application/ports/repositories/IListaRepository';
import type { IProductoRepository } from '../../../../../src/application/ports/repositories/IProductoRepository';
import { Usuario, RolUsuario } from '../../../../../src/domain/entities/Usuario';
import { Email } from '../../../../../src/domain/value-objects/Email';
import { success, failure } from '../../../../../src/shared/result';
import type { PaginationResult } from '../../../../../src/shared/types';

const makeUser = (props: {
  id: string;
  nombre: string;
  apellidos?: string;
  email: string;
  rol?: RolUsuario;
  activo?: boolean;
}): Usuario => {
  const result = Usuario.create({
    id: props.id,
    email: Email.createUnsafe(props.email),
    password: 'hash-de-prueba-largo',
    nombre: props.nombre,
    ...(props.apellidos ? { apellidos: props.apellidos } : {}),
    rol: props.rol ?? RolUsuario.USUARIO,
    activo: props.activo ?? true,
    emailVerificado: true
  });
  if (result.isFailure) {
    throw result.error;
  }
  return result.value;
};

const makePage = <T>(data: T[], total: number, page = 1, limit = 20): PaginationResult<T> => ({
  data,
  total,
  page,
  limit,
  totalPages: Math.max(1, Math.ceil(total / limit)),
  hasNext: page * limit < total,
  hasPrevious: page > 1
});

describe('GetAdminUsers', () => {
  let getAdminUsers: GetAdminUsers;
  let mockUsuarioRepository: jest.Mocked<IUsuarioRepository>;
  let mockListaRepository: jest.Mocked<IListaRepository>;
  let mockProductoRepository: jest.Mocked<IProductoRepository>;

  let admin: Usuario;
  let luis: Usuario;
  let maria: Usuario;

  beforeEach(() => {
    admin = makeUser({ id: 'admin-id', nombre: 'Admin', apellidos: 'Root', email: 'admin@ejemplo.com', rol: RolUsuario.ADMIN });
    luis = makeUser({ id: 'luis-id', nombre: 'Luis', apellidos: 'Perez', email: 'luis@ejemplo.com' });
    maria = makeUser({ id: 'maria-id', nombre: 'Maria', apellidos: 'Lopez', email: 'maria@ejemplo.com', activo: false });

    mockUsuarioRepository = {
      findAll: jest.fn(),
      search: jest.fn(),
      findById: jest.fn(),
      findByEmail: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      existsByEmail: jest.fn(),
      findActive: jest.fn(),
      findByRole: jest.fn(),
      delete: jest.fn(),
      hardDelete: jest.fn(),
      count: jest.fn(),
      countActive: jest.fn(),
      countTotpEnabled: jest.fn(),
      findAdminsWithoutTotp: jest.fn(),
      findGracePeriodAccounts: jest.fn()
    } as jest.Mocked<IUsuarioRepository>;

    mockListaRepository = {
      countByOwner: jest.fn()
    } as unknown as jest.Mocked<IListaRepository>;

    mockProductoRepository = {
      countByCreator: jest.fn()
    } as unknown as jest.Mocked<IProductoRepository>;

    mockListaRepository.countByOwner.mockImplementation(async (ownerId: string) =>
      success(ownerId === 'luis-id' ? 2 : 0)
    );
    mockProductoRepository.countByCreator.mockImplementation(async (creatorId: string) =>
      success(creatorId === 'luis-id' ? 3 : creatorId === 'maria-id' ? 1 : 0)
    );

    getAdminUsers = new GetAdminUsers(
      mockUsuarioRepository,
      mockListaRepository,
      mockProductoRepository
    );
  });

  it('lista todos los usuarios sin búsqueda, con conteos reales', async () => {
    mockUsuarioRepository.findAll.mockResolvedValue(
      success(makePage([admin, luis, maria], 3))
    );

    const result = await getAdminUsers.execute({});

    expect(result.isSuccess).toBe(true);
    if (result.isFailure) return;
    expect(mockUsuarioRepository.findAll).toHaveBeenCalledWith({ page: 1, limit: 20 });
    expect(mockUsuarioRepository.search).not.toHaveBeenCalled();
    expect(result.value.total).toBe(3);
    expect(result.value.page).toBe(1);
    expect(result.value.limit).toBe(20);
    expect(result.value.totalPages).toBe(1);
    expect(result.value.usuarios).toHaveLength(3);

    const luisDto = result.value.usuarios.find((u) => u.id === 'luis-id');
    expect(luisDto).toMatchObject({
      id: 'luis-id',
      nombre: 'Luis Perez',
      email: 'luis@ejemplo.com',
      rol: 'USUARIO',
      activo: true,
      emailVerificado: true,
      listasCreadas: 2,
      productosAgregados: 3
    });
    expect(luisDto).not.toHaveProperty('ultimaConexion');

    const mariaDto = result.value.usuarios.find((u) => u.id === 'maria-id');
    expect(mariaDto).toMatchObject({
      activo: false,
      listasCreadas: 0,
      productosAgregados: 1
    });
  });

  it('busca por término cuando se pasa q', async () => {
    mockUsuarioRepository.search.mockResolvedValue(
      success(makePage([luis], 1))
    );

    const result = await getAdminUsers.execute({ q: 'luis' });

    expect(result.isSuccess).toBe(true);
    expect(mockUsuarioRepository.search).toHaveBeenCalledWith('luis', { page: 1, limit: 20 });
    expect(mockUsuarioRepository.findAll).not.toHaveBeenCalled();
    if (result.isSuccess) {
      expect(result.value.total).toBe(1);
      expect(result.value.usuarios[0]?.id).toBe('luis-id');
    }
  });

  it('recorta los espacios del término de búsqueda', async () => {
    mockUsuarioRepository.search.mockResolvedValue(
      success(makePage([maria], 1))
    );

    await getAdminUsers.execute({ q: '  maria@ejemplo.com  ' });

    expect(mockUsuarioRepository.search).toHaveBeenCalledWith('maria@ejemplo.com', { page: 1, limit: 20 });
  });

  it('respeta la paginación pedida', async () => {
    mockUsuarioRepository.findAll.mockResolvedValue(
      success(makePage([maria], 3, 2, 2))
    );

    const result = await getAdminUsers.execute({ page: 2, limit: 2 });

    expect(mockUsuarioRepository.findAll).toHaveBeenCalledWith({ page: 2, limit: 2 });
    expect(result.isSuccess).toBe(true);
    if (result.isSuccess) {
      expect(result.value.page).toBe(2);
      expect(result.value.limit).toBe(2);
      expect(result.value.totalPages).toBe(2);
    }
  });

  it('normaliza página y límite inválidos a los valores por defecto', async () => {
    mockUsuarioRepository.findAll.mockResolvedValue(
      success(makePage([luis], 1))
    );

    await getAdminUsers.execute({ page: 0, limit: -5 });

    expect(mockUsuarioRepository.findAll).toHaveBeenCalledWith({ page: 1, limit: 20 });
  });

  it('limita el tamaño de página a 100', async () => {
    mockUsuarioRepository.findAll.mockResolvedValue(
      success(makePage([luis], 1, 1, 100))
    );

    await getAdminUsers.execute({ page: 1, limit: 500 });

    expect(mockUsuarioRepository.findAll).toHaveBeenCalledWith({ page: 1, limit: 100 });
  });

  it('propaga el error del repositorio de usuarios', async () => {
    mockUsuarioRepository.findAll.mockResolvedValue(
      failure(new Error('Fallo de base de datos'))
    );

    const result = await getAdminUsers.execute({});

    expect(result.isFailure).toBe(true);
  });

  it('propaga el error si falla un conteo', async () => {
    mockUsuarioRepository.findAll.mockResolvedValue(
      success(makePage([luis], 1))
    );
    mockListaRepository.countByOwner.mockResolvedValue(
      failure(new Error('Fallo al contar listas'))
    );

    const result = await getAdminUsers.execute({});

    expect(result.isFailure).toBe(true);
  });
});
