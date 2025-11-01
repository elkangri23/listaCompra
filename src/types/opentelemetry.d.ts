declare module '@opentelemetry/sdk-node' {
  export class NodeSDK {
    constructor(options?: Record<string, unknown>);
    start(): Promise<void>;
    shutdown(): Promise<void>;
  }
}

declare module '@opentelemetry/auto-instrumentations-node' {
  export function getNodeAutoInstrumentations(options?: Record<string, unknown>): unknown;
}

declare module '@opentelemetry/exporter-trace-otlp-http' {
  export interface OTLPExporterOptions {
    url?: string;
    headers?: Record<string, string>;
  }

  export class OTLPTraceExporter {
    constructor(options?: OTLPExporterOptions);
  }
}

declare module '@opentelemetry/resources' {
  export class Resource {
    constructor(attributes?: Record<string, unknown>);
  }
}

declare module '@opentelemetry/semantic-conventions' {
  export const SemanticResourceAttributes: {
    SERVICE_NAME: 'service.name';
    SERVICE_VERSION: 'service.version';
    DEPLOYMENT_ENVIRONMENT: 'deployment.environment';
  };
}

declare module '@opentelemetry/api' {
  export interface SpanContext {
    traceId?: string;
    spanId?: string;
  }

  export interface Span {
    spanContext(): SpanContext;
    setAttribute(key: string, value: unknown): void;
  }

  export const context: {
    active(): unknown;
  };

  export const trace: {
    getSpan(ctx?: unknown): Span | null | undefined;
  };
}
