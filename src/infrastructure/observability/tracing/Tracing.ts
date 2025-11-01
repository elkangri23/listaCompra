import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { Logger } from '../logger/Logger';

type HeadersMap = Record<string, string>;

const tracingLogger = new Logger('Tracing');
let sdk: NodeSDK | null = null;
let tracingEnabled = false;

export async function initializeTracing(): Promise<boolean> {
  const isEnabled = (process.env['TRACING_ENABLED'] || '').toLowerCase() === 'true';

  if (!isEnabled) {
    tracingLogger.info('Tracing distribuido deshabilitado por configuración');
    tracingEnabled = false;
    return false;
  }

  if (sdk) {
    tracingLogger.debug('Tracing ya se encontraba inicializado');
    tracingEnabled = true;
    return true;
  }

  try {
    const exporter = new OTLPTraceExporter({
      url: getExporterUrl(),
      headers: getExporterHeaders(),
    });

    const resource = new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: process.env['TRACING_SERVICE_NAME'] || 'lista-compra-api',
      [SemanticResourceAttributes.SERVICE_VERSION]: process.env['TRACING_SERVICE_VERSION'] || process.env['npm_package_version'] || '1.0.0',
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env['NODE_ENV'] || 'development',
    });

    sdk = new NodeSDK({
      resource,
      traceExporter: exporter,
      instrumentations: [
        getNodeAutoInstrumentations({
          '@opentelemetry/instrumentation-http': { enabled: true },
          '@opentelemetry/instrumentation-express': { enabled: true },
          '@opentelemetry/instrumentation-prisma': { enabled: true },
        }),
      ],
    });

    await sdk.start();
    tracingEnabled = true;
    tracingLogger.startup('Tracing distribuido inicializado correctamente');
    return true;
  } catch (error) {
    sdk = null;
    tracingEnabled = false;
    tracingLogger.error('Error al inicializar tracing distribuido', error as Error);
    return false;
  }
}

export async function shutdownTracing(): Promise<void> {
  if (!sdk) {
    return;
  }

  try {
    await sdk.shutdown();
    tracingLogger.shutdown('Tracing distribuido detenido');
  } catch (error) {
    tracingLogger.error('Error al detener tracing distribuido', error as Error);
  } finally {
    sdk = null;
    tracingEnabled = false;
  }
}

export function isTracingEnabled(): boolean {
  return tracingEnabled;
}

function getExporterUrl(): string {
  return process.env['OTEL_EXPORTER_OTLP_ENDPOINT'] || 'http://localhost:4318/v1/traces';
}

function getExporterHeaders(): HeadersMap {
  const rawHeaders = process.env['OTEL_EXPORTER_OTLP_HEADERS'];
  if (!rawHeaders) {
    return {};
  }

  return rawHeaders
    .split(',')
    .map(header => header.trim())
    .filter(Boolean)
    .reduce<HeadersMap>((acc, header) => {
      const [key, value] = header.split('=');
      if (key && value) {
        acc[key.trim()] = value.trim();
      }
      return acc;
    }, {});
}
