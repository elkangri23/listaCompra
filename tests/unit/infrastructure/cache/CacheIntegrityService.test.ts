/**
 * Tests unitarios para CacheIntegrityService
 * Mockea el cliente Redis (pipeline), el Logger y el SecurityAuditService:
 * almacenamiento con checksum, recuperación, validación, escaneo y limpieza.
 */

import type { IntegrityCheckResult } from '../../../../src/infrastructure/cache/CacheIntegrityService';
import { CacheIntegrityService } from '../../../../src/infrastructure/cache/CacheIntegrityService';

const makePipeline = (stored: Record<string, string> = {}) => {
  const commands: Array<{ op: string; args: any[] }> = [];
  const pipeline: any = {
    setex: (...args: any[]) => { commands.push({ op: 'setex', args }); return pipeline; },
    get: (key: string) => {
      commands.push({ op: 'get', args: [key] });
      return pipeline;
    },
    del: (key: string) => { commands.push({ op: 'del', args: [key] }); return pipeline; },
    exec: jest.fn().mockImplementation(async () =>
      commands
        .filter(c => c.op === 'get')
        .map(c => [null, stored[c.args[0]] ?? null])
    )
  };
  (pipeline as any).commands = commands;
  return { pipeline, commands };
};

function makeRedis(stored: Record<string, string> = {}, keys: string[] = []) {
  return {
    // cada llamada a pipeline() crea un pipeline fresco (como Redis real)
    pipeline: jest.fn(() => makePipeline(stored).pipeline),
    get: jest.fn(async (k: string) => stored[k] ?? null),
    keys: jest.fn().mockResolvedValue(keys),
    setex: jest.fn(),
    del: jest.fn()
  };
}

const makeService = () =>
  new CacheIntegrityService(
    { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } as any,
    { logSecurityViolation: jest.fn().mockResolvedValue(undefined) } as any
  );

