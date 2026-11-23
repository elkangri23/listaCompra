/**
 * Tests unitarios para NotificationConsumer (Fase 8, CU-19)
 * Verifica el enrutado de eventos y el envío de notificaciones reales a
 * colaboradores (getListCollaborators vía IPermisoRepository).
 */

import { NotificationConsumer } from '../../../../../src/infrastructure/messaging/consumers/NotificationConsumer';
import { success, failure } from '../../../../../src/shared/result';

jest.mock('../../../../../src/infrastructure/observability/logger/Logger', () => {
  class FakeLogger {
    ai = jest.fn(); http = jest.fn(); error = jest.fn(); warn = jest.fn();
    info = jest.fn(); security = jest.fn(); debug = jest.fn();
    constructor(_context?: string) {}
  }
  return { Logger: FakeLogger, defaultLogger: new FakeLogger('Main') };
});

const makeEvent = (eventType: string, data: any, overrides: any = {}) => ({
  eventType,
  eventId: 'evt-1',
  timestamp: new Date().toISOString(),
  aggregateId: 'lista-1',
  aggregateType: 'Lista',
  version: 1,
  data,
  ...overrides
} as any);

const makeUsuario = (overrides: any = {}) => ({
  id: overrides.id ?? 'user-1',
  email: { toString: () => overrides.email ?? 'user1@test.local' },
  nombre: overrides.nombre ?? 'Usuario Uno',
  nombreCompleto: overrides.nombreCompleto ?? 'Usuario Uno',
  activo: overrides.activo ?? true
} as any);

