/**
 * Tests unitarios para las ramas de error de MetricsMiddleware
 * Los handlers devuelven 500 cuando el collector falla.
 */

import {
  getMetricsHandler,
  getEndpointMetricsHandler,
  resetMetricsHandler,
  getMetricsCollector
} from '../../../../../src/infrastructure/observability/metrics/MetricsMiddleware';
import type { MetricsCollector } from '../../../../../src/infrastructure/observability/metrics/MetricsCollector';

const makeReq = (overrides: any = {}): any => ({ path: '/api/v1/test', method: 'GET', ...overrides });

const makeRes = (): any => {
  const res: any = {
    statusCode: 0,
    body: undefined,
    status(code: number) { res.statusCode = code; return res; },
    json(payload: unknown) { res.body = payload; return res; },
    send(payload: unknown) { res.body = payload; return res; }
  };
  return res;
};

describe('MetricsMiddleware — ramas de error (500)', () => {
  const collector: MetricsCollector = getMetricsCollector();

  it('getMetricsHandler → 500 si getSystemMetrics lanza', () => {
    const spy = jest.spyOn(collector, 'getSystemMetrics').mockImplementation(() => {
      throw new Error('system metrics boom');
    });

    const res = makeRes();
    getMetricsHandler(makeReq(), res);

    expect(res.statusCode).toBe(500);
    expect(res.body.error).toBe('Failed to retrieve metrics');
    expect(res.body.message).toBe('system metrics boom');
    spy.mockRestore();
  });

  it('getMetricsHandler → 500 con error no-Error', () => {
    const spy = jest.spyOn(collector, 'getSystemMetrics').mockImplementation(() => {
      throw 'string-throw';
    });

    const res = makeRes();
    getMetricsHandler(makeReq(), res);

    expect(res.statusCode).toBe(500);
    expect(res.body.message).toBe('Unknown error');
    spy.mockRestore();
  });

  it('getEndpointMetricsHandler → 500 si getEndpointMetrics lanza', () => {
    const spy = jest.spyOn(collector, 'getEndpointMetrics').mockImplementation(() => {
      throw new Error('endpoint metrics boom');
    });

    const res = makeRes();
    getEndpointMetricsHandler(
      makeReq({ params: { method: 'GET', path: '/api/v1/test' } }),
      res
    );

    expect(res.statusCode).toBe(500);
    expect(res.body.error).toBe('Failed to retrieve endpoint metrics');
    spy.mockRestore();
  });

  it('getEndpointMetricsHandler → 500 si decodeURIComponent falla con path inválido', () => {
    const res = makeRes();
    getEndpointMetricsHandler(
      makeReq({ params: { method: 'GET', path: '%zz' } }),
      res
    );

    expect(res.statusCode).toBe(500);
    expect(res.body.error).toBe('Failed to retrieve endpoint metrics');
  });

  it('resetMetricsHandler → 500 si reset lanza', () => {
    const spy = jest.spyOn(collector, 'reset').mockImplementation(() => {
      throw new Error('reset boom');
    });

    const res = makeRes();
    resetMetricsHandler(makeReq({ query: {} }), res);

    expect(res.statusCode).toBe(500);
    expect(res.body.error).toBe('Failed to reset metrics');
    spy.mockRestore();
  });

  it('resetMetricsHandler → 500 si resetEndpoint lanza (endpoint válido)', () => {
    const spy = jest.spyOn(collector, 'resetEndpoint').mockImplementation(() => {
      throw new Error('resetEndpoint boom');
    });

    const res = makeRes();
    resetMetricsHandler(makeReq({ query: { endpoint: 'GET:/api/v1/test' } }), res);

    expect(res.statusCode).toBe(500);
    expect(res.body.error).toBe('Failed to reset metrics');
    spy.mockRestore();
  });
});

describe('MetricsMiddleware — helpers', () => {
  it('createMetricsCollector devuelve una instancia nueva', () => {
    const { createMetricsCollector } = require('../../../../../src/infrastructure/observability/metrics/MetricsMiddleware');
    const instance = createMetricsCollector();
    expect(instance).toBeTruthy();
    expect(instance).not.toBe(getMetricsCollector());
  });
});
