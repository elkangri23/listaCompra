/**
 * Tests unitarios para InMemoryOutboxService (doble de testing del patrón Outbox)
 * Ciclo completo: guardar -> pendiente -> fallo/incremento -> procesado -> stats/limpieza
 */

import { InMemoryOutboxService } from '../../../../../src/infrastructure/messaging/outbox/InMemoryOutboxService';
import { BaseDomainEvent } from '../../../../../src/domain/events/DomainEvent';
import { ListaCreada } from '../../../../../src/domain/events/ListaCreada';
import type { Result } from '../../../../../src/shared/result';

const unwrap = <T>(r: Result<T, Error>): T | undefined => (r.isSuccess ? (r as { value: T }).value : undefined);

class FakeEvent extends BaseDomainEvent {
  constructor() { super('agg-1', 'FakeEvent', { foo: 'bar' }); }
}

describe('InMemoryOutboxService', () => {
  let service: InMemoryOutboxService;

  beforeEach(() => { service = new InMemoryOutboxService(); });

  describe('saveEvent / saveEvents', () => {
    it('guarda un evento como pendiente con attempts 0', async () => {
      const result = await service.saveEvent(new FakeEvent());

      expect(result.isSuccess).toBe(true);
      const saved = unwrap(result);
      expect(saved?.eventType).toBe('FakeEvent');
      expect(saved?.processed).toBe(false);
      expect(saved?.attempts).toBe(0);
    });

    it('getEventById devuelve el evento guardado', async () => {
      const saved = unwrap(await service.saveEvent(new FakeEvent()));

      const found = unwrap(await service.getEventById(saved!.id));
      expect(found).toMatchObject({ id: saved!.id, eventType: 'FakeEvent' });
    });

    it('getEventById devuelve null para id inexistente', async () => {
      const found = unwrap(await service.getEventById('no-existe'));
      expect(found).toBeNull();
    });

    it('saveEvents guarda varios eventos en orden', async () => {
      const result = await service.saveEvents([new FakeEvent(), new FakeEvent(), new FakeEvent()]);

      expect(unwrap(result)).toHaveLength(3);
      const pending = unwrap(await service.getPendingEvents());
      expect(pending?.items).toHaveLength(3);
    });
  });

  describe('getPendingEvents / getEvents', () => {
    it('solo devuelve eventos no procesados', async () => {
      const a = unwrap(await service.saveEvent(new FakeEvent()));
      await service.saveEvent(new FakeEvent());
      await service.markAsProcessed(a!.id);

      const pending = unwrap(await service.getPendingEvents());
      expect(pending?.items).toHaveLength(1);
      expect(pending?.total).toBe(1);

      const all = unwrap(await service.getEvents());
      expect(all?.total).toBe(2);
    });
  });

  describe('markAsProcessed / markManyAsProcessed', () => {
    it('marca el evento como procesado con fecha', async () => {
      const saved = unwrap(await service.saveEvent(new FakeEvent()));
      const when = new Date();

      await service.markAsProcessed(saved!.id, when);

      const found = unwrap(await service.getEventById(saved!.id));
      expect(found?.processed).toBe(true);
      expect(found?.processedAt).toBe(when);
    });

    it('no falla con id inexistente', async () => {
      const result = await service.markAsProcessed('no-existe');
      expect(result.isSuccess).toBe(true);
    });

    it('markManyAsProcessed procesa varios a la vez', async () => {
      const a = unwrap(await service.saveEvent(new FakeEvent()));
      const b = unwrap(await service.saveEvent(new FakeEvent()));

      await service.markManyAsProcessed([a!.id, b!.id]);

      const pending = unwrap(await service.getPendingEvents());
      expect(pending?.items).toHaveLength(0);
    });
  });

  describe('incrementAttempts', () => {
    it('incrementa intentos y guarda el último error', async () => {
      const saved = unwrap(await service.saveEvent(new FakeEvent()));

      await service.incrementAttempts(saved!.id, 'RabbitMQ caído');
      await service.incrementAttempts(saved!.id, 'RabbitMQ caído 2');

      const found = unwrap(await service.getEventById(saved!.id));
      expect(found?.attempts).toBe(2);
      expect(found?.lastError).toBe('RabbitMQ caído 2');
      expect(found?.lastAttemptAt).toBeInstanceOf(Date);
    });

    it('no falla con id inexistente', async () => {
      const result = await service.incrementAttempts('no-existe');
      expect(result.isSuccess).toBe(true);
    });
  });

  describe('getStats', () => {
    it('distribuye total/procesados/pendientes/fallidos', async () => {
      const a = unwrap(await service.saveEvent(new ListaCreada('l1', {
        nombre: 'X', propietarioId: 'u1', fechaCreacion: new Date().toISOString()
      })));
      await service.saveEvent(new FakeEvent());
      await service.saveEvent(new FakeEvent());

      await service.markAsProcessed(a!.id);

      const fakePendingId = unwrap(await service.getPendingEvents())?.items[0]?.id;
      await service.incrementAttempts(fakePendingId!, 'boom'); // falla un FakeEvent pendiente
      const stats = unwrap(await service.getStats());

      expect(stats?.totalEvents).toBe(3);
      expect(stats?.processedEvents).toBe(1);
      expect(stats?.pendingEvents).toBe(2);
      expect(stats?.eventTypeDistribution['FakeEvent']).toBe(2);
      expect(stats?.failedEvents).toBe(1);
      expect(fakePendingId).toBeTruthy();
    });
  });

  describe('cleanupProcessedEvents', () => {
    it('elimina solo los procesados', async () => {
      const a = unwrap(await service.saveEvent(new FakeEvent()));
      await service.saveEvent(new FakeEvent());
      await service.markAsProcessed(a!.id);

      const removed = await service.cleanupProcessedEvents();

      expect(unwrap(removed)).toBe(1);
      expect(unwrap(await service.getEvents())?.total).toBe(1);
    });

    it('con olderThan respeta la fecha de procesado', async () => {
      const a = unwrap(await service.saveEvent(new FakeEvent()));
      await service.markAsProcessed(a!.id, new Date());

      const removed = await service.cleanupProcessedEvents(new Date(Date.now() + 86400000));

      expect(unwrap(removed)).toBe(1);
      expect(unwrap(await service.getEvents())?.total).toBe(0);
    });
  });

  describe('healthCheck', () => {
    it('saludable sin eventos', async () => {
      const health = unwrap(await service.healthCheck());

      expect(health?.status).toBe('healthy');
    });

    it('pendientes recientes no degradan la salud', async () => {
      await service.saveEvent(new FakeEvent());

      const health = unwrap(await service.healthCheck());
      expect(health?.pendingCount).toBe(1);
      expect(health?.status).not.toBe('error');
    });
  });

  describe('resetFailedEvents', () => {
    it('devuelve 0 (no-op en la implementación in-memory)', async () => {
      const result = await service.resetFailedEvents(3);
      expect(unwrap(result)).toBe(0);
    });
  });
});