describe('NotificationConsumer', () => {
  let emailService: any;
  let usuarioRepository: any;
  let listaRepository: any;
  let permisoRepository: any;
  let consumer: NotificationConsumer;

  beforeEach(() => {
    emailService = {
      sendInvitationEmail: jest.fn().mockResolvedValue({ success: true }),
      sendRegistrationConfirmation: jest.fn().mockResolvedValue({ success: true }),
      sendListChangeNotification: jest.fn().mockResolvedValue({ success: true })
    };
    usuarioRepository = { findById: jest.fn() };
    listaRepository = { findById: jest.fn() };
    permisoRepository = { findByListaId: jest.fn().mockResolvedValue([]) };
    consumer = new NotificationConsumer(emailService, usuarioRepository, listaRepository, permisoRepository);
  });

  it('ListaCompartida: envía email de invitación con datos de lista y expiración', async () => {
    usuarioRepository.findById.mockResolvedValue(success(makeUsuario()));
    listaRepository.findById.mockResolvedValue(success({ id: 'lista-1', nombre: 'Mi Lista' } as any));

    await consumer.handle(makeEvent('ListaCompartida', {
      listaId: 'lista-1',
      usuarioComparteId: 'user-1',
      usuarioInvitadoEmail: 'invitado@test.local',
      tipoPermiso: 'ESCRITURA',
      invitacionId: 'inv-1',
      hash: 'hash-123',
      expiraEn: new Date(Date.now() + 86400000).toISOString()
    }), {} as any);

    expect(emailService.sendInvitationEmail).toHaveBeenCalledWith(
      'invitado@test.local',
      expect.any(String),
      'Usuario Uno',
      'Mi Lista',
      'hash-123',
      expect.any(Date)
    );
  });

  it('ListaCompartida: falla si el email falla (rethrow para retry)', async () => {
    usuarioRepository.findById.mockResolvedValue(success(makeUsuario()));
    listaRepository.findById.mockResolvedValue(success({ id: 'lista-1', nombre: 'Mi Lista' } as any));
    emailService.sendInvitationEmail.mockResolvedValue({ success: false, error: 'quota' });

    await expect(consumer.handle(makeEvent('ListaCompartida', {
      listaId: 'lista-1', usuarioComparteId: 'user-1',
      usuarioInvitadoEmail: 'invitado@test.local', tipoPermiso: 'LECTURA',
      invitacionId: 'inv-1', hash: 'h', expiraEn: new Date().toISOString()
    }), {} as any)).rejects.toThrow();
  });

  it('UsuarioRegistrado: envía confirmación solo si hay token', async () => {
    await consumer.handle(makeEvent('UsuarioRegistrado', {
      usuarioId: 'user-1', email: 'nuevo@test.local', nombre: 'Nuevo', confirmationToken: 'tok-1'
    }), {} as any);

    expect(emailService.sendRegistrationConfirmation).toHaveBeenCalledWith(
      'nuevo@test.local', 'Nuevo', 'tok-1'
    );
  });

  it('UsuarioRegistrado: no envía email sin confirmationToken', async () => {
    await consumer.handle(makeEvent('UsuarioRegistrado', {
      usuarioId: 'user-1', email: 'nuevo@test.local', nombre: 'Nuevo'
    }), {} as any);

    expect(emailService.sendRegistrationConfirmation).not.toHaveBeenCalled();
  });

  it('ProductoAnadido: notifica a los colaboradores excepto al autor', async () => {
    listaRepository.findById.mockResolvedValue(success({ id: 'lista-1', nombre: 'Lista' } as any));
    permisoRepository.findByListaId.mockResolvedValue([
      { usuarioId: 'colab-1' } as any,
      { usuarioId: 'colab-2' } as any
    ]);
    usuarioRepository.findById.mockImplementation((id: string) =>
      Promise.resolve(success(makeUsuario({ id, email: `${id}@test.local`, nombre: id })))
    );

    await consumer.handle(makeEvent('ProductoAnadido', {
      listaId: 'lista-1', productoId: 'prod-1', nombre: 'Leche', usuarioId: 'autor-1'
    }), {} as any);

    const emails = emailService.sendListChangeNotification.mock.calls.map((c: any[]) => c[0]);
    expect(emails).toContain('colab-1@test.local');
    expect(emails).toContain('colab-2@test.local');
    expect(emails).not.toContain('autor-1@test.local');
  });

  it('ProductoAnadido: no notifica a usuarios inexistentes o inactivos', async () => {
    listaRepository.findById.mockResolvedValue(success({ id: 'lista-1', nombre: 'Lista' } as any));
    permisoRepository.findByListaId.mockResolvedValue([
      { usuarioId: 'colab-1' } as any,
      { usuarioId: 'inactivo' } as any
    ]);
    usuarioRepository.findById.mockImplementation((id: string) => {
      if (id === 'inactivo') {
        return Promise.resolve(success(makeUsuario({ id, email: 'in@test.local', activo: false })));
      }
      return Promise.resolve(success(makeUsuario({ id, email: `${id}@test.local` })));
    });

    await consumer.handle(makeEvent('ProductoAnadido', {
      listaId: 'lista-1', productoId: 'prod-1', nombre: 'Leche', usuarioId: 'autor-1'
    }), {} as any);

    const emails = emailService.sendListChangeNotification.mock.calls.map((c: any[]) => c[0]);
    expect(emails).toContain('colab-1@test.local');
    expect(emails).not.toContain('in@test.local');
  });

  it('ListaActualizada: notifica a colaboradores con el resumen de cambios', async () => {
    listaRepository.findById.mockResolvedValue(success({ id: 'lista-1', nombre: 'Lista' } as any));
    permisoRepository.findByListaId.mockResolvedValue([{ usuarioId: 'colab-1' } as any]);
    usuarioRepository.findById.mockImplementation((id: string) =>
      Promise.resolve(success(makeUsuario({ id, email: `${id}@test.local`, nombre: id })))
    );

    await consumer.handle(makeEvent('ListaActualizada', {
      listaId: 'lista-1', cambios: 'nombre y descripción', usuarioId: 'autor-1'
    }), {} as any);

    expect(emailService.sendListChangeNotification).toHaveBeenCalledWith(
      'colab-1@test.local',
      'colab-1',
      'Lista',
      'list_updated',
      expect.stringContaining('actualizó la lista')
    );
  });

  it('ListaActualizada: continúa si un colaborador falla (no lanza)', async () => {
    listaRepository.findById.mockResolvedValue(success({ id: 'lista-1', nombre: 'Lista' } as any));
    permisoRepository.findByListaId.mockResolvedValue([{ usuarioId: 'colab-1' } as any]);
    // El autor debe existir (el handler lo valida); el colaborador falla al buscarse
    usuarioRepository.findById.mockImplementation((id: string) =>
      id === 'autor-1'
        ? Promise.resolve(success(makeUsuario({ id, email: 'autor@test.local', nombre: id })))
        : Promise.resolve(failure(new Error('boom') as any))
    );

    await expect(consumer.handle(makeEvent('ListaActualizada', {
      listaId: 'lista-1', cambios: 'x', usuarioId: 'autor-1'
    }), {} as any)).resolves.toBeUndefined();

    expect(emailService.sendListChangeNotification).not.toHaveBeenCalled();
  });

  it('eventos desconocidos se ignoran sin error', async () => {
    await expect(consumer.handle(makeEvent('EventoRaro', {}), {} as any)).resolves.toBeUndefined();
  });

  it('falla la lista no encontrada en ProductoAnadido (rethrow para retry)', async () => {
    listaRepository.findById.mockResolvedValue(success(null));

    await expect(consumer.handle(makeEvent('ProductoAnadido', {
      listaId: 'lista-x', productoId: 'p', nombre: 'n', usuarioId: 'u'
    }), {} as any)).rejects.toThrow('Lista no encontrada');
  });
});
