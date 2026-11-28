/**
 * Tests del caso de uso GetSecurityOverview (fase 5): resumen real de
 * seguridad (2FA, fallos 24 h, Turnstile, periodo de gracia) y secciones
 * a null con motivo cuando no se pueden calcular.
 */

import { GetSecurityOverview } from '@application/use-cases/admin/GetSecurityOverview';
import { InMemoryLoginAttemptRepository } from '@infrastructure/persistence/in-memory/InMemoryLoginAttemptRepository';
import { InMemoryUsuarioRepository } from '@infrastructure/persistence/in-memory/InMemoryUsuarioRepository';
import { Usuario, RolUsuario } from '@domain/entities/Usuario';
import { Email } from '@domain/value-objects/Email';
import { success, failure } from '@shared/result';

function makeUser(props: {
  id: string;
  email: string;
  rol?: RolUsuario;
  totpEnabled?: boolean;
  eliminacionSolicitadaEn?: Date | null;
}): Usuario {
  const result = Usuario.create({
    id: props.id,
    email: Email.createUnsafe(props.email),
    password: 'hashed-password-very-long',
    nombre: 'Test',
    apellidos: 'User',
    rol: props.rol ?? RolUsuario.USUARIO,
    emailVerificado: true,
    totpEnabled: props.totpEnabled ?? false,
    eliminacionSolicitadaEn: props.eliminacionSolicitadaEn ?? null,
  });
  if (result.isFailure) {
    throw result.error;
  }
  return result.value;
}

describe('GetSecurityOverview', () => {
  it('devuelve datos reales: 2FA, fallos 24 h, Turnstile y gracia', async () => {
    const attempts = new InMemoryLoginAttemptRepository();
    const users = new InMemoryUsuarioRepository();
    await users.save(makeUser({ id: 'u1', email: 'admin@ejemplo.com', rol: RolUsuario.ADMIN, totpEnabled: true }));
    await users.save(makeUser({ id: 'u2', email: 'luis@ejemplo.com', totpEnabled: false }));
    await users.save(
      makeUser({
        id: 'u3',
        email: 'gracia@ejemplo.com',
        eliminacionSolicitadaEn: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000),
      })
    );
    await attempts.save({ email: 'luis@ejemplo.com', success: false, reason: 'WRONG_PASSWORD', ipAddress: null, userAgent: null });
    await attempts.save({ email: 'luis@ejemplo.com', success: false, reason: 'WRONG_PASSWORD', ipAddress: null, userAgent: null });
    await attempts.save({ email: 'luis@ejemplo.com', success: true, reason: null, ipAddress: null, userAgent: null });

    const useCase = new GetSecurityOverview(attempts, users, { enabled: () => true, verify: async () => true });
    const overview = await useCase.execute();

    expect(overview.twoFactor).toEqual({ enabled: 1, total: 3 });
    expect(overview.failedLoginsLast24h).toBe(2);
    expect(overview.turnstile).toEqual({ enabled: true });
    expect(overview.gracePeriod?.count).toBe(1);
    expect(overview.gracePeriod?.accounts[0]?.email).toBe('gracia@ejemplo.com');
    expect(overview.gracePeriod?.accounts[0]?.daysLeft).toBe(5);
    expect(overview.unavailable).toEqual({});
  });

  it('Turnstile desactivado cuando no hay clave configurada', async () => {
    const useCase = new GetSecurityOverview(
      new InMemoryLoginAttemptRepository(),
      new InMemoryUsuarioRepository(),
      { enabled: () => false, verify: async () => true }
    );
    const overview = await useCase.execute();
    expect(overview.turnstile).toEqual({ enabled: false });
    expect(overview.twoFactor).toEqual({ enabled: 0, total: 0 });
    expect(overview.failedLoginsLast24h).toBe(0);
    expect(overview.gracePeriod).toEqual({ count: 0, accounts: [] });
  });

  it('un fallo al contar 2FA deja esa sección a null con motivo, sin romper el resto', async () => {
    const attempts = new InMemoryLoginAttemptRepository();
    const users = new InMemoryUsuarioRepository();
    const brokenUsers = {
      ...users,
      countTotpEnabled: async () => failure(new Error('BD caída')),
      count: async () => success(2),
      findGracePeriodAccounts: async () => success([]),
    } as unknown as InMemoryUsuarioRepository;

    const useCase = new GetSecurityOverview(attempts, brokenUsers, { enabled: () => true, verify: async () => true });
    const overview = await useCase.execute();

    expect(overview.twoFactor).toBeNull();
    expect(overview.unavailable.twoFactor).toBe('BD caída');
    expect(overview.failedLoginsLast24h).toBe(0);
    expect(overview.gracePeriod).toEqual({ count: 0, accounts: [] });
  });
});