describe('CacheIntegrityService', () => {
  let service: CacheIntegrityService;
  let audit: { logSecurityViolation: jest.Mock };

  beforeEach(() => {
    service = makeService();
    audit = (service as any).auditService;
  });

  describe('storeWithIntegrity', () => {
    it('almacena datos + checksum + metadata con pipeline', async () => {
      const redis = makeRedis();
      const result = await service.storeWithIntegrity(redis, 'ia:sug:1', { producto: 'Leche' }, 'ai_suggestion', 600);

      expect(result.isSuccess).toBe(true);
      expect(redis.pipeline).toHaveBeenCalled();
      // 3 comandos: datos, checksum, metadata
      const cmds = (redis.pipeline.mock.results[0]!.value as any).commands;
      expect(cmds).toHaveLength(3);
      expect(cmds[0].args[0]).toBe('ia:sug:1');
      expect(cmds[1].args[0]).toBe('integrity:checksum:ia:sug:1');
      expect(cmds[2].args[0]).toBe('integrity:meta:ia:sug:1');
      expect(cmds[0].args[1]).toBe(600); // ttl
    });

    it('usa el maxAge por defecto del tipo si no hay ttl', async () => {
      const redis = makeRedis();
      await service.storeWithIntegrity(redis, 'k', { a: 1 }, 'user_session');
      const cmds = (redis.pipeline.mock.results[0]!.value as any).commands;
      expect(cmds[0].args[1]).toBe(1800); // maxAge user_session
    });

    it('category_cache (validateOnRead=false) también usa pipeline al escribir con md5', async () => {
      const redis = makeRedis();
      const result = await service.storeWithIntegrity(redis, 'cat:1', [{ id: 'c1' }], 'category_cache', 300);

      expect(result.isSuccess).toBe(true);
      expect(redis.pipeline).toHaveBeenCalled();
      const cmds = (redis.pipeline.mock.results[0]!.value as any).commands;
      expect(cmds).toHaveLength(3);
    });

    it('fallo de Redis devuelve failure y registra violación de seguridad', async () => {
      const redis = makeRedis();
      redis.pipeline.mockImplementation(() => {
        throw new Error('redis down');
      });

      const result = await service.storeWithIntegrity(redis, 'k', { a: 1 }, 'ai_suggestion');
      expect(result.isFailure).toBe(true);
      expect(audit.logSecurityViolation).toHaveBeenCalledWith(
        'cache_integrity_store_failure',
        expect.objectContaining({ key: 'k', error_type: 'storage_failure' })
      );
    });
  });

  describe('retrieveWithIntegrity', () => {
    const data = { producto: 'Pan' };
    const checksum = require('crypto').createHash('sha256').update(JSON.stringify(data), 'utf8').digest('hex');
    const metadata = JSON.stringify({
      dataType: 'ai_suggestion',
      checksum,
      algorithm: 'sha256',
      timestamp: new Date().toISOString(),
      version: '1.0'
    });

    it('key inexistente devuelve failure Key not found', async () => {
      const redis = makeRedis();
      const result = await service.retrieveWithIntegrity(redis, 'missing', 'ai_suggestion');
      expect(result.isFailure).toBe(true);
      expect((result as { error: Error }).error.message).toContain('not found');
    });

    it('datos intactos devuelven success', async () => {
      const redis = makeRedis({
        'k': JSON.stringify(data),
        'integrity:checksum:k': checksum,
        'integrity:meta:k': metadata
      });
      const result = await service.retrieveWithIntegrity(redis, 'k', 'ai_suggestion');
      expect(result.isSuccess).toBe(true);
      expect((result as { value: any }).value).toEqual(data);
    });

    it('datos corrompidos en dato no crítico → success + violación registrada', async () => {
      const redis = makeRedis({
        'k': JSON.stringify({ producto: 'Pan MODIFICADO' }), // datos manipulados
        'integrity:checksum:k': checksum,
        'integrity:meta:k': metadata
      });
      const result = await service.retrieveWithIntegrity(redis, 'k', 'ai_suggestion');

      expect(result.isSuccess).toBe(true); // no crítico, se permite con log
      expect(audit.logSecurityViolation).toHaveBeenCalledWith(
        'cache_integrity_corruption_detected',
        expect.objectContaining({ corruption_level: 'SEVERE' })
      );
    });

    it('datos corrompidos en dato crítico (user_session) → failure', async () => {
      const checksumSha512 = require('crypto').createHash('sha512').update(JSON.stringify(data), 'utf8').digest('hex');
      const metaSha512 = JSON.stringify({
        dataType: 'user_session', checksum: checksumSha512, algorithm: 'sha512',
        timestamp: new Date().toISOString(), version: '1.0'
      });
      const redis = makeRedis({
        'session:1': JSON.stringify({ user: 'otro' }),
        'integrity:checksum:session:1': checksumSha512,
        'integrity:meta:session:1': metaSha512
      });

      const result = await service.retrieveWithIntegrity(redis, 'session:1', 'user_session');
      expect(result.isFailure).toBe(true);
      expect((result as { error: Error }).error.message).toContain('integrity');
    });

    it('sin checksum/metadata → success pero registra missing_metadata', async () => {
      const redis = makeRedis({ 'k': JSON.stringify(data) });
      const result = await service.retrieveWithIntegrity(redis, 'k', 'ai_suggestion');
      expect(result.isSuccess).toBe(true);
      expect(audit.logSecurityViolation).toHaveBeenCalledWith(
        'cache_integrity_missing_metadata',
        expect.objectContaining({ key: 'k' })
      );
    });

    it('tipo con validateOnRead=false (category_cache) devuelve sin validar', async () => {
      const redis = makeRedis({
        'cat:1': JSON.stringify([{ id: 'c1' }]),
        'integrity:checksum:cat:1': 'checksum-que-no-coincide',
        'integrity:meta:cat:1': metadata
      });
      const result = await service.retrieveWithIntegrity(redis, 'cat:1', 'category_cache');
      expect(result.isSuccess).toBe(true);
      expect(audit.logSecurityViolation).not.toHaveBeenCalled();
    });

    it('JSON corrupto en datos devuelve failure', async () => {
      const redis = makeRedis({
        'k': '{json roto',
        'integrity:checksum:k': checksum,
        'integrity:meta:k': metadata
      });
      const result = await service.retrieveWithIntegrity(redis, 'k', 'ai_suggestion');
      expect(result.isFailure).toBe(true);
    });
  });

  describe('validateIntegrity', () => {
    it('tipo desconocido → CRITICAL "Unknown data type"', async () => {
      const r = await service.validateIntegrity({}, 'sum', null, 'k', 'tipo_raro' as any);
      expect(r.isValid).toBe(false);
      expect(r.corruptionLevel).toBe('CRITICAL');
      expect(r.details).toContain('Unknown data type');
    });

    it('checksum coincidente → NONE', async () => {
      const data = { a: 1 };
      const sum = require('crypto').createHash('sha256').update(JSON.stringify(data), 'utf8').digest('hex');
      const r = await service.validateIntegrity(data, sum, { timestamp: new Date().toISOString() }, 'k', 'ai_suggestion');
      expect(r.isValid).toBe(true);
      expect(r.corruptionLevel).toBe('NONE');
      expect(r.storedChecksum).toBe(sum);
      expect(r.calculatedChecksum).toBe(sum);
    });

    it('mismatch en tipo no crítico reciente → SEVERE', async () => {
      const r = await service.validateIntegrity(
        { a: 2 }, 'sum-antigua', { timestamp: new Date().toISOString() }, 'k', 'ai_suggestion'
      );
      expect(r.isValid).toBe(false);
      expect(r.corruptionLevel).toBe('SEVERE');
      expect(r.details).toContain('Checksum mismatch');
    });

    it('mismatch en tipo no crítico expirado → MINOR', async () => {
      const viejo = new Date(Date.now() - 2 * 3600 * 1000).toISOString(); // 2h > maxAge 1h
      const r = await service.validateIntegrity({ a: 2 }, 'sum', { timestamp: viejo }, 'k', 'ai_suggestion');
      expect(r.corruptionLevel).toBe('MINOR');
    });

    it('mismatch en tipo crítico → CRITICAL', async () => {
      const r = await service.validateIntegrity(
        { u: 2 }, 'sum', { timestamp: new Date().toISOString() }, 'k', 'blueprint_metadata'
      );
      expect(r.corruptionLevel).toBe('CRITICAL');
    });

    it('sin timestamp en metadata → SEVERE', async () => {
      const r = await service.validateIntegrity({ a: 2 }, 'sum', null, 'k', 'ai_suggestion');
      expect(r.corruptionLevel).toBe('SEVERE');
    });
  });

  describe('scanIntegrity', () => {
    it('escanea claves, salta metadata y resume', async () => {
      const data = { p: 'x' };
      const sum = require('crypto').createHash('sha256').update(JSON.stringify(data), 'utf8').digest('hex');
      const redis = makeRedis(
        {
          'k1': JSON.stringify(data),
          'integrity:checksum:k1': sum,
          'integrity:meta:k1': JSON.stringify({ dataType: 'ai_suggestion', checksum: sum, algorithm: 'sha256', timestamp: new Date().toISOString(), version: '1.0' }),
          'k2': '{json-corrupto' // parse error -> failure -> SEVERE
        },
        ['k1', 'integrity:checksum:k1', 'integrity:meta:k1', 'k2']
      );

      const results = await service.scanIntegrity(redis, '*', 'ai_suggestion');
      expect(results).toHaveLength(2); // k1 + k2 (claves de metadata saltadas)
      expect(results.filter(r => r.isValid)).toHaveLength(1);
      expect(results.find(r => !r.isValid)?.key).toBe('k2');
      expect(results.find(r => !r.isValid)?.corruptionLevel).toBe('SEVERE');
    });

    it('errores de Redis no lanzan, devuelven lo acumulado', async () => {
      const redis = makeRedis();
      redis.keys.mockRejectedValue(new Error('db'));
      const results = await service.scanIntegrity(redis);
      expect(results).toEqual([]);
    });
  });

  describe('cleanupCorruptedData', () => {
    it('elimina solo CRITICAL y sus derivados, y audita', async () => {
      const redis = makeRedis();
      const results: IntegrityCheckResult[] = [
        { isValid: false, dataType: 'ai_suggestion', key: 'k1', timestamp: new Date(), corruptionLevel: 'CRITICAL' },
        { isValid: false, dataType: 'ai_suggestion', key: 'k2', timestamp: new Date(), corruptionLevel: 'SEVERE' },
        { isValid: true, dataType: 'ai_suggestion', key: 'k3', timestamp: new Date(), corruptionLevel: 'NONE' }
      ];

      await service.cleanupCorruptedData(redis, results);

      const cmds = (redis.pipeline.mock.results[0]!.value as any).commands;
      const deletedKeys = cmds.filter((c: any) => c.op === 'del').map((c: any) => c.args[0]);
      expect(deletedKeys).toEqual([
        'k1', 'integrity:checksum:k1', 'integrity:meta:k1'
      ]);
      expect(audit.logSecurityViolation).toHaveBeenCalledWith(
        'cache_integrity_cleanup_performed',
        expect.objectContaining({ deleted_keys_count: 1 })
      );
    });

    it('sin CRITICAL no toca el pipeline ni audita', async () => {
      const redis = makeRedis();
      await service.cleanupCorruptedData(redis, [
        { isValid: false, dataType: 'ai_suggestion', key: 'x', timestamp: new Date(), corruptionLevel: 'MINOR' }
      ]);
      expect(redis.pipeline).not.toHaveBeenCalled();
      expect(audit.logSecurityViolation).not.toHaveBeenCalled();
    });

    it('error de Redis no lanza', async () => {
      const redis = makeRedis();
      redis.pipeline.mockImplementation(() => { throw new Error('x'); });
      await expect(service.cleanupCorruptedData(redis, [
        { isValid: false, dataType: 'ai_suggestion', key: 'k', timestamp: new Date(), corruptionLevel: 'CRITICAL' }
      ])).resolves.toBeUndefined();
    });
  });

  describe('getIntegrityStats', () => {
    it('agrega por nivel y tipo', () => {
      const mk = (key: string, isValid: boolean, level: any, dataType: any): IntegrityCheckResult =>
        ({ isValid, dataType, key, timestamp: new Date(), corruptionLevel: level });

      const stats = service.getIntegrityStats([
        mk('a', true, 'NONE', 'ai_suggestion'),
        mk('b', false, 'SEVERE', 'ai_suggestion'),
        mk('c', false, 'CRITICAL', 'user_session'),
        mk('d', true, 'NONE', 'user_session')
      ]);

      expect(stats.total).toBe(4);
      expect(stats.valid).toBe(2);
      expect(stats.corrupted).toBe(2);
      expect(stats.byCorruptionLevel).toEqual({ SEVERE: 1, CRITICAL: 1 });
      expect(stats.byDataType['ai_suggestion']).toEqual({ valid: 1, corrupted: 1 });
      expect(stats.byDataType['user_session']).toEqual({ valid: 1, corrupted: 1 });
    });

    it('lista vacía', () => {
      const stats = service.getIntegrityStats([]);
      expect(stats.total).toBe(0);
      expect(stats.byCorruptionLevel).toEqual({});
    });
  });
});
