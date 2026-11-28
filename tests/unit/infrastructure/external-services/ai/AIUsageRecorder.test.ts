/**
 * Tests unitarios para AIUsageRecorder (best-effort) y
 * PrismaAIUsageEventRepository (con delegado falso).
 */

import { AIUsageRecorder } from '../../../../../src/infrastructure/external-services/ai/AIUsageRecorder';
import { PrismaAIUsageEventRepository } from '../../../../../src/infrastructure/persistence/repositories/PrismaAIUsageEventRepository';
import { InMemoryAIUsageEventRepository } from '../../../../../src/infrastructure/persistence/in-memory/InMemoryAIUsageEventRepository';

const eventInput = {
  provider: 'freellmapi',
  model: 'qwen3.8-27b',
  operation: 'category-suggestions' as const,
  latencyMs: 123,
  success: true,
  cached: false,
  userId: null,
};

describe('AIUsageRecorder', () => {
  it('guarda el evento con userId null', async () => {
    const repo = { save: jest.fn().mockResolvedValue({ id: '1' }), findSince: jest.fn() };
    const recorder = new AIUsageRecorder(repo as any);

    await recorder.record(eventInput);

    expect(repo.save).toHaveBeenCalledWith({
      userId: null,
      provider: 'freellmapi',
      model: 'qwen3.8-27b',
      operation: 'category-suggestions',
      latencyMs: 123,
      success: true,
      cached: false,
    });
  });

  it('un fallo del repo NO propaga (best-effort)', async () => {
    const repo = { save: jest.fn().mockRejectedValue(new Error('BD caída')), findSince: jest.fn() };
    const recorder = new AIUsageRecorder(repo as any);

    await expect(recorder.record(eventInput)).resolves.toBeUndefined();
    expect(repo.save).toHaveBeenCalledTimes(1);
  });
});

describe('PrismaAIUsageEventRepository', () => {
  it('save delega en create y findSince en findMany con gte', async () => {
    const delegate = {
      create: jest.fn().mockResolvedValue({ id: 'abc', ...eventInput, createdAt: new Date() }),
      findMany: jest.fn().mockResolvedValue([]),
    };
    const repo = new PrismaAIUsageEventRepository({ aIUsageEvent: delegate });
    const since = new Date('2026-11-22T00:00:00Z');

    const saved = await repo.save({ ...eventInput });
    expect(delegate.create).toHaveBeenCalledWith({ data: { ...eventInput } });
    expect(saved.id).toBe('abc');

    await repo.findSince(since);
    expect(delegate.findMany).toHaveBeenCalledWith({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: 'asc' },
    });
  });
});

describe('InMemoryAIUsageEventRepository', () => {
  it('save + findSince filtra por fecha y ordena', async () => {
    const repo = new InMemoryAIUsageEventRepository();
    await repo.save({ ...eventInput });
    await repo.save({ ...eventInput, operation: 'bulk-categorize' });

    const all = await repo.findSince(new Date(Date.now() - 1000));
    expect(all).toHaveLength(2);
    expect(all[0]!.operation).toBe('category-suggestions');

    const none = await repo.findSince(new Date(Date.now() + 60_000));
    expect(none).toHaveLength(0);
  });
});
