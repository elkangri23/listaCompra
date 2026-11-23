/**
 * Tests unitarios para PrismaOutboxService (implementación real del patrón Outbox)
 * PrismaClient se mockea: se verifica el mapeo de datos y las consultas,
 * no la conexión a BD (los tests de integración requieren PostgreSQL).
 */

import { PrismaOutboxService } from '../../../../../src/infrastructure/messaging/outbox/PrismaOutboxService';
import { BaseDomainEvent } from '../../../../../src/domain/events/DomainEvent';
import type { Result } from '../../../../../src/shared/result';

const unwrap = <T>(result: Result<T, Error>): T => {
  if (!result.isSuccess) {
    throw new Error('Se esperaba success: ' + String(result.error));
  }
  return result.value;
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn()
}));

class TestDomainEvent extends BaseDomainEvent {
  constructor() {
    super('lista-123', 'Lista', { nombre: 'Lista Test' }, { userId: 'user-1' });
  }
}

const makeRecord = (overrides: Record<string, any> = {}) => ({
  id: 'row-1',
  eventId: 'evt-1',
  eventType: 'TestDomainEvent',
  eventVersion: 1,
  aggregateId: 'lista-123',
  aggregateType: 'Lista',
  eventData: { nombre: 'Lista Test' },
  eventContext: { userId: 'user-1' },
  occurredOn: new Date('2025-01-01T00:00:00Z'),
  processed: false,
  processedAt: null,
  attempts: 0,
  lastAttemptAt: null,
  lastError: null,
  createdAt: new Date('2025-01-01T00:00:00Z'),
  updatedAt: new Date('2025-01-01T00:00:00Z'),
  ...overrides
});

