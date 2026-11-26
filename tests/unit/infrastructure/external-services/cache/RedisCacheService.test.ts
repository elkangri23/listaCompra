/**
 * Tests unitarios para RedisCacheService
 * Mockea 'redis' y el Logger: CRUD, patrones, TTL y estados de conexión.
 */

jest.mock('../../../../../src/infrastructure/observability/logger/Logger', () => {
  class Logger {
    info() {}
    warn() {}
    error() {}
    debug() {}
  }
  return { Logger, __esModule: true };
});

const createClientMock = {
  connect: jest.fn(),
  disconnect: jest.fn(),
  get: jest.fn(),
  set: jest.fn(),
  setEx: jest.fn(),
  del: jest.fn(),
  keys: jest.fn(),
  exists: jest.fn(),
  ttl: jest.fn(),
  ping: jest.fn(),
  quit: jest.fn(),
  on: jest.fn()
};

jest.mock('redis', () => ({
  __esModule: true,
  createClient: jest.fn(() => createClientMock)
}));

import { RedisCacheService } from '../../../../../src/infrastructure/external-services/cache/RedisCacheService';
import { createClient } from 'redis';

const makeConfig = (overrides: any = {}) => ({
  host: 'localhost',
  port: 6379,
  database: 0,
  connectTimeout: 5000,
  retryDelayOnFailover: 500,
  keyPrefix: 'test:',
  ...overrides
});

const redisHandlers = new Map<string, Function>();

function flushRedisEvents() {
  // los listeners registrados en client.on capturan handlers por evento
  redisHandlers.clear();
  createClientMock.on.mockImplementation((event: string, fn: Function) => {
    redisHandlers.set(event, fn);
  });
}

function redisEvent(event: string): Function | undefined {
  return redisHandlers.get(event);
}

async function initializeConnected(svc: RedisCacheService): Promise<void> {
  await svc.initialize();
  redisEvent('ready')?.();
}

