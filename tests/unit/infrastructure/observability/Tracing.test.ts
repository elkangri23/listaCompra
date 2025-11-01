type AsyncMock = jest.Mock<Promise<void>, []>;

type NodeSdkInstance = {
  start: AsyncMock;
  shutdown: AsyncMock;
};

const startMock: AsyncMock = jest.fn();
const shutdownMock: AsyncMock = jest.fn();
const nodeSdkConstructor = jest.fn();

class MockNodeSDK implements NodeSdkInstance {
  public start = startMock;
  public shutdown = shutdownMock;

  constructor(...args: unknown[]) {
    nodeSdkConstructor(...args);
  }
}

jest.mock('@opentelemetry/sdk-node', () => ({
  NodeSDK: MockNodeSDK,
}), { virtual: true });

const getNodeAutoInstrumentationsMock = jest.fn(() => []);
jest.mock('@opentelemetry/auto-instrumentations-node', () => ({
  getNodeAutoInstrumentations: getNodeAutoInstrumentationsMock,
}), { virtual: true });

const otlpExporterConstructor = jest.fn();
jest.mock('@opentelemetry/exporter-trace-otlp-http', () => ({
  OTLPTraceExporter: function MockExporter(this: unknown, ...args: unknown[]) {
    otlpExporterConstructor(...args);
  },
}), { virtual: true });

const resourceConstructor = jest.fn();
jest.mock('@opentelemetry/resources', () => ({
  Resource: class MockResource {
    constructor(...args: unknown[]) {
      resourceConstructor(...args);
    }
  },
}), { virtual: true });

jest.mock('@opentelemetry/semantic-conventions', () => ({
  SemanticResourceAttributes: {
    SERVICE_NAME: 'service.name',
    SERVICE_VERSION: 'service.version',
    DEPLOYMENT_ENVIRONMENT: 'deployment.environment',
  },
}), { virtual: true });

const noop = jest.fn();
jest.mock('@opentelemetry/api', () => ({
  context: { active: noop },
  trace: { getSpan: noop },
}), { virtual: true });

describe('Tracing bootstrap', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    startMock.mockReset();
    shutdownMock.mockReset();
    nodeSdkConstructor.mockClear();
    getNodeAutoInstrumentationsMock.mockClear();
    otlpExporterConstructor.mockClear();
    resourceConstructor.mockClear();
    process.env = { ...originalEnv };
    delete process.env['TRACING_ENABLED'];
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  function importTracing() {
    let tracingModule: typeof import('../../../../src/infrastructure/observability/tracing/Tracing') | undefined;
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      tracingModule = require('../../../../src/infrastructure/observability/tracing/Tracing');
    });

    if (!tracingModule) {
      throw new Error('No se pudo cargar el módulo de tracing en pruebas');
    }

    return tracingModule;
  }

  test('no inicializa tracing cuando TRACING_ENABLED no está activo', async () => {
    const { initializeTracing, isTracingEnabled } = importTracing();

    const initialized = await initializeTracing();

    expect(initialized).toBe(false);
    expect(nodeSdkConstructor).not.toHaveBeenCalled();
    expect(isTracingEnabled()).toBe(false);
  });

  test('inicializa tracing cuando TRACING_ENABLED es true', async () => {
    process.env['TRACING_ENABLED'] = 'true';
    startMock.mockResolvedValue();

    const { initializeTracing, isTracingEnabled } = importTracing();

    const initialized = await initializeTracing();

    expect(initialized).toBe(true);
    expect(nodeSdkConstructor).toHaveBeenCalledTimes(1);
    expect(startMock).toHaveBeenCalledTimes(1);
    expect(isTracingEnabled()).toBe(true);

    // segunda llamada no debe recrear el SDK
    const secondCall = await initializeTracing();
    expect(secondCall).toBe(true);
    expect(nodeSdkConstructor).toHaveBeenCalledTimes(1);
  });

  test('maneja errores al inicializar trazas y deja el estado limpio', async () => {
    process.env['TRACING_ENABLED'] = 'true';
    startMock.mockRejectedValueOnce(new Error('boom'));
    startMock.mockResolvedValueOnce();

    const { initializeTracing, isTracingEnabled } = importTracing();

    const initialized = await initializeTracing();

    expect(initialized).toBe(false);
    expect(nodeSdkConstructor).toHaveBeenCalledTimes(1);
    expect(isTracingEnabled()).toBe(false);

    const retriedInitialization = await initializeTracing();

    expect(retriedInitialization).toBe(true);
    expect(nodeSdkConstructor).toHaveBeenCalledTimes(2);
    expect(isTracingEnabled()).toBe(true);
  });

  test('shutdownTracing detiene el SDK activo y limpia el estado', async () => {
    process.env['TRACING_ENABLED'] = 'true';
    startMock.mockResolvedValue();
    shutdownMock.mockResolvedValue();

    const { initializeTracing, shutdownTracing, isTracingEnabled } = importTracing();

    await initializeTracing();
    expect(isTracingEnabled()).toBe(true);

    await shutdownTracing();

    expect(shutdownMock).toHaveBeenCalledTimes(1);
    expect(isTracingEnabled()).toBe(false);

    // Permitir volver a iniciar después del shutdown
    await initializeTracing();
    expect(nodeSdkConstructor).toHaveBeenCalledTimes(2);
  });
});
