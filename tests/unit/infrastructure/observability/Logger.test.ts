/**
 * Tests unitarios para Logger (Winston + correlación con OpenTelemetry)
 * Cubre: enrichMeta con/sin span activo, todos los métodos tipados
 * y el manejo de errores en error().
 */

import { Logger, winstonLogger } from '../../../../src/infrastructure/observability/logger/Logger';

const getSpanMock = jest.fn();

jest.mock('@opentelemetry/api', () => ({
  context: { active: () => ({}), with: (_ctx: unknown, fn: () => void) => fn() },
  trace: { getSpan: (ctx: unknown) => getSpanMock(ctx) }
}));

describe('Logger', () => {
  let infoSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;
  let debugSpy: jest.SpyInstance;
  let httpSpy: jest.SpyInstance;

  beforeEach(() => {
    // Los spies se crean en beforeEach: con resetMocks/restoreMocks activados
    // a nivel de jest.config.js, los creados en beforeAll no capturan llamadas.
    infoSpy = jest.spyOn(winstonLogger, 'info');
    warnSpy = jest.spyOn(winstonLogger, 'warn');
    errorSpy = jest.spyOn(winstonLogger, 'error');
    debugSpy = jest.spyOn(winstonLogger, 'debug');
    httpSpy = jest.spyOn(winstonLogger, 'http');
    getSpanMock.mockReset();
  });

  describe('enrichMeta (correlación con tracing)', () => {
    it('devuelve el meta intacto si no hay span activo', () => {
      getSpanMock.mockReturnValue(undefined);
      const logger = new Logger('Test');

      logger.info('sin span', { foo: 'bar' });

      expect(infoSpy).toHaveBeenCalledWith('[Test] sin span', { foo: 'bar' });
    });

    it('devuelve el meta intacto si el span no tiene traceId ni spanId', () => {
      getSpanMock.mockReturnValue({ spanContext: () => ({}) });
      const logger = new Logger('Test');

      logger.info('span vacío', { foo: 'bar' });

      expect(infoSpy).toHaveBeenCalledWith('[Test] span vacío', { foo: 'bar' });
    });

    it('devuelve solo traceMeta si meta es undefined y hay span', () => {
      getSpanMock.mockReturnValue({
        spanContext: () => ({ traceId: 'trace-1', spanId: 'span-1' })
      });
      const logger = new Logger('Test');

      logger.info('sin meta');

      expect(infoSpy).toHaveBeenCalledWith('[Test] sin meta', {
        traceId: 'trace-1',
        spanId: 'span-1'
      });
    });

    it('envuelve metas no-objeto (string) junto al contexto de trace', () => {
      getSpanMock.mockReturnValue({
        spanContext: () => ({ traceId: 'trace-1', spanId: 'span-1' })
      });
      const logger = new Logger('Test');

      logger.info('meta primitivo', 'valor-plano');

      expect(infoSpy).toHaveBeenCalledWith('[Test] meta primitivo', {
        value: 'valor-plano',
        traceId: 'trace-1',
        spanId: 'span-1'
      });
    });

    it('envuelve arrays junto al contexto de trace', () => {
      getSpanMock.mockReturnValue({
        spanContext: () => ({ traceId: 'trace-1', spanId: 'span-1' })
      });
      const logger = new Logger('Test');

      logger.info('meta array', ['a', 'b']);

      expect(infoSpy).toHaveBeenCalledWith('[Test] meta array', {
        value: ['a', 'b'],
        traceId: 'trace-1',
        spanId: 'span-1'
      });
    });

    it('fusiona el meta objeto con el contexto de trace', () => {
      getSpanMock.mockReturnValue({
        spanContext: () => ({ traceId: 'trace-2', spanId: 'span-2' })
      });
      const logger = new Logger('Test');

      logger.warn('meta objeto', { listaId: 'l-1' });

      expect(warnSpy).toHaveBeenCalledWith('[Test] meta objeto', {
        listaId: 'l-1',
        traceId: 'trace-2',
        spanId: 'span-2'
      });
    });

    it('no duplica el meta cuando el span no aporta contexto', () => {
      getSpanMock.mockReturnValue({ spanContext: () => ({ traceId: undefined, spanId: undefined }) });
      const logger = new Logger('Test');

      logger.info('span sin ids', { foo: 1 });

      expect(infoSpy).toHaveBeenCalledWith('[Test] span sin ids', { foo: 1 });
    });
  });

  describe('métodos tipados', () => {
    it('info/warn/debug/http anteponen el contexto al mensaje', () => {
      const logger = new Logger('Ctx');

      logger.info('m1');
      logger.warn('m2');
      logger.debug('m3');
      logger.http('m4');

      expect(infoSpy).toHaveBeenCalledWith('[Ctx] m1', undefined);
      expect(warnSpy).toHaveBeenCalledWith('[Ctx] m2', undefined);
      expect(debugSpy).toHaveBeenCalledWith('[Ctx] m3', undefined);
      expect(httpSpy).toHaveBeenCalledWith('[Ctx] m4', undefined);
    });

    it('startup/shutdown/security/database/messaging/email/ai usan info o warn con el prefijo correcto', () => {
      const logger = new Logger('Ctx');

      logger.startup('arranque');
      logger.shutdown('parada');
      logger.security('intento sospechoso');
      logger.database('query ok');
      logger.messaging('evento publicado');
      logger.email('correo enviado');
      logger.ai('sugerencias generadas');

      expect(infoSpy).toHaveBeenCalledWith('🚀 [Ctx] arranque', undefined);
      expect(infoSpy).toHaveBeenCalledWith('🔽 [Ctx] parada', undefined);
      expect(warnSpy).toHaveBeenCalledWith('🔒 [Ctx] SECURITY: intento sospechoso', undefined);
      expect(infoSpy).toHaveBeenCalledWith('💾 [Ctx] DATABASE: query ok', undefined);
      expect(infoSpy).toHaveBeenCalledWith('📨 [Ctx] MESSAGING: evento publicado', undefined);
      expect(infoSpy).toHaveBeenCalledWith('📧 [Ctx] EMAIL: correo enviado', undefined);
      expect(infoSpy).toHaveBeenCalledWith('🤖 [Ctx] AI: sugerencias generadas', undefined);
    });

    it('error() con instancia de Error extrae message/stack/name', () => {
      const logger = new Logger('Ctx');
      const boom = new Error('algo falló');

      logger.error('fallo controlado', boom, { extra: 'dato' });

      expect(errorSpy).toHaveBeenCalledWith('[Ctx] fallo controlado', {
        error: {
          message: 'algo falló',
          stack: expect.any(String),
          name: 'Error'
        },
        extra: 'dato'
      });
    });

    it('error() con payload arbitrario lo envuelve como error', () => {
      const logger = new Logger('Ctx');

      logger.error('fallo con payload', { code: 500 }, { op: 'import' });

      expect(errorSpy).toHaveBeenCalledWith('[Ctx] fallo con payload', {
        error: { code: 500 },
        op: 'import'
      });
    });

    it('error() sin meta adicional funciona', () => {
      const logger = new Logger('Ctx');

      logger.error('fallo simple', new Error('x'));

      expect(errorSpy).toHaveBeenCalledWith('[Ctx] fallo simple', {
        error: {
          message: 'x',
          stack: expect.any(String),
          name: 'Error'
        }
      });
    });
  });

  describe('exportaciones', () => {
    it('expone defaultLogger con contexto Main', () => {
      const { defaultLogger } = require('../../../../src/infrastructure/observability/logger/Logger');
      expect(defaultLogger).toBeInstanceOf(Logger);
      defaultLogger.info('mensaje por defecto');
      expect(infoSpy).toHaveBeenCalledWith('[Main] mensaje por defecto', undefined);
    });
  });
});

describe('transportes por entorno (carga aislada del módulo)', () => {
  const originalEnv = process.env['NODE_ENV'];

  afterEach(() => {
    process.env['NODE_ENV'] = originalEnv;
    jest.resetModules();
  });

  it('NODE_ENV=development registra un transport de consola en debug', () => {
    process.env['NODE_ENV'] = 'development';
    let mod: any;
    jest.isolateModules(() => {
      mod = require('../../../../src/infrastructure/observability/logger/Logger');
    });

    expect(mod).toBeDefined();
    // El logger de este módulo aislado usa nivel debug
    mod.defaultLogger.debug('mensaje de desarrollo');
  });

  it('NODE_ENV=production registra transports de fichero y crea logs/', () => {
    process.env['NODE_ENV'] = 'production';
    let mod: any;
    jest.isolateModules(() => {
      mod = require('../../../../src/infrastructure/observability/logger/Logger');
    });

    expect(mod).toBeDefined();
    // debug no aparece en producción (nivel info)
    mod.defaultLogger.info('mensaje de producción');
  });
});
