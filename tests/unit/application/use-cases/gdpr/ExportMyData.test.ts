/**
 * Tests para ExportMyData (GDPR, item 15)
 */

import { ExportMyData } from '../../../../../src/application/use-cases/gdpr/ExportMyData';
import { Usuario } from '../../../../../src/domain/entities/Usuario';
import { Email } from '../../../../../src/domain/value-objects/Email';
import { success } from '../../../../../src/shared/result';
import { NotFoundError } from '../../../../../src/application/errors/NotFoundError';
import { v4 as uuidv4 } from 'uuid';

describe('ExportMyData', () => {
  let exportMyData: ExportMyData;
  let usuarioRepository: any;
  let listaRepository: any;
  let productoRepository: any;
  let categoriaRepository: any;
  let tiendaRepository: any;
  let blueprintRepository: any;
  let permisoRepository: any;
  let invitacionRepository: any;

  const buildUsuario = () => {
    const emailResult = Email.create('antonio@example.com');
    if (emailResult.isFailure) throw new Error('Email de prueba inválido');
    const userResult = Usuario.create({
      id: uuidv4(),
      email: emailResult.value,
      password: 'hashed-password-1234567890',
      nombre: 'Antonio',
      apellidos: 'Moles Leiva',
    });
    if (userResult.isFailure) throw new Error('Usuario de prueba inválido');
    return userResult.value;
  };

  const paginaVacia = { items: [], total: 0, page: 1, limit: 1000, totalPages: 0 };

  beforeEach(() => {
    usuarioRepository = { findById: jest.fn() } as any;
    listaRepository = { findByOwner: jest.fn() } as any;
    productoRepository = { findByList: jest.fn() } as any;
    categoriaRepository = { findAll: jest.fn() } as any;
    tiendaRepository = { findAll: jest.fn() } as any;
    blueprintRepository = { findByUsuarioId: jest.fn() } as any;
    permisoRepository = { findByUsuarioId: jest.fn() } as any;
    invitacionRepository = { findByListaId: jest.fn(), findPendingByEmail: jest.fn() } as any;

    exportMyData = new ExportMyData(
      usuarioRepository,
      listaRepository,
      productoRepository,
      categoriaRepository,
      tiendaRepository,
      blueprintRepository,
      permisoRepository,
      invitacionRepository
    );
  });

  it('exporta todos los datos del usuario', async () => {
    const usuario = buildUsuario();
    usuarioRepository.findById.mockResolvedValue(success(usuario));
    listaRepository.findByOwner.mockResolvedValue(
      success({ ...paginaVacia, items: [{ id: 'lista-1', toJSON: () => ({ id: 'lista-1', nombre: 'Compra semanal' }) }], total: 1, totalPages: 1 } as any)
    );
    productoRepository.findByList.mockResolvedValue(
      success({ ...paginaVacia, items: [{ toJSON: () => ({ id: 'prod-1', nombre: 'Leche' }) }], total: 1, totalPages: 1 } as any)
    );
    categoriaRepository.findAll.mockResolvedValue(
      success([
        {
          id: 'cat-1',
          nombre: 'Lácteos',
          descripcion: null,
          color: null,
          icono: null,
          activa: true,
          tiendaId: null,
          fechaCreacion: new Date('2026-01-01'),
        },
      ])
    );
    tiendaRepository.findAll.mockResolvedValue(
      success([
        {
          id: 'tienda-1',
          nombre: 'Mercadona',
          direccion: null,
          telefono: null,
          sitioWeb: null,
          activa: true,
          fechaCreacion: new Date('2026-01-01'),
        },
      ])
    );
    blueprintRepository.findByUsuarioId.mockResolvedValue(
      success({
        ...paginaVacia,
        items: [
          {
            id: 'bp-1',
            nombre: 'Semanal',
            descripcion: 'Mi plantilla',
            publico: false,
            productos: [{ nombre: 'Leche', cantidad: 1 }],
            creadoPorId: usuario.id,
            fechaCreacion: new Date('2026-01-02'),
          },
        ],
        total: 1,
        totalPages: 1,
      })
    );
    permisoRepository.findByUsuarioId.mockResolvedValue([
      { listaId: 'lista-2', tipoPermiso: { toString: () => 'LECTURA' }, creadoEn: new Date('2026-01-03') },
    ]);
    invitacionRepository.findByListaId.mockResolvedValue([
      {
        id: 'inv-1',
        listaId: 'lista-1',
        tipoPermiso: { toString: () => 'ESCRITURA' },
        emailInvitado: 'laura@example.com',
        activa: true,
        creadaEn: new Date('2026-01-04'),
        expiraEn: new Date('2026-01-11'),
      },
    ]);
    invitacionRepository.findPendingByEmail.mockResolvedValue([]);

    const result = await exportMyData.execute({ usuarioId: usuario.id });

    expect(result.isSuccess).toBe(true);
    if (result.isSuccess) {
      expect(result.value.usuario.email).toBe('antonio@example.com');
      expect(result.value.usuario.nombre).toBe('Antonio');
      expect(result.value.listas).toHaveLength(1);
      expect(result.value.listas[0]?.productos).toHaveLength(1);
      expect(result.value.categorias).toHaveLength(1);
      expect(result.value.tiendas).toHaveLength(1);
      expect(result.value.plantillas).toHaveLength(1);
      expect(result.value.colaboraciones).toHaveLength(1);
      expect(result.value.invitaciones).toHaveLength(1);
    }
    expect(productoRepository.findByList).toHaveBeenCalledWith(
      'lista-1',
      undefined,
      expect.objectContaining({ page: 1 })
    );
  });

  it('exporta vacío cuando el usuario no tiene datos', async () => {
    const usuario = buildUsuario();
    usuarioRepository.findById.mockResolvedValue(success(usuario));
    listaRepository.findByOwner.mockResolvedValue(success(paginaVacia));
    categoriaRepository.findAll.mockResolvedValue(success([]));
    tiendaRepository.findAll.mockResolvedValue(success([]));
    blueprintRepository.findByUsuarioId.mockResolvedValue(success(paginaVacia));
    permisoRepository.findByUsuarioId.mockResolvedValue([]);
    invitacionRepository.findPendingByEmail.mockResolvedValue([]);

    const result = await exportMyData.execute({ usuarioId: usuario.id });

    expect(result.isSuccess).toBe(true);
    if (result.isSuccess) {
      expect(result.value.listas).toEqual([]);
      expect(result.value.categorias).toEqual([]);
      expect(result.value.invitaciones).toEqual([]);
    }
    expect(productoRepository.findByList).not.toHaveBeenCalled();
  });

  it('falla si el usuario no existe', async () => {
    usuarioRepository.findById.mockResolvedValue(success(null));

    const result = await exportMyData.execute({ usuarioId: 'usuario-inexistente' });

    expect(result.isFailure).toBe(true);
    if (result.isFailure) {
      expect(result.error).toBeInstanceOf(NotFoundError);
    }
    expect(listaRepository.findByOwner).not.toHaveBeenCalled();
  });
});
