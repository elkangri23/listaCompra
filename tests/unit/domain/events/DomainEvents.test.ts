/**
 * Tests unitarios para eventos de dominio (src/domain/events)
 * Cada evento: construcción, metadatos del BaseDomainEvent, getters tipados
 * y reconstrucción desde JSON.
 */

import { BaseDomainEvent } from '../../../../src/domain/events/DomainEvent';
import { ListaCreada } from '../../../../src/domain/events/ListaCreada';
import { ListaUpdatedEvent } from '../../../../src/domain/events/ListaUpdatedEvent';
import { ListaDeletedEvent } from '../../../../src/domain/events/ListaDeletedEvent';
import { ProductoAnadido } from '../../../../src/domain/events/ProductoAnadido';
import { ProductoUpdatedEvent } from '../../../../src/domain/events/ProductoUpdatedEvent';
import { ProductoDeletedEvent } from '../../../../src/domain/events/ProductoDeletedEvent';
import { InvitacionEnviada } from '../../../../src/domain/events/InvitacionEnviada';
import { UsuarioRegistrado } from '../../../../src/domain/events/UsuarioRegistrado';
import { ListaCompartida } from '../../../../src/domain/events/ListaCompartida';

const CONTEXT = { userId: 'user-1', correlationId: 'corr-1', ipAddress: '127.0.0.1' };

