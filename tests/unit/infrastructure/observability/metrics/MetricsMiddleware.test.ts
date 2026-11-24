/**
 * Tests unitarios para MetricsMiddleware (observabilidad HTTP)
 */

import {
  metricsMiddleware,
  getMetricsHandler,
  getEndpointMetricsHandler,
  resetMetricsHandler,
  getMetricsCollector
} from '../../../../../src/infrastructure/observability/metrics/MetricsMiddleware';

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

describe('MetricsMiddleware', () => {
  beforeEach(() => {
    resetMetricsHandler(makeReq({ query: {} }), makeRes());
  });

  it('metricsMiddleware registra la request al terminar la respuesta', () => {
    const req = makeReq();
    const res = makeRes();
    const next = jest.fn();

    metricsMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();

    res.send({ ok: true });

    const collector = getMetricsCollector();
    const metrics = collector.getEndpointMetrics('GET', '/api/v1/test');
    expect(metrics).toBeTruthy();
  });

  it('getMetricsHandler devuelve snapshot con system/endpoints', () => {
    const res = makeRes();
    getMetricsHandler(makeReq(), res);

    expect(res.body.timestamp).toBeTruthy();
    expect(res.body.system).toBeTruthy();
    expect(res.body.endpoints).toBeTruthy();
  });

  it('getEndpointMetricsHandler sin method/path → 400', () => {
    const res = makeRes();
    getEndpointMetricsHandler(makeReq({ params: {} }), res);

    expect(res.statusCode).toBe(400);
  });

  it('getEndpointMetricsHandler de endpoint desconocido → 404', () => {
    const res = makeRes();
    getEndpointMetricsHandler(makeReq({ params: { method: 'GET', path: '/no-existe' } }), res);

    expect(res.statusCode).toBe(404);
  });

  it('getEndpointMetricsHandler devuelve métricas del endpoint registrado', () => {
    // Registrar vía middleware
    const req = makeReq();
    const res = makeRes();
    metricsMiddleware(req, res, jest.fn());
    res.send('ok');

    const res2 = makeRes();
    getEndpointMetricsHandler(makeReq({ params: { method: 'GET', path: '/api/v1/test' } }), res2);

    expect(res2.body.metrics).toBeTruthy();
  });

  it('resetMetricsHandler con endpoint inválido → 400', () => {
    const res = makeRes();
    resetMetricsHandler(makeReq({ query: { endpoint: 'sin-formato' } }), res);

    expect(res.statusCode).toBe(400);
  });

  it('resetMetricsHandler con endpoint válido lo resetea', () => {
    const req = makeReq();
    const res = makeRes();
    metricsMiddleware(req, res, jest.fn());
    res.send('x');

    const res2 = makeRes();
    resetMetricsHandler(makeReq({ query: { endpoint: 'GET:/api/v1/test' } }), res2);

    expect(res2.body.message).toContain('Metrics reset');
  });

  it('resetMetricsHandler sin query resetea todo', () => {
    const res = makeRes();
    resetMetricsHandler(makeReq({ query: {} }), res);

    expect(res.body.message).toBe('All metrics reset');
  });
});
