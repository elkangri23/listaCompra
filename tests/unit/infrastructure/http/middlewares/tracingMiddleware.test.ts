import { traceContextMiddleware } from '../../../../../src/infrastructure/http/middlewares/tracingMiddleware';
import type { Request, Response, NextFunction } from 'express';

type MutableHeaders = { [key: string]: string | string[] | undefined };

type SpanLike = {
  spanContext: jest.Mock<{ traceId: string; spanId: string }>;
  setAttribute: jest.Mock<void, [string, unknown]>;
};

jest.mock('@opentelemetry/api', () => {
  const active = jest.fn();
  const getSpan = jest.fn();
  return {
    context: { active },
    trace: { getSpan },
  };
}, { virtual: true });

const mockedApi = jest.requireMock('@opentelemetry/api') as {
  context: { active: jest.Mock }; 
  trace: { getSpan: jest.Mock };
};

const activeMock = mockedApi.context.active;
const getSpanMock = mockedApi.trace.getSpan;

describe('traceContextMiddleware', () => {
  let req: Partial<Request> & { headers: MutableHeaders };
  let res: Partial<Response> & { setHeader: jest.Mock };
  let next: NextFunction;
  let span: SpanLike;

  beforeEach(() => {
    req = { headers: {} };
    res = { setHeader: jest.fn() };
    next = jest.fn();
    span = {
      spanContext: jest.fn().mockReturnValue({ traceId: 'abc123', spanId: 'def456' }),
      setAttribute: jest.fn(),
    };

    activeMock.mockReturnValue('context');
    getSpanMock.mockReturnValue(span);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('propaga traceId y spanId en headers cuando hay span activo', () => {
    req.headers['x-request-id'] = 'req-789';

    traceContextMiddleware(req as Request, res as Response, next);

    expect(res.setHeader).toHaveBeenCalledWith('x-trace-id', 'abc123');
    expect(res.setHeader).toHaveBeenCalledWith('x-span-id', 'def456');
    expect(req.headers['x-trace-id']).toBe('abc123');
    expect(span.setAttribute).toHaveBeenCalledWith('http.request_id', 'req-789');
    expect(next).toHaveBeenCalled();
  });

  test('no intenta setear atributos cuando no hay request id', () => {
    traceContextMiddleware(req as Request, res as Response, next);

    expect(span.setAttribute).not.toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith('x-trace-id', 'abc123');
    expect(res.setHeader).toHaveBeenCalledWith('x-span-id', 'def456');
  });

  test('continúa ejecución sin modificar headers cuando no hay span activo', () => {
    getSpanMock.mockReturnValue(null);

    traceContextMiddleware(req as Request, res as Response, next);

    expect(res.setHeader).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });
});