describe('Eventos de dominio', () => {
  describe('BaseDomainEvent', () => {
    it('asigna eventId/occurredOn/eventVersion y contexto', () => {
      class TestEvent extends BaseDomainEvent {
        constructor() {
          super('agg-1', 'Test', { a: 1 }, CONTEXT);
        }
      }
      const event = new TestEvent();

      expect(event.eventId).toBeTruthy();
      expect(event.eventVersion).toBe(1);
      expect(event.aggregateId).toBe('agg-1');
      expect(event.aggregateType).toBe('Test');
      expect(event.eventData).toEqual({ a: 1 });
      expect(event.occurredOn).toBeInstanceOf(Date);
      expect(event.eventContext?.userId).toBe('user-1');
      expect(event.eventContext?.correlationId).toBe('corr-1');
    });

    it('eventId es único entre instancias', () => {
      class TestEvent extends BaseDomainEvent {
        constructor(aggId: string) { super(aggId, 'Test', {}); }
      }
      const a = new TestEvent('a');
      const b = new TestEvent('b');

      expect(a.eventId).not.toBe(b.eventId);
    });

    it('eventContext es undefined si no se proporciona', () => {
      class TestEvent extends BaseDomainEvent {
        constructor() { super('agg', 'Test', {}); }
      }
      const event = new TestEvent();

      expect(event.eventContext).toBeUndefined();
    });
  });

  describe('ListaCreada', () => {
    it('expone datos tipados y aggregateType Lista', () => {
      const event = new ListaCreada('lista-1', {
        nombre: 'Compras semanales',
        propietarioId: 'user-1',
        fechaCreacion: new Date().toISOString()
      }, CONTEXT);

      expect(event.aggregateType).toBe('Lista');
      expect(event.aggregateId).toBe('lista-1');
      expect(event.listaData.nombre).toBe('Compras semanales');
      expect(event.listaData.propietarioId).toBe('user-1');
    });

    it('fromJSON reconstruye el evento', () => {
      const original = new ListaCreada('lista-1', {
        nombre: 'X', propietarioId: 'user-1', fechaCreacion: new Date().toISOString()
      });

      const json = {
        aggregateId: 'lista-2',
        eventId: original.eventId,
        eventType: original.eventType,
        eventVersion: original.eventVersion,
        eventData: original.eventData,
        occurredOn: original.occurredOn
      };

      const rebuilt = ListaCreada.fromJSON(json as any);
      expect(rebuilt.aggregateId).toBe('lista-2');
      expect(rebuilt.listaData.nombre).toBe('X');
    });
  });

  describe('ListaUpdatedEvent', () => {
    it('expone oldValue/newValue/changedFields', () => {
      const event = new ListaUpdatedEvent({
        listaId: 'lista-1',
        oldValue: { nombre: 'Viejo' },
        newValue: { nombre: 'Nuevo' },
        changedByUserId: 'user-1',
        changedFields: ['nombre']
      });

      expect(event.aggregateType).toBe('Lista');
      expect(event.eventData['newValue']).toEqual({ nombre: 'Nuevo' });
      expect(event.eventData['changedFields']).toEqual(['nombre']);
    });
  });

  describe('ListaDeletedEvent', () => {
    it('expone deletedValue', () => {
      const event = new ListaDeletedEvent({
        listaId: 'lista-1',
        deletedByUserId: 'user-1',
        deletedValue: { nombre: 'X' }
      });

      expect(event.aggregateId).toBe('lista-1');
      expect(event.eventData['deletedValue']).toEqual({ nombre: 'X' });
    });
  });

  describe('ProductoAnadido', () => {
    it('expone datos del producto y aggregateType Producto', () => {
      const event = new ProductoAnadido('prod-1', {
        productoId: 'prod-1',
        listaId: 'lista-1',
        nombre: 'Leche',
        cantidad: 2,
        urgente: false,
        creadoPorId: 'user-1',
        fechaCreacion: new Date().toISOString()
      }, CONTEXT);

      expect(event.aggregateType).toBe('Producto');
      expect(event.aggregateId).toBe('prod-1');
      expect(event.eventData['nombre']).toBe('Leche');
    });
  });

  describe('ProductoUpdatedEvent', () => {
    it('expone oldValue/newValue', () => {
      const event = new ProductoUpdatedEvent({
        productoId: 'prod-1',
        listaId: 'lista-1',
        oldValue: { cantidad: 1 },
        newValue: { cantidad: 3 },
        changedByUserId: 'user-1',
        changedFields: ['cantidad']
      });

      expect(event.aggregateType).toBe('Producto');
      expect(event.eventData['newValue']).toEqual({ cantidad: 3 });
    });
  });

  describe('ProductoDeletedEvent', () => {
    it('expone deletedValue', () => {
      const event = new ProductoDeletedEvent({
        productoId: 'prod-1',
        listaId: 'lista-1',
        deletedByUserId: 'user-1',
        deletedValue: { nombre: 'Leche' }
      });

      expect(event.eventData['deletedValue']).toEqual({ nombre: 'Leche' });
    });
  });

  describe('InvitacionEnviada', () => {
    it('expone datos de invitación y aggregateType Invitacion', () => {
      const event = new InvitacionEnviada('inv-1', {
        invitacionId: 'inv-1',
        listaId: 'lista-1',
        propietarioId: 'user-1',
        emailDestino: 'inv@test.local',
        hashAcceso: 'hash-123',
        tipoPermiso: 'escritura',
        nombrePropietario: 'Propietario',
        fechaExpiracion: new Date().toISOString(),
        fechaEnvio: new Date().toISOString(),
        nombreLista: 'Mi Lista'
      }, CONTEXT);

      expect(event.aggregateType).toBe('Invitacion');
      expect(event.eventData['emailDestino']).toBe('inv@test.local');
    });
  });

  describe('UsuarioRegistrado', () => {
    it('expone datos del registro y aggregateType Usuario', () => {
      const event = new UsuarioRegistrado('user-1', {
        email: 'nuevo@test.local',
        nombre: 'Nuevo',
        emailVerificado: false,
        fechaRegistro: new Date().toISOString()
      }, CONTEXT);

      expect(event.aggregateType).toBe('Usuario');
      expect(event.eventData['email']).toBe('nuevo@test.local');
    });
  });

  describe('ListaCompartida', () => {
    it('expone datos de compartición', () => {
      const event = new ListaCompartida('lista-1', {
        listaId: 'lista-1',
        propietarioId: 'user-1',
        invitacionId: 'inv-1',
        hashCompartir: 'hash-1',
        tipoPermiso: 'LECTURA',
        fechaCompartir: new Date().toISOString(),
        expiraEn: new Date(Date.now() + 86400000).toISOString(),
        nombreLista: 'Mi Lista',
        emailsInvitados: ['a@test.local']
      }, CONTEXT);

      expect(event.aggregateType).toBe('Lista');
      expect(event.eventData['tipoPermiso']).toBe('LECTURA');
      expect(event.eventData['emailsInvitados']).toEqual(['a@test.local']);
    });
  });
});
