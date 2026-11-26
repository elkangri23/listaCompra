/**
 * Tests unitarios para PrismaEmailVerificationCodeRepository (item 3)
 * Mockea el PrismaClient, como el resto de repositorios Prisma.
 */

import { PrismaEmailVerificationCodeRepository } from '../../../../../src/infrastructure/persistence/repositories/PrismaEmailVerificationCodeRepository';
import type { Result } from '../../../../../src/shared/result';

const unwrap = <T>(r: Result<T, Error>): T | null | undefined =>
  (r.isSuccess ? (r as { value: T | null }).value : undefined);

const ROW = {
  id: 'code-id',
  usuarioId: 'user-id',
  codeHash: 'hash',
  intentos: 0,
  expiraAt: new Date('2026-11-26T23:45:00.000Z'),
  usado: false,
  usadoAt: null,
  createdAt: new Date('2026-11-26T23:30:00.000Z'),
};

describe('PrismaEmailVerificationCodeRepository', () => {
  let prisma: any;
  let repo: PrismaEmailVerificationCodeRepository;

  beforeEach(() => {
    prisma = {
      emailVerificationCode: {
        create: jest.fn().mockResolvedValue(ROW),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue(ROW),
        findFirst: jest.fn().mockResolvedValue(ROW),
        findUnique: jest.fn().mockResolvedValue({ intentos: 2 }),
      },
    };
    repo = new PrismaEmailVerificationCodeRepository(prisma);
  });

  it('create invalida los pendientes anteriores y crea el código con TTL', async () => {
    const result = await repo.create({ usuarioId: 'user-id', codeHash: 'hash', ttlSeconds: 900 });

    expect(result.isSuccess).toBe(true);
    expect(prisma.emailVerificationCode.updateMany).toHaveBeenCalledWith({
      where: { usuarioId: 'user-id', usado: false },
      data: { usado: true },
    });
    expect(prisma.emailVerificationCode.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ usuarioId: 'user-id', codeHash: 'hash' }),
      })
    );
  });

  it('findLatestPendingByUsuarioId busca el último no usado y no caducado', async () => {
    const result = await repo.findLatestPendingByUsuarioId('user-id');

    expect(unwrap(result)?.id).toBe('code-id');
    expect(prisma.emailVerificationCode.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ usuarioId: 'user-id', usado: false }),
        orderBy: { createdAt: 'desc' },
      })
    );
  });

  it('findLatestByUsuarioId devuelve null cuando no hay códigos', async () => {
    prisma.emailVerificationCode.findFirst.mockResolvedValue(null);
    const result = await repo.findLatestByUsuarioId('user-id');
    expect(result.isSuccess).toBe(true);
    expect(unwrap(result)).toBeNull();
  });

  it('incrementAttempts incrementa y devuelve el nuevo conteo', async () => {
    const result = await repo.incrementAttempts('code-id', 5);
    expect(unwrap(result)).toBe(2);
    expect(prisma.emailVerificationCode.updateMany).toHaveBeenCalledWith({
      where: { id: 'code-id', usado: false, intentos: { lt: 5 } },
      data: { intentos: { increment: 1 } },
    });
  });

  it('incrementAttempts devuelve 0 cuando el código está bloqueado', async () => {
    prisma.emailVerificationCode.updateMany.mockResolvedValue({ count: 0 });
    const result = await repo.incrementAttempts('code-id', 5);
    expect(unwrap(result)).toBe(0);
  });

  it('markUsed marca usado con fecha', async () => {
    const result = await repo.markUsed('code-id');
    expect(result.isSuccess).toBe(true);
    expect(prisma.emailVerificationCode.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'code-id' },
        data: expect.objectContaining({ usado: true, usadoAt: expect.any(Date) }),
      })
    );
  });

  it('create devuelve failure si Prisma falla', async () => {
    prisma.emailVerificationCode.updateMany.mockRejectedValue(new Error('db caída'));
    const result = await repo.create({ usuarioId: 'user-id', codeHash: 'hash', ttlSeconds: 900 });
    expect(result.isFailure).toBe(true);
  });
});
