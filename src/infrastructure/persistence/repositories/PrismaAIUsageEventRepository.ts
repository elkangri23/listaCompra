/**
 * Repositorio de eventos de uso de IA usando Prisma.
 *
 * Nota: el cliente Prisma se recibe como `unknown` y se proyecta al
 * delegado `aiUsageEvent` en vez de importar `PrismaClient`: en local
 * no se puede ejecutar `prisma generate` (la red lo impide) y el
 * cliente generado no incluye todavía el modelo nuevo, así que el
 * import tipado rompería la compilación local. En CI `prisma migrate
 * deploy` + generate crean el delegado real.
 */

import type {
  AIUsageEvent,
  IAIUsageEventRepository,
  NewAIUsageEvent,
} from '../../../application/ports/repositories/IAIUsageEventRepository';

interface AIUsageEventDelegate {
  create(args: { data: NewAIUsageEvent }): Promise<AIUsageEvent>;
  findMany(args: {
    where: { createdAt: { gte: Date } };
    orderBy: { createdAt: 'asc' };
  }): Promise<AIUsageEvent[]>;
}

export class PrismaAIUsageEventRepository implements IAIUsageEventRepository {
  private readonly delegate: AIUsageEventDelegate;

  constructor(prisma: unknown) {
    this.delegate = (prisma as { aiUsageEvent: AIUsageEventDelegate }).aiUsageEvent;
  }

  async save(event: NewAIUsageEvent): Promise<AIUsageEvent> {
    return this.delegate.create({ data: event });
  }

  async findSince(since: Date): Promise<AIUsageEvent[]> {
    return this.delegate.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: 'asc' },
    });
  }
}
