/**
 * Repositorio en memoria de eventos de uso de IA.
 * Misma semántica que PrismaAIUsageEventRepository, para el entorno de
 * tests (NODE_ENV=test), donde el container usa repos en memoria y no
 * hay PrismaClient.
 */
import { randomUUID } from 'node:crypto';

import type {
  AIUsageEvent,
  IAIUsageEventRepository,
  NewAIUsageEvent,
} from '../../../application/ports/repositories/IAIUsageEventRepository';

export class InMemoryAIUsageEventRepository implements IAIUsageEventRepository {
  private readonly eventos = new Map<string, AIUsageEvent>();

  async save(event: NewAIUsageEvent): Promise<AIUsageEvent> {
    const created: AIUsageEvent = {
      id: randomUUID(),
      ...event,
      createdAt: new Date(),
    };
    this.eventos.set(created.id, created);
    return created;
  }

  async findSince(since: Date): Promise<AIUsageEvent[]> {
    return Array.from(this.eventos.values())
      .filter((e) => e.createdAt >= since)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }
}
