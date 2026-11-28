import type { AIUsageOperation } from '../external/IAIUsageRecorder';

/**
 * Evento de uso de IA persistido (fila de `ai_usage_events`).
 *
 * userId NO tiene FK a usuarios: estos eventos son telemetría global y
 * no deben interferir con la cascada GDPR de borrado de cuenta (el
 * borrado de un usuario no borra ni se ve bloqueado por sus eventos).
 */
export interface AIUsageEvent {
  id: string;
  userId: string | null;
  provider: string;
  model: string;
  operation: AIUsageOperation;
  latencyMs: number;
  success: boolean;
  cached: boolean;
  createdAt: Date;
}

export type NewAIUsageEvent = Omit<AIUsageEvent, 'id' | 'createdAt'>;

export interface IAIUsageEventRepository {
  save(event: NewAIUsageEvent): Promise<AIUsageEvent>;
  findSince(since: Date): Promise<AIUsageEvent[]>;
}
