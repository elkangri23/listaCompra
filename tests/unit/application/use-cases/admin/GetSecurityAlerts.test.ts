/**
 * Tests del caso de uso GetSecurityAlerts (fase 5): orquesta los
 * repositorios y pagina las alertas calculadas. Las reglas se testean
 * en securityCalculations.test.ts.
 */

import { GetSecurityAlerts } from '@application/use-cases/admin/GetSecurityAlerts';
import { InMemoryLoginAttemptRepository } from '@infrastructure/persistence/in-memory/InMemoryLoginAttemptRepository';
import { InMemoryUsuarioRepository } from '@infrastructure/persistence/in-memory/InMemoryUsuarioRepository';
import { Usuario, RolUsuario } from '@domain/entities/Usuario';
import { Email } from '@domain/value-objects/Email';
import { failure } from '@shared/result';

function makeUser(props: { id: string; email: string; rol?: RolUsuario; totpEnabled?: boolean }): Usuario {
  const result = Usuario.create({
    id: props.id,
    email: Email.createUnsafe(props.email),
    password: 'hashed-password-very-long',
    nombre: 'Test',
    apellidos: 'User',
    rol: props.rol ?? RolUsuario.USUARIO,
    emailVerificado: true,
    totpEnabled: props.totpEnabled ?? false,
  });
  if (result.isFailure) {
    throw result.error;
  }
  return result.value;
}

describe('GetSecurityAlerts', () => {
  it('sin datos que disparen alertas → lista vacía', async () => {
    const useCase = new GetSecurityAlerts(
      new InMemoryLoginAttemptRepository(),
      new InMemoryUsuarioRepository()
    );
    const result = await useCase.execute();
    expect(result).toEqual({ alerts: [], total: 0, page: 1, pageSize: 20, totalPages: 1 });
  });

  it('6 fallos del mismo email en 1 h → alerta de fuerza bruta', async () => {
    const attempts = new InMemoryLoginAttemptRepository();
    for (let i = 0; i < 6; i++) {
      await attempts.save({ email: 'victima@ejemplo.com', success: false, reason: 'WRONG_PASSWORD', ipAddress: null, userAgent: null });
    }
    const useCase = new GetSecurityAlerts(attempts, new InMemoryUsuarioRepository());
    const result = await useCase.execute();
    expect(result.total).toBe(1);
    expect(result.alerts[0]?.type).toBe('BRUTE_FORCE_EMAIL');
    expect(result.alerts[0]?.severity).toBe('high');
  });

  it('admin sin 2FA → alerta; admin con 2FA → ninguna', async () => {
    const users = new InMemoryUsuarioRepository();
    await users.save(makeUser({ id: 'a1', email: 'admin@ejemplo.com', rol: RolUsuario.ADMIN, totpEnabled: false }));
    await users.save(makeUser({ id: 'a2', email: 'admin2@ejemplo.com', rol: RolUsuario.ADMIN, totpEnabled: true }));
    const useCase = new GetSecurityAlerts(new InMemoryLoginAttemptRepository(), users);
    const result = await useCase.execute();
    expect(result.total).toBe(1);
    expect(result.alerts[0]?.type).toBe('ADMIN_WITHOUT_2FA');
    expect(result.alerts[0]?.relatedEmail).toBe('admin@ejemplo.com');
  });

  it('pagina las alertas', async () => {
    const attempts = new InMemoryLoginAttemptRepository();
    const users = new InMemoryUsuarioRepository();
    await users.save(makeUser({ id: 'a1', email: 'admin@ejemplo.com', rol: RolUsuario.ADMIN, totpEnabled: false }));
    await users.save(makeUser({ id: 'a2', email: 'admin2@ejemplo.com', rol: RolUsuario.ADMIN, totpEnabled: false }));
    const useCase = new GetSecurityAlerts(attempts, users);
    const page1 = await useCase.execute(1, 1);
    expect(page1.total).toBe(2);
    expect(page1.alerts).toHaveLength(1);
    expect(page1.totalPages).toBe(2);
    const page2 = await useCase.execute(2, 1);
    expect(page2.alerts).toHaveLength(1);
    expect(page2.alerts[0]?.id).not.toBe(page1.alerts[0]?.id);
  });

  it('un fallo de repositorio de usuarios es error (no un "todo en orden" falso)', async () => {
    const users = new InMemoryUsuarioRepository();
    const brokenUsers = {
      ...users,
      findAdminsWithoutTotp: async () => failure(new Error('BD caída')),
      findGracePeriodAccounts: async () => failure(new Error('BD caída')),
    } as unknown as InMemoryUsuarioRepository;
    const useCase = new GetSecurityAlerts(new InMemoryLoginAttemptRepository(), brokenUsers);
    await expect(useCase.execute()).rejects.toThrow('BD caída');
  });
});
