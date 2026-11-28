/**
 * Tests del cálculo puro de alertas de seguridad (fase 5).
 * Reglas documentadas en securityCalculations.ts: fuerza bruta (>5
 * fallos mismo email en 1 h), admin sin 2FA, periodo de gracia <7 días.
 */

import { Usuario, RolUsuario } from '@domain/entities/Usuario';
import { Email } from '@domain/value-objects/Email';
import type { LoginAttempt } from '@application/ports/repositories/ILoginAttemptRepository';
import {
  BRUTE_FORCE_THRESHOLD,
  computeSecurityAlerts,
  daysLeftUntilDeletion,
} from '@application/use-cases/admin/securityCalculations';

const NOW = new Date('2026-11-28T12:00:00.000Z');

function makeUser(props: {
  id: string;
  email: string;
  rol?: RolUsuario;
  activo?: boolean;
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
    activo: props.activo ?? true,
    emailVerificado: true,
    totpEnabled: props.totpEnabled ?? false,
    eliminacionSolicitadaEn: props.eliminacionSolicitadaEn ?? null,
  });
  if (result.isFailure) {
    throw result.error;
  }
  return result.value;
}

function makeFailedAttempt(email: string, minutesAgo: number): LoginAttempt {
  return {
    id: `att-${email}-${minutesAgo}`,
    email,
    success: false,
    reason: 'WRONG_PASSWORD',
    ipAddress: '1.2.3.4',
    userAgent: 'test-agent',
    createdAt: new Date(NOW.getTime() - minutesAgo * 60 * 1000),
  };
}

describe('daysLeftUntilDeletion', () => {
  it('30 días de gracia: solicitada hace 25 días → quedan 5', () => {
    const requested = new Date(NOW.getTime() - 25 * 24 * 60 * 60 * 1000);
    expect(daysLeftUntilDeletion(requested, NOW)).toBe(5);
  });

  it('solicitada hace 31 días → -1 (vencido)', () => {
    const requested = new Date(NOW.getTime() - 31 * 24 * 60 * 60 * 1000);
    expect(daysLeftUntilDeletion(requested, NOW)).toBe(-1);
  });
});

describe('computeSecurityAlerts', () => {
  it('sin datos → lista vacía (nunca se inventan alertas)', () => {
    expect(
      computeSecurityAlerts({
        failedAttempts: [],
        adminsWithoutTotp: [],
        graceAccounts: [],
        now: NOW,
      })
    ).toEqual([]);
  });

  it('5 fallos (umbral) no alertan; 6 sí', () => {
    const five = Array.from({ length: BRUTE_FORCE_THRESHOLD }, (_, i) =>
      makeFailedAttempt('atacado@ejemplo.com', i + 1)
    );
    const base = {
      failedAttempts: five,
      adminsWithoutTotp: [],
      graceAccounts: [],
      now: NOW,
    };
    expect(computeSecurityAlerts(base)).toEqual([]);

    const six = [...five, makeFailedAttempt('atacado@ejemplo.com', 30)];
    const alerts = computeSecurityAlerts({ ...base, failedAttempts: six });
    expect(alerts).toHaveLength(1);
    expect(alerts[0]?.type).toBe('BRUTE_FORCE_EMAIL');
    expect(alerts[0]?.severity).toBe('high');
    expect(alerts[0]?.relatedEmail).toBe('atacado@ejemplo.com');
    expect(alerts[0]?.message).toContain('6 intentos fallidos');
  });

  it('los fallos de emails distintos no se suman', () => {
    const attempts = [
      ...Array.from({ length: 4 }, (_, i) => makeFailedAttempt('a@ejemplo.com', i + 1)),
      ...Array.from({ length: 4 }, (_, i) => makeFailedAttempt('b@ejemplo.com', i + 1)),
    ];
    const alerts = computeSecurityAlerts({
      failedAttempts: attempts,
      adminsWithoutTotp: [],
      graceAccounts: [],
      now: NOW,
    });
    expect(alerts).toEqual([]);
  });

  it('admin sin 2FA → alerta media con su email', () => {
    const admin = makeUser({
      id: 'admin-1',
      email: 'admin@ejemplo.com',
      rol: RolUsuario.ADMIN,
      totpEnabled: false,
    });
    const alerts = computeSecurityAlerts({
      failedAttempts: [],
      adminsWithoutTotp: [admin],
      graceAccounts: [],
      now: NOW,
    });
    expect(alerts).toHaveLength(1);
    expect(alerts[0]?.type).toBe('ADMIN_WITHOUT_2FA');
    expect(alerts[0]?.severity).toBe('medium');
    expect(alerts[0]?.relatedEmail).toBe('admin@ejemplo.com');
  });

  it('cuenta en gracia con 5 días → alerta; con 10 días → no', () => {
    const soon = makeUser({
      id: 'g-1',
      email: 'pronto@ejemplo.com',
      eliminacionSolicitadaEn: new Date(NOW.getTime() - 25 * 24 * 60 * 60 * 1000),
    });
    const later = makeUser({
      id: 'g-2',
      email: 'tarde@ejemplo.com',
      eliminacionSolicitadaEn: new Date(NOW.getTime() - 20 * 24 * 60 * 60 * 1000),
    });
    const alerts = computeSecurityAlerts({
      failedAttempts: [],
      adminsWithoutTotp: [],
      graceAccounts: [soon, later],
      now: NOW,
    });
    expect(alerts).toHaveLength(1);
    expect(alerts[0]?.type).toBe('GRACE_PERIOD_ENDING');
    expect(alerts[0]?.relatedEmail).toBe('pronto@ejemplo.com');
    expect(alerts[0]?.message).toContain('5 días');
  });

  it('cuenta en gracia vencida → alerta diciendo que venció', () => {
    const expired = makeUser({
      id: 'g-3',
      email: 'vencida@ejemplo.com',
      eliminacionSolicitadaEn: new Date(NOW.getTime() - 32 * 24 * 60 * 60 * 1000),
    });
    const alerts = computeSecurityAlerts({
      failedAttempts: [],
      adminsWithoutTotp: [],
      graceAccounts: [expired],
      now: NOW,
    });
    expect(alerts).toHaveLength(1);
    expect(alerts[0]?.message).toContain('venció hace 2 días');
  });

  it('ordena por severidad (alta primero) y luego por fecha desc', () => {
    const admin = makeUser({
      id: 'admin-1',
      email: 'admin@ejemplo.com',
      rol: RolUsuario.ADMIN,
      totpEnabled: false,
    });
    const attempts = Array.from({ length: 6 }, (_, i) =>
      makeFailedAttempt('atacado@ejemplo.com', i + 1)
    );
    const alerts = computeSecurityAlerts({
      failedAttempts: attempts,
      adminsWithoutTotp: [admin],
      graceAccounts: [],
      now: NOW,
    });
    expect(alerts).toHaveLength(2);
    expect(alerts[0]?.severity).toBe('high');
    expect(alerts[1]?.severity).toBe('medium');
  });
});
