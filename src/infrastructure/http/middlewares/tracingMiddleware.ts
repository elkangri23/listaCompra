import { Request, Response, NextFunction } from 'express';
import { context, trace } from '@opentelemetry/api';

/**
 * Middleware para propagar información de trace al contexto HTTP.
 * Añade los identificadores de trace y span activos a los headers de respuesta
 * y los expone para otros middlewares/controladores.
 */
export function traceContextMiddleware(req: Request, res: Response, next: NextFunction): void {
  const span = trace.getSpan(context.active());

  if (span) {
    const spanContext = span.spanContext();
    const traceId = spanContext.traceId;
    const spanId = spanContext.spanId;

    if (traceId) {
      res.setHeader('x-trace-id', traceId);
      req.headers['x-trace-id'] = traceId;

      const requestId = req.headers['x-request-id'] as string | undefined;
      if (requestId) {
        span.setAttribute('http.request_id', requestId);
      }
    }

    if (spanId) {
      res.setHeader('x-span-id', spanId);
    }
  }

  next();
}