describe('PrismaOutboxService', () => {
  let service: PrismaOutboxService;
  let mockPrisma: any;
  let event: TestDomainEvent;

  beforeEach(() => {
    mockPrisma = {
      outboxEvent: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        deleteMany: jest.fn(),
        count: jest.fn(),
        groupBy: jest.fn()
      },
      $transaction: jest.fn()
    };
    service = new PrismaOutboxService(mockPrisma);
    event = new TestDomainEvent();
  });

  describe('saveEvent', () => {
    it('persiste el evento con todos los campos y devuelve el OutboxEvent', async () => {
      mockPrisma.outboxEvent.create.mockResolvedValue(makeRecord());

      const result = await service.saveEvent(event);

      expect(result.isSuccess).toBe(true);
      expect(unwrap(result)?.eventId).toBe('evt-1');
      expect(unwrap(result).eventType).toBe('TestDomainEvent');
      expect(unwrap(result).processed).toBe(false);
      expect(unwrap(result).attempts).toBe(0);
      expect(unwrap(result).eventContext).toEqual({ userId: 'user-1' });

      expect(mockPrisma.outboxEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventId: event.eventId,
          eventType: event.eventType,
          eventVersion: event.eventVersion,
          aggregateId: 'lista-123',
          aggregateType: 'Lista',
          eventData: { nombre: 'Lista Test' },
          eventContext: { userId: 'user-1' }
        })
      });
    });

    it('devuelve failure si el INSERT falla', async () => {
      mockPrisma.outboxEvent.create.mockRejectedValue(new Error('DB down'));

      const result = await service.saveEvent(event);

      expect(result.isFailure).toBe(true);
    });
  });

  describe('saveEvents', () => {
    it('guarda múltiples eventos en una transacción', async () => {
      const record = makeRecord();
      mockPrisma.outboxEvent.create.mockResolvedValue(record);
      mockPrisma.$transaction.mockResolvedValue([record, record]);

      const result = await service.saveEvents([event, event]);

      expect(result.isSuccess).toBe(true);
      expect(unwrap(result).length).toBe(2);
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('getPendingEvents', () => {
    it('filtra SIEMPRE por processed=false y pagina', async () => {
      mockPrisma.outboxEvent.findMany.mockResolvedValue([makeRecord()]);
      mockPrisma.outboxEvent.count.mockResolvedValue(1);

      const result = await service.getPendingEvents(undefined, { page: 1, limit: 50 });

      expect(result.isSuccess).toBe(true);
      expect(unwrap(result).items.length).toBe(1);
      expect(unwrap(result).totalPages).toBe(1);
      expect(mockPrisma.outboxEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { processed: false },
          skip: 0,
          take: 50,
          orderBy: { createdAt: 'asc' }
        })
      );
    });

    it('aplica filtros adicionales (eventType, maxAttempts)', async () => {
      mockPrisma.outboxEvent.findMany.mockResolvedValue([]);
      mockPrisma.outboxEvent.count.mockResolvedValue(0);

      await service.getPendingEvents(
        { eventType: 'ListaUpdatedEvent', maxAttempts: 3 },
        { page: 2, limit: 10 }
      );

      expect(mockPrisma.outboxEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            eventType: 'ListaUpdatedEvent',
            attempts: { lte: 3 },
            processed: false
          },
          skip: 10,
          take: 10
        })
      );
    });
  });

  describe('markAsProcessed', () => {
    it('marca por eventId con processed=true y processedAt', async () => {
      mockPrisma.outboxEvent.update.mockResolvedValue(makeRecord({ processed: true }));

      const result = await service.markAsProcessed('evt-1');

      expect(result.isSuccess).toBe(true);
      expect(mockPrisma.outboxEvent.update).toHaveBeenCalledWith({
        where: { eventId: 'evt-1' },
        data: expect.objectContaining({ processed: true, processedAt: expect.any(Date), lastError: null })
      });
    });
  });

  describe('markManyAsProcessed', () => {
    it('usa updateMany con la lista de eventIds', async () => {
      mockPrisma.outboxEvent.updateMany.mockResolvedValue({ count: 2 });

      const result = await service.markManyAsProcessed(['evt-1', 'evt-2']);

      expect(result.isSuccess).toBe(true);
      expect(mockPrisma.outboxEvent.updateMany).toHaveBeenCalledWith({
        where: { eventId: { in: ['evt-1', 'evt-2'] } },
        data: expect.objectContaining({ processed: true })
      });
    });

    it('no consulta BD con lista vacía', async () => {
      const result = await service.markManyAsProcessed([]);
      expect(result.isSuccess).toBe(true);
      expect(mockPrisma.outboxEvent.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('incrementAttempts', () => {
    it('incrementa attempts, registra lastAttemptAt y lastError', async () => {
      mockPrisma.outboxEvent.update.mockResolvedValue(makeRecord({ attempts: 1 }));

      const result = await service.incrementAttempts('evt-1', 'RabbitMQ down');

      expect(result.isSuccess).toBe(true);
      expect(mockPrisma.outboxEvent.update).toHaveBeenCalledWith({
        where: { eventId: 'evt-1' },
        data: expect.objectContaining({
          attempts: { increment: 1 },
          lastAttemptAt: expect.any(Date),
          lastError: 'RabbitMQ down'
        })
      });
    });
  });

  describe('getEventById', () => {
    it('devuelve el evento por eventId', async () => {
      mockPrisma.outboxEvent.findUnique.mockResolvedValue(makeRecord());

      const result = await service.getEventById('evt-1');

      expect(result.isSuccess).toBe(true);
      expect(unwrap(result)?.eventId).toBe('evt-1');
    });

    it('devuelve null si no existe', async () => {
      mockPrisma.outboxEvent.findUnique.mockResolvedValue(null);

      const result = await service.getEventById('no-existe');

      expect(result.isSuccess).toBe(true);
      expect(unwrap(result)).toBeNull();
    });
  });

  describe('getEvents', () => {
    it('respeta los filtros sin forzar processed=false', async () => {
      mockPrisma.outboxEvent.findMany.mockResolvedValue([]);
      mockPrisma.outboxEvent.count.mockResolvedValue(0);

      await service.getEvents({ processed: true });

      expect(mockPrisma.outboxEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { processed: true } })
      );
    });
  });

  describe('cleanupProcessedEvents', () => {
    it('borra solo eventos procesados anteriores a la fecha indicada', async () => {
      mockPrisma.outboxEvent.deleteMany.mockResolvedValue({ count: 7 });

      const cutoff = new Date('2025-06-01T00:00:00Z');
      const result = await service.cleanupProcessedEvents(cutoff);

      expect(result.isSuccess).toBe(true);
      expect(unwrap(result)).toBe(7);
      expect(mockPrisma.outboxEvent.deleteMany).toHaveBeenCalledWith({
        where: { processed: true, processedAt: { lt: cutoff } }
      });
    });
  });

  describe('getStats', () => {
    it('calcula totales, pendientes y distribución por tipo', async () => {
      mockPrisma.outboxEvent.count
        .mockResolvedValueOnce(10)   // total
        .mockResolvedValueOnce(8)    // processed
        .mockResolvedValueOnce(2);   // failed (pending con attempts >= 1)
      mockPrisma.outboxEvent.groupBy.mockResolvedValue([
        { eventType: 'ListaUpdatedEvent', _count: { eventType: 6 } },
        { eventType: 'ProductoAnadidoEvent', _count: { eventType: 4 } }
      ]);
      mockPrisma.outboxEvent.findFirst.mockResolvedValue({ createdAt: new Date('2025-01-01') });

      const result = await service.getStats();

      expect(result.isSuccess).toBe(true);
      expect(unwrap(result).totalEvents).toBe(10);
      expect(unwrap(result).processedEvents).toBe(8);
      expect(unwrap(result).pendingEvents).toBe(2);
      expect(unwrap(result).failedEvents).toBe(2);
      expect(unwrap(result).eventTypeDistribution).toEqual({
        ListaUpdatedEvent: 6,
        ProductoAnadidoEvent: 4
      });
      expect(unwrap(result).oldestPendingEvent).toBeDefined();
    });
  });

  describe('resetFailedEvents', () => {
    it('resetea attempts de eventos no procesados con demasiados intentos', async () => {
      mockPrisma.outboxEvent.updateMany.mockResolvedValue({ count: 3 });

      const result = await service.resetFailedEvents(3);

      expect(result.isSuccess).toBe(true);
      expect(unwrap(result)).toBe(3);
      expect(mockPrisma.outboxEvent.updateMany).toHaveBeenCalledWith({
        where: { processed: false, attempts: { gte: 3 } },
        data: { attempts: 0, lastError: null }
      });
    });
  });

  describe('healthCheck', () => {
    it('healthy con 0 pendientes', async () => {
      mockPrisma.outboxEvent.count.mockResolvedValue(0);

      const result = await service.healthCheck();

      expect(unwrap(result).status).toBe('healthy');
      expect(unwrap(result).pendingCount).toBe(0);
    });

    it('healthy con pendientes recientes (<5 min)', async () => {
      mockPrisma.outboxEvent.count.mockResolvedValue(3);
      mockPrisma.outboxEvent.findFirst.mockResolvedValue({ createdAt: new Date() });

      const result = await service.healthCheck();

      expect(unwrap(result).status).toBe('healthy');
    });

    it('warning con pendientes antiguos (>5 min)', async () => {
      mockPrisma.outboxEvent.count.mockResolvedValue(3);
      mockPrisma.outboxEvent.findFirst.mockResolvedValue({
        createdAt: new Date(Date.now() - 10 * 60 * 1000) // 10 minutos atrás
      });

      const result = await service.healthCheck();

      expect(unwrap(result).status).toBe('warning');
      expect(unwrap(result).oldestPending).toBeDefined();
    });

    it('failure si la BD no responde', async () => {
      mockPrisma.outboxEvent.count.mockRejectedValue(new Error('DB down'));

      const result = await service.healthCheck();

      expect(result.isFailure).toBe(true);
    });
  });

  describe('mapeo de campos opcionales', () => {
    it('no incluye lastError/lastAttemptAt/processedAt si son null en BD', async () => {
      mockPrisma.outboxEvent.findUnique.mockResolvedValue(makeRecord());

      const result = await service.getEventById('evt-1');

      const outboxEvent = result.isSuccess ? result.value : null;
      expect(outboxEvent).not.toBeNull();
      expect('lastError' in outboxEvent!).toBe(false);
      expect('lastAttemptAt' in outboxEvent!).toBe(false);
      expect('processedAt' in outboxEvent!).toBe(false);
    });
  });
});
