/**
 * Tests unitarios para PrismaUsuarioRepository (persistencia real)
 * Mockea el PrismaClient: CRUD, paginación, búsqueda y manejo de errores.
 */

import { PrismaUsuarioRepository } from '../../../../../src/infrastructure/persistence/repositories/PrismaUsuarioRepository';
import type { Result } from '../../../../../src/shared/result';

const unwrap = <T>(r: Result<T, Error>): T | null | undefined => (r.isSuccess ? (r as { value: T | null }).value : undefined);
import { Email } from '../../../../../src/domain/value-objects/Email';

// Datos válidos para UsuarioMapper.toDomain (necesita hash de 10+ chars)
const PRISMA_USUARIO = {
  id: 'u1',
  email: 'carlos@test.local',
  password: 'hashedPassword456',
  nombre: 'Carlos',
  apellidos: 'García',
  rol: 'USUARIO',
  activo: true,
  emailVerificado: true,
  fechaCreacion: new Date('2025-01-01'),
  fechaActualizacion: new Date('2025-01-02')
};

describe('PrismaUsuarioRepository', () => {
  let prisma: any;
  let repo: PrismaUsuarioRepository;

  beforeEach(() => {
    prisma = {
      usuario: {
        create: jest.fn().mockResolvedValue(PRISMA_USUARIO),
        update: jest.fn().mockResolvedValue(PRISMA_USUARIO),
        findUnique: jest.fn().mockResolvedValue(PRISMA_USUARIO),
        findMany: jest.fn().mockResolvedValue([PRISMA_USUARIO]),
        count: jest.fn().mockResolvedValue(1),
        delete: jest.fn().mockResolvedValue(PRISMA_USUARIO)
      }
    };
    repo = new PrismaUsuarioRepository(prisma);
  });

  it('save crea y devuelve la entidad de dominio', async () => {
    const usuario = UsuarioMapperFactory.create();
    const result = await repo.save(usuario);

    expect(result.isSuccess).toBe(true);
    expect(prisma.usuario.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ email: usuario.email.value }) })
    );
  });

  it('update actualiza con fechaActualizacion', async () => {
    const usuario = UsuarioMapperFactory.create();
    const result = await repo.update(usuario);

    expect(result.isSuccess).toBe(true);
    expect(prisma.usuario.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: usuario.id }, data: expect.objectContaining({ fechaActualizacion: expect.any(Date) }) })
    );
  });

  it('findById devuelve la entidad o null', async () => {
    const found = await repo.findById('u1');
    expect(unwrap(found)?.id).toBe('u1');

    prisma.usuario.findUnique.mockResolvedValue(null);
    expect(unwrap(await repo.findById('nope'))).toBeNull();
  });

  it('findByEmail consulta por email', async () => {
    const found = await repo.findByEmail(Email.createUnsafe('carlos@test.local'));

    expect(unwrap(found)).toBeTruthy();
    expect(prisma.usuario.findUnique).toHaveBeenCalledWith({ where: { email: 'carlos@test.local' } });
  });

  it('existsByEmail usa count', async () => {
    expect(unwrap(await repo.existsByEmail(Email.createUnsafe('carlos@test.local')))).toBe(true);
    expect(prisma.usuario.count).toHaveBeenCalledWith({ where: { email: 'carlos@test.local', activo: true } });
  });

  it('findAll pagina correctamente', async () => {
    const result = await repo.findAll({ page: 2, limit: 10 });

    expect(prisma.usuario.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 10, orderBy: { fechaCreacion: 'desc' } })
    );
    expect(unwrap(result)?.page).toBe(2);
    expect(unwrap(result)?.hasPrevious).toBe(true);
    expect(unwrap(result)?.data).toHaveLength(1);
  });

  it('findActive filtra por activo=true', async () => {
    await repo.findActive({ page: 1, limit: 10 });

    expect(prisma.usuario.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { activo: true } })
    );
  });

  it('findByRole filtra por rol', async () => {
    await repo.findByRole('ADMIN', { page: 1, limit: 10 });

    expect(prisma.usuario.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ rol: 'ADMIN' }) })
    );
  });

  it('delete hace soft delete (update activo=false)', async () => {
    await repo.delete('u1');

    expect(prisma.usuario.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'u1' }, data: expect.objectContaining({ activo: false }) })
    );
  });

  it('hardDelete elimina físicamente', async () => {
    await repo.hardDelete('u1');

    expect(prisma.usuario.delete).toHaveBeenCalledWith({ where: { id: 'u1' } });
  });

  it('count y countActive', async () => {
    expect(unwrap(await repo.count())).toBe(1);
    expect(prisma.usuario.count).toHaveBeenCalledWith();

    prisma.usuario.count.mockResolvedValue(7);
    expect(unwrap(await repo.countActive())).toBe(7);
  });

  it('search construye OR insensitive sobre nombre/apellidos/email', async () => {
    const result = await repo.search('carlos', { page: 1, limit: 10 });

    expect(prisma.usuario.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          activo: true,
          OR: expect.arrayContaining([
            { nombre: { contains: 'carlos', mode: 'insensitive' } }
          ])
        })
      })
    );
    expect(unwrap(result)?.total).toBe(1);
  });

  it('errores de Prisma se convierten en Result failure (no lanzan)', async () => {
    prisma.usuario.findUnique.mockRejectedValue(new Error('DB down'));

    const result = await repo.findById('u1');
    expect(result.isFailure).toBe(true);
  });
});

/**
 * Helper: crea una entidad Usuario de dominio real para pasar al repo.
 */
import { Usuario } from '../../../../../src/domain/entities/Usuario';

const UsuarioMapperFactory = {
  create: (): Usuario => {
    const usuario = Usuario.create({
      email: Email.createUnsafe('carlos@test.local'),
      password: 'hashedPassword456',
      nombre: 'Carlos'
    });
    return (usuario as { value?: Usuario }).value!;
  }
};
