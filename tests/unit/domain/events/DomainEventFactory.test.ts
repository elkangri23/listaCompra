/**
 * Tests unitarios para DomainEventFactory (src/domain/events/index.ts)
 * Reconstrucción de eventos desde JSON y catálogo de tipos.
 */

import { DomainEventFactory } from '../../../../src/domain/events';
import { UsuarioRegistrado } from '../../../../src/domain/events/UsuarioRegistrado';
import { ListaCreada } from '../../../../src/domain/events/ListaCreada';
import { ListaCompartida } from '../../../../src/domain/events/ListaCompartida';
import { ProductoAnadido } from '../../../../src/domain/events/ProductoAnadido';
import { InvitacionEnviada } from '../../../../src/domain/events/InvitacionEnviada';
import { ListaUpdatedEvent } from '../../../../src/domain/events/ListaUpdatedEvent';
import { ProductoUpdatedEvent } from '../../../../src/domain/events/ProductoUpdatedEvent';
import { ListaDeletedEvent } from '../../../../src/domain/events/ListaDeletedEvent';
import { ProductoDeletedEvent } from '../../../../src/domain/events/ProductoDeletedEvent';

const CONTEXT = { userId: 'user-1', correlationId: 'corr-1' };

const baseJson = (eventType: string, aggregateId: string, eventData: unknown, extra: Record<string, unknown> = {}) => ({
  eventType,
  aggregateId,
  eventData,
  eventContext: CONTEXT,
  ...extra
});

describe('DomainEventFactory', () => {
  describe('fromJSON', () => {
    it('reconstruye UsuarioRegistrado', () => {
      const event = DomainEventFactory.fromJSON(
        baseJson('UsuarioRegistrado', 'user-1', {
          email: 'a@b.com',
          nombre: 'Ana',
          apellidos: 'García',
          emailVerificado: false,
          fechaRegistro: '2025-11-30T10:00:00Z'
        })
      );
      expect(event).toBeInstanceOf(UsuarioRegistrado);
      expect(event.aggregateId).toBe('user-1');
    });

    it('reconstruye ListaCreada', () => {
      const event = DomainEventFactory.fromJSON(
        baseJson('ListaCreada', 'lista-1', {
          nombre: 'Compra semanal',
          propietarioId: 'user-1',
          fechaCreacion: '2025-11-30T10:00:00Z'
        })
      );
      expect(event).toBeInstanceOf(ListaCreada);
    });

    it('reconstruye ListaCompartida', () => {
      const event = DomainEventFactory.fromJSON(
        baseJson('ListaCompartida', 'lista-1', {
          listaId: 'lista-1',
          propietarioId: 'user-1',
          invitacionId: 'inv-1',
          hashCompartir: 'hash-1',
          tipoPermiso: 'LECTURA',
          fechaCompartir: '2025-11-30T10:00:00Z',
          expiraEn: '2025-12-07T10:00:00Z',
          nombreLista: 'Compra semanal',
          emailsInvitados: ['b@c.com']
        })
      );
      expect(event).toBeInstanceOf(ListaCompartida);
    });

    it('reconstruye ProductoAnadido', () => {
      const event = DomainEventFactory.fromJSON(
        baseJson('ProductoAnadido', 'prod-1', {
          productoId: 'prod-1',
          listaId: 'lista-1',
          nombre: 'Leche',
          cantidad: 2,
          unidad: 'litros',
          precio: 1.5,
          categoriaId: 'cat-1',
          urgente: false,
          creadoPorId: 'user-1',
          fechaCreacion: '2025-11-30T10:00:00Z'
        })
      );
      expect(event).toBeInstanceOf(ProductoAnadido);
    });

    it('reconstruye InvitacionEnviada', () => {
      const event = DomainEventFactory.fromJSON(
        baseJson('InvitacionEnviada', 'inv-1', {
          invitacionId: 'inv-1',
          listaId: 'lista-1',
          propietarioId: 'user-1',
          emailDestino: 'b@c.com',
          hashAcceso: 'hash-1',
          tipoPermiso: 'lectura',
          fechaExpiracion: '2025-12-07T10:00:00Z',
          fechaEnvio: '2025-11-30T10:00:00Z',
          nombreLista: 'Compra semanal',
          nombrePropietario: 'Ana'
        })
      );
      expect(event).toBeInstanceOf(InvitacionEnviada);
    });

    it('reconstruye lista.updated', () => {
      const payload = {
        listaId: 'lista-1',
        oldValue: { nombre: 'a' },
        newValue: { nombre: 'b' },
        changedByUserId: 'user-1',
        changedFields: ['nombre']
      };
      const event = DomainEventFactory.fromJSON({
        eventType: 'lista.updated',
        payload
      });
      expect(event).toBeInstanceOf(ListaUpdatedEvent);
    });

    it('reconstruye producto.updated', () => {
      const payload = {
        productoId: 'prod-1',
        oldValue: { cantidad: 1 },
        newValue: { cantidad: 2 },
        changedByUserId: 'user-1',
        changedFields: ['cantidad']
      };
      const event = DomainEventFactory.fromJSON({
        eventType: 'producto.updated',
        payload
      });
      expect(event).toBeInstanceOf(ProductoUpdatedEvent);
    });

    it('reconstruye lista.deleted', () => {
      const event = DomainEventFactory.fromJSON({
        eventType: 'lista.deleted',
        payload: { deletedValue: { nombre: 'a' }, deletedByUserId: 'user-1' }
      });
      expect(event).toBeInstanceOf(ListaDeletedEvent);
    });

    it('reconstruye producto.deleted', () => {
      const event = DomainEventFactory.fromJSON({
        eventType: 'producto.deleted',
        payload: { deletedValue: { nombre: 'Leche' }, deletedByUserId: 'user-1' }
      });
      expect(event).toBeInstanceOf(ProductoDeletedEvent);
    });

    it('lanza error con un tipo de evento desconocido', () => {
      expect(() =>
        DomainEventFactory.fromJSON({ eventType: 'evento.misterioso' })
      ).toThrow('Unknown event type: evento.misterioso');
    });
  });

  describe('getEventTypes', () => {
    it('expone los 9 tipos de evento registrados', () => {
      expect(DomainEventFactory.getEventTypes()).toEqual([
        'UsuarioRegistrado',
        'ListaCreada',
        'ListaCompartida',
        'ProductoAnadido',
        'InvitacionEnviada',
        'lista.updated',
        'producto.updated',
        'lista.deleted',
        'producto.deleted'
      ]);
    });
  });
});
