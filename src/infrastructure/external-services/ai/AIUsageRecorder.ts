/**
 * Registro best-effort de eventos de uso de IA.
 * Envuelve el repositorio con try/catch + log: NUNCA propaga errores,
 * para que un fallo de telemetría no rompa la operación de IA.
 */

import type {
  IAIUsageRecorder,
  AIUsageEventInput,
} from '../../../application/ports/external/IAIUsageRecorder';
import type { IAIUsageEventRepository } from '../../../application/ports/repositories/IAIUsageEventRepository';
import { Logger } from '../../observability/logger/Logger';

export class AIUsageRecorder implements IAIUsageRecorder {
  private readonly logger = new Logger('AIUsageRecorder');

  constructor(private readonly repository: IAIUsageEventRepository) {}

  async record(event: AIUsageEventInput): Promise<void> {
    try {
      await this.repository.save({
        userId: event.userId ?? null,
        provider: event.provider,
        model: event.model,
        operation: event.operation,
        latencyMs: event.latencyMs,
        success: event.success,
        cached: event.cached,
      });
    } catch (error) {
      // Best-effort: la telemetría nunca rompe la operación de IA.
      this.logger.warn('No se pudo registrar el evento de uso de IA', {
        operation: event.operation,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