describe('RedisCacheService', () => {
  let service: RedisCacheService;

  beforeEach(() => {
    jest.clearAllMocks();
    // resetMocks:true borra la implementación de la factory del módulo:
    // hay que reaplicarla en cada test
    (createClient as jest.Mock).mockImplementation(() => createClientMock);
    // cliente "conectado" listo
    createClientMock.connect.mockResolvedValue(undefined);
    flushRedisEvents();
    service = new RedisCacheService(makeConfig());
  });

  describe('initialize', () => {
    it('conecta y marca el servicio disponible', async () => {
      await initializeConnected(service);

      expect(createClientMock.connect).toHaveBeenCalled();
      expect(service.getClient()).toBeTruthy();
    });

    it('incluye password solo si está definida', async () => {
      await initializeConnected(service);
      expect((createClient as jest.Mock).mock.calls[0][0].password).toBeUndefined();

      const svc2 = new RedisCacheService(makeConfig({ password: 'secret' }));
      await svc2.initialize();
      expect((createClient as jest.Mock).mock.calls[1][0].password).toBe('secret');
    });

    it('getClient() devuelve null si no inicializado', () => {
      expect(service.getClient()).toBeNull();
    });
  });

  describe('get', () => {
    it('devuelve null si no está conectado', async () => {
      expect(await service.get('k')).toBeNull();
    });

    it('devuelve null en cache miss', async () => {
      await initializeConnected(service);
      createClientMock.get.mockResolvedValue(null);
      expect(await service.get('missing')).toBeNull();
      expect(createClientMock.get).toHaveBeenCalledWith('test:missing');
    });

    it('devuelve el valor parseado en cache hit', async () => {
      await initializeConnected(service);
      createClientMock.get.mockResolvedValue(JSON.stringify({ a: 1 }));
      expect(await service.get('k')).toEqual({ a: 1 });
    });

    it('devuelve null si el JSON está corrupto', async () => {
      await initializeConnected(service);
      createClientMock.get.mockResolvedValue('{no-json');
      expect(await service.get('k')).toBeNull();
    });
  });

  describe('set', () => {
    it('con ttl usa setEx', async () => {
      await initializeConnected(service);
      await service.set('k', { a: 1 }, 60);
      expect(createClientMock.setEx).toHaveBeenCalledWith('test:k', 60, JSON.stringify({ a: 1 }));
    });

    it('sin ttl usa set', async () => {
      await initializeConnected(service);
      await service.set('k', 'v');
      expect(createClientMock.set).toHaveBeenCalledWith('test:k', JSON.stringify('v'));
    });

    it('sin conexión no hace nada', async () => {
      await service.set('k', 'v');
      expect(createClientMock.set).not.toHaveBeenCalled();
    });

    it('error de Redis no lanza', async () => {
      await initializeConnected(service);
      createClientMock.set.mockRejectedValue(new Error('redis down'));
      await expect(service.set('k', 'v')).resolves.toBeUndefined();
    });
  });

  describe('delete / deletePattern', () => {
    it('delete usa del con prefijo', async () => {
      await initializeConnected(service);
      await service.delete('k');
      expect(createClientMock.del).toHaveBeenCalledWith('test:k');
    });

    it('deletePattern borra las claves encontradas', async () => {
      await initializeConnected(service);
      createClientMock.keys.mockResolvedValue(['test:a', 'test:b']);
      createClientMock.del.mockResolvedValue(2);
      expect(await service.deletePattern('test:*')).toBe(2);
      expect(createClientMock.keys).toHaveBeenCalledWith('test:test:*');
      expect(createClientMock.del).toHaveBeenCalledWith(['test:a', 'test:b']);
    });

    it('deletePattern sin claves devuelve 0', async () => {
      await initializeConnected(service);
      createClientMock.keys.mockResolvedValue([]);
      expect(await service.deletePattern('x')).toBe(0);
    });

    it('deletePattern con error devuelve 0', async () => {
      await initializeConnected(service);
      createClientMock.keys.mockRejectedValue(new Error('x'));
      expect(await service.deletePattern('x')).toBe(0);
    });
  });

  describe('exists / ttl / isAvailable', () => {
    it('exists true/false', async () => {
      await initializeConnected(service);
      createClientMock.exists.mockResolvedValue(1);
      expect(await service.exists('k')).toBe(true);
      createClientMock.exists.mockResolvedValue(0);
      expect(await service.exists('k')).toBe(false);
    });

    it('ttl devuelve el valor del cliente', async () => {
      await initializeConnected(service);
      createClientMock.ttl.mockResolvedValue(120);
      expect(await service.ttl('k')).toBe(120);
    });

    it('isAvailable hace ping', async () => {
      await initializeConnected(service);
      createClientMock.ping.mockResolvedValue('PONG');
      expect(await service.isAvailable()).toBe(true);
      createClientMock.ping.mockRejectedValue(new Error('x'));
      expect(await service.isAvailable()).toBe(false);
    });

    it('sin conexión exists=false, ttl=-1, isAvailable=false', async () => {
      expect(await service.exists('k')).toBe(false);
      expect(await service.ttl('k')).toBe(-1);
      expect(await service.isAvailable()).toBe(false);
    });
  });

  describe('eventos de conexión', () => {
    it('error marca desconectado y getClient devuelve null', async () => {
      await initializeConnected(service);
      redisEvent('error')?.(new Error('redis down'));
      expect(service.getClient()).toBeNull();
      expect(await service.get('k')).toBeNull();
    });

    it('end marca desconectado', async () => {
      await initializeConnected(service);
      redisEvent('end')?.();
      expect(service.getClient()).toBeNull();
    });
  });

  describe('disconnect', () => {
    it('cierra la conexión con quit', async () => {
      await initializeConnected(service);
      await service.disconnect();
      expect(createClientMock.quit).toHaveBeenCalled();
      expect(service.getClient()).toBeNull();
    });

    it('sin cliente no lanza', async () => {
      await expect(service.disconnect()).resolves.toBeUndefined();
    });
  });
});
