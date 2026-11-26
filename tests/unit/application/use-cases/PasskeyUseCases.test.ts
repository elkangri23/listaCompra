/**
 * Tests unitarios — use cases de passkeys (CU-MFA fase 2)
 * Todos los usos de @simplewebauthn/server se mockean: los tests cubren la
 * lógica de negocio (step-up, challenges, política de contador, tope de 5).
 */

import { success, failure } from '@shared/result';

jest.mock('@simplewebauthn/server', () => ({
  generateRegistrationOptions: jest.fn(),
  verifyRegistrationResponse: jest.fn(),
  generateAuthenticationOptions: jest.fn(),
  verifyAuthenticationResponse: jest.fn(),
}));

import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import { RegisterPasskeyOptions, MAX_PASSKEYS } from '@application/use-cases/auth/RegisterPasskeyOptions';
import { RegisterPasskeyVerify } from '@application/use-cases/auth/RegisterPasskeyVerify';
import { ListPasskeys, RenamePasskey, DeletePasskey } from '@application/use-cases/auth/PasskeyCrud';
import { PasskeyLoginOptions, PasskeyLoginVerify } from '@application/use-cases/auth/PasskeyLogin';
import { StepUpPasswordVerifier } from '@application/use-cases/auth/StepUpPasswordVerifier';
import type { IMfaRepository, MfaChallengeData } from '@application/ports/repositories/IMfaRepository';
import type { IPasskeyRepository, PasskeyCredentialData } from '@application/ports/repositories/IPasskeyRepository';
import type { IUsuarioRepository } from '@application/ports/repositories/IUsuarioRepository';
import type { ITokenService } from '@application/ports/auth/ITokenService';
import {
  PasskeyLimitReachedError,
  PasskeyNotFoundError,
  PasskeyUnknownCredentialError,
  PasskeyInactiveError,
  PasskeyVerificationError,
  MfaChallengeExpiredError,
} from '@domain/errors/MfaError';
import { UnauthorizedError } from '@application/errors/UnauthorizedError';
import { NotFoundError } from '@application/errors/NotFoundError';

const mockedGenerateRegistrationOptions = generateRegistrationOptions as jest.Mock;
const mockedVerifyRegistration = verifyRegistrationResponse as jest.Mock;
const mockedGenerateAuthenticationOptions = generateAuthenticationOptions as jest.Mock;
const mockedVerifyAuthentication = verifyAuthenticationResponse as jest.Mock;

// ============================================================================
// Fakes
// ============================================================================

function val<T>(v: T) {
  return success(v);
}
function err<E>(e: E) {
  return failure(e);
}
/** TS exige narrowing del Result: helpers de test para acceder sin casts por sitio */
function narrowErr(r: { isSuccess: boolean; error?: unknown }): unknown {
  if (!r.isSuccess) return r.error;
  throw new Error('éxito inesperado');
}
function narrowVal(r: { isSuccess: boolean; error?: unknown; value?: unknown }): any {
  if (r.isSuccess) return r.value;
  throw new Error(`fallo inesperado: ${String(r.error)}`);
}

function makeChallenge(overrides: Partial<MfaChallengeData> = {}): MfaChallengeData {
  return {
    id: 'ch-1',
    usuarioId: 'u1',
    tipo: 'PASSKEY_REG',
    challenge: 'b64url-challenge',
    intentos: 0,
    expiraAt: new Date(Date.now() + 60_000),
    ...overrides,
  };
}

function makePasskey(overrides: Partial<PasskeyCredentialData> = {}): PasskeyCredentialData {
  return {
    id: 'pk-1',
    credentialId: 'cred-b64url',
    usuarioId: 'u1',
    publicKey: Buffer.from([1, 2, 3]),
    contador: 0,
    transports: ['internal'],
    deviceType: 'singleDevice',
    aaguid: null,
    nombre: 'Passkey',
    activo: true,
    createdAt: new Date(),
    ultimoUso: null,
    ...overrides,
  };
}

// ============================================================================
// Shared mocks
// ============================================================================

const stepUp = {
  verify: jest.fn(),
} as unknown as StepUpPasswordVerifier;
const stepUpMock = stepUp.verify as unknown as jest.Mock;

const mfaRepo: jest.Mocked<IMfaRepository> = {
  createWebauthnChallenge: jest.fn(),
  revokeLiveChallenges: jest.fn(),
  createTotpChallenge: jest.fn(),
  findChallengeById: jest.fn(),
  deleteChallenge: jest.fn(),
  incrementChallengeAttempts: jest.fn(),
  deleteExpiredChallenges: jest.fn(),
  listActiveBackupCodes: jest.fn(),
  replaceBackupCodes: jest.fn(),
  consumeBackupCode: jest.fn(),
  countActiveBackupCodes: jest.fn(),
  deleteBackupCodes: jest.fn(),
} as unknown as jest.Mocked<IMfaRepository>;

const passkeyRepo: jest.Mocked<IPasskeyRepository> = {
  create: jest.fn(),
  findByCredentialId: jest.fn(),
  findById: jest.fn(),
  listByUsuario: jest.fn(),
  countByUsuario: jest.fn(),
  rename: jest.fn(),
  updateCounterAndUsage: jest.fn(),
  deactivate: jest.fn(),
  delete: jest.fn(),
} as unknown as jest.Mocked<IPasskeyRepository>;

const usuarioRepo = {
  findById: jest.fn(),
} as unknown as jest.Mocked<IUsuarioRepository>;

const tokenService = {
  generateTokenPair: jest.fn(),
} as unknown as jest.Mocked<ITokenService>;

function makeStepUpOk() {
  stepUpMock.mockResolvedValue(val({ id: 'u1', email: { value: 'ana@test.es' }, rol: 'USUARIO', activo: true } as never));
}
function makeStepUpFail() {
  stepUpMock.mockResolvedValue(err(UnauthorizedError.invalidCredentials()));
}

const USUARIO_OK = {
  id: 'u1',
  email: { value: 'ana@test.es' },
  nombre: 'Ana',
  nombreCompleto: 'Ana Test',
  rol: 'USUARIO',
  activo: true,
  emailVerificado: true,
  apellidos: null,
} as never;

// ============================================================================
// RegisterPasskeyOptions
// ============================================================================

describe('RegisterPasskeyOptions', () => {
  const useCase = new RegisterPasskeyOptions(stepUp, mfaRepo, passkeyRepo);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('step-up incorrecto → UnauthorizedError sin tocar repos', async () => {
    makeStepUpFail();
    const result = await useCase.execute({ usuarioId: 'u1' as never, email: 'ana@test.es', password: 'mal' });
    expect(result.isFailure).toBe(true);
    expect(narrowErr(result)).toBeInstanceOf(UnauthorizedError);
    expect(mockedGenerateRegistrationOptions).not.toHaveBeenCalled();
  });

  it('5 passkeys activas → PASSKEY_LIMIT_REACHED (409)', async () => {
    makeStepUpOk();
    passkeyRepo.countByUsuario.mockResolvedValue(val(5));
    const result = await useCase.execute({ usuarioId: 'u1' as never, email: 'ana@test.es', password: 'ok' });
    expect(result.isFailure).toBe(true);
    expect(narrowErr(result)).toBeInstanceOf(PasskeyLimitReachedError);
  });

  it('genera opciones con residentKey required y challenge PASSKEY_REG de 5 min', async () => {
    makeStepUpOk();
    passkeyRepo.countByUsuario.mockResolvedValue(val(2));
    passkeyRepo.listByUsuario.mockResolvedValue(val([makePasskey()]));
    mockedGenerateRegistrationOptions.mockResolvedValue({ challenge: 'abc', rp: {}, user: {}, authenticatorSelection: {} });
    mfaRepo.createWebauthnChallenge.mockResolvedValue(val(makeChallenge()));

    const result = await useCase.execute({ usuarioId: 'u1' as never, email: 'ana@test.es', password: 'ok' });

    expect(result.isSuccess).toBe(true);
    expect(narrowVal(result).challengeId).toBe('ch-1');
    expect(mockedGenerateRegistrationOptions).toHaveBeenCalledWith(
      expect.objectContaining({
        rpID: expect.any(String),
        userName: 'ana@test.es',
        attestationType: 'none',
        authenticatorSelection: expect.objectContaining({
          residentKey: 'required',
          userVerification: 'required',
        }),
        excludeCredentials: [expect.objectContaining({ id: 'cred-b64url' })],
        supportedAlgorithmIDs: [-7, -257],
      })
    );
    expect(mfaRepo.createWebauthnChallenge).toHaveBeenCalledWith(
      expect.objectContaining({ usuarioId: 'u1', tipo: 'PASSKEY_REG', ttlSeconds: 300 })
    );
  });
});

// ============================================================================
// RegisterPasskeyVerify
// ============================================================================

describe('RegisterPasskeyVerify', () => {
  const useCase = new RegisterPasskeyVerify(stepUp, mfaRepo, passkeyRepo);

  beforeEach(() => {
    jest.clearAllMocks();
    makeStepUpOk();
    passkeyRepo.countByUsuario.mockResolvedValue(val(0));
  });

  const dto = {
    usuarioId: 'u1' as never,
    email: 'ana@test.es',
    password: 'ok',
    challengeId: 'ch-1',
    credential: { id: 'cred', rawId: 'cred', type: 'public-key' } as never,
  };

  it('challenge inexistente/expirado o de otro usuario → CHALLENGE_EXPIRED', async () => {
    mfaRepo.findChallengeById.mockResolvedValue(val(null));
    const result = await useCase.execute(dto);
    expect(narrowErr(result)).toBeInstanceOf(MfaChallengeExpiredError);

    mfaRepo.findChallengeById.mockResolvedValue(val(makeChallenge({ usuarioId: 'otro' })));
    const result2 = await useCase.execute(dto);
    expect(narrowErr(result2)).toBeInstanceOf(MfaChallengeExpiredError);

    mfaRepo.findChallengeById.mockResolvedValue(val(makeChallenge({ tipo: 'PASSKEY_LOGIN' })));
    const result3 = await useCase.execute(dto);
    expect(narrowErr(result3)).toBeInstanceOf(MfaChallengeExpiredError);
  });

  it('challenge expirado → se borra y 410', async () => {
    mfaRepo.findChallengeById.mockResolvedValue(val(makeChallenge({ expiraAt: new Date(Date.now() - 1000) })));
    const result = await useCase.execute(dto);
    expect(mfaRepo.deleteChallenge).toHaveBeenCalledWith('ch-1');
    expect(narrowErr(result)).toBeInstanceOf(MfaChallengeExpiredError);
  });

  it('verificación fallida → challenge borrado + PASSKEY_VERIFICATION_FAILED', async () => {
    mfaRepo.findChallengeById.mockResolvedValue(val(makeChallenge()));
    mockedVerifyRegistration.mockResolvedValue({ verified: false, registrationInfo: undefined });
    const result = await useCase.execute(dto);
    expect(mfaRepo.deleteChallenge).toHaveBeenCalledWith('ch-1');
    expect(narrowErr(result)).toBeInstanceOf(PasskeyVerificationError);
  });

  it('excepción de la lib → challenge borrado + PASSKEY_VERIFICATION_FAILED', async () => {
    mfaRepo.findChallengeById.mockResolvedValue(val(makeChallenge()));
    mockedVerifyRegistration.mockRejectedValue(new Error('bad attestation'));
    const result = await useCase.execute(dto);
    expect(mfaRepo.deleteChallenge).toHaveBeenCalledWith('ch-1');
    expect(narrowErr(result)).toBeInstanceOf(PasskeyVerificationError);
  });

  it('éxito: persiste credencial (deviceType/aaguid/publicKey) y consume challenge', async () => {
    mfaRepo.findChallengeById.mockResolvedValue(val(makeChallenge()));
    mockedVerifyRegistration.mockResolvedValue({
      verified: true,
      registrationInfo: {
        credential: { id: 'cred-nuevo', publicKey: new Uint8Array([9, 9]), counter: 0, transports: ['internal'] },
        credentialDeviceType: 'multiDevice',
        aaguid: '00000000-0000-0000-0000-000000000000',
      },
    });
    passkeyRepo.create.mockResolvedValue(val(makePasskey({ credentialId: 'cred-nuevo', deviceType: 'multiDevice' })));

    const result = await useCase.execute(dto);

    expect(result.isSuccess).toBe(true);
    expect(passkeyRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        credentialId: 'cred-nuevo',
        usuarioId: 'u1',
        deviceType: 'multiDevice',
        aaguid: '00000000-0000-0000-0000-000000000000',
      })
    );
    expect(mfaRepo.deleteChallenge).toHaveBeenCalledWith('ch-1');
  });

  it('carrera: tope de 5 alcanzado al verificar → 409 y challenge borrado', async () => {
    mfaRepo.findChallengeById.mockResolvedValue(val(makeChallenge()));
    mockedVerifyRegistration.mockResolvedValue({
      verified: true,
      registrationInfo: {
        credential: { id: 'c', publicKey: new Uint8Array([1]), counter: 0, transports: [] },
        credentialDeviceType: 'singleDevice',
        aaguid: '',
      },
    });
    passkeyRepo.countByUsuario.mockResolvedValue(val(MAX_PASSKEYS));
    const result = await useCase.execute(dto);
    expect(narrowErr(result)).toBeInstanceOf(PasskeyLimitReachedError);
    expect(mfaRepo.deleteChallenge).toHaveBeenCalledWith('ch-1');
    expect(passkeyRepo.create).not.toHaveBeenCalled();
  });
});

// ============================================================================
// CRUD
// ============================================================================

describe('ListPasskeys / RenamePasskey / DeletePasskey', () => {
  beforeEach(() => jest.clearAllMocks());

  it('ListPasskeys mapea los campos del DTO', async () => {
    passkeyRepo.listByUsuario.mockResolvedValue(val([makePasskey()]));
    const useCase = new ListPasskeys(passkeyRepo);
    const result = await useCase.execute('u1' as never);
    expect(narrowVal(result)[0]).toMatchObject({
      id: 'pk-1',
      nombre: 'Passkey',
      deviceType: 'singleDevice',
      transports: ['internal'],
      activo: true,
    });
  });

  it('RenamePasskey de credencial ajena o inexistente → 404', async () => {
    const useCase = new RenamePasskey(passkeyRepo);
    passkeyRepo.findById.mockResolvedValue(val(null));
    expect(narrowErr(await useCase.execute({ usuarioId: 'u1' as never, passkeyId: 'x', nombre: 'n' }))).toBeInstanceOf(PasskeyNotFoundError);

    passkeyRepo.findById.mockResolvedValue(val(makePasskey({ usuarioId: 'otro' as never })));
    expect(narrowErr(await useCase.execute({ usuarioId: 'u1' as never, passkeyId: 'pk-1', nombre: 'n' }))).toBeInstanceOf(PasskeyNotFoundError);
  });

  it('RenamePasskey feliz renombra', async () => {
    const useCase = new RenamePasskey(passkeyRepo);
    passkeyRepo.findById.mockResolvedValue(val(makePasskey()));
    passkeyRepo.rename.mockResolvedValue(val(undefined));
    const result = await useCase.execute({ usuarioId: 'u1' as never, passkeyId: 'pk-1', nombre: 'MacBook de Ana' });
    expect(result.isSuccess).toBe(true);
    expect(narrowVal(result).passkey.nombre).toBe('MacBook de Ana');
    expect(passkeyRepo.rename).toHaveBeenCalledWith('pk-1', 'MacBook de Ana');
  });

  it('DeletePasskey exige step-up (401 si falla)', async () => {
    makeStepUpFail();
    const useCase = new DeletePasskey(stepUp, passkeyRepo);
    const result = await useCase.execute({ usuarioId: 'u1' as never, passkeyId: 'pk-1', password: 'mal' });
    expect(narrowErr(result)).toBeInstanceOf(UnauthorizedError);
    expect(passkeyRepo.delete).not.toHaveBeenCalled();
  });

  it('DeletePasskey feliz borra', async () => {
    makeStepUpOk();
    const useCase = new DeletePasskey(stepUp, passkeyRepo);
    passkeyRepo.findById.mockResolvedValue(val(makePasskey()));
    passkeyRepo.delete.mockResolvedValue(val(undefined));
    const result = await useCase.execute({ usuarioId: 'u1' as never, passkeyId: 'pk-1', password: 'ok' });
    expect(narrowVal(result)).toEqual({ deleted: true });
  });
});

// ============================================================================
// PasskeyLoginOptions / PasskeyLoginVerify
// ============================================================================

describe('PasskeyLoginOptions', () => {
  it('challenge PASSKEY_LOGIN con usuarioId null y TTL 2 min', async () => {
    mfaRepo.createWebauthnChallenge.mockResolvedValue(val(makeChallenge({ tipo: 'PASSKEY_LOGIN', usuarioId: null })));
    mockedGenerateAuthenticationOptions.mockResolvedValue({ challenge: 'c2', rpId: 'localhost', allowCredentials: [] });
    const useCase = new PasskeyLoginOptions(mfaRepo);
    const result = await useCase.execute();
    expect(narrowVal(result).challengeId).toBe('ch-1');
    expect(mockedGenerateAuthenticationOptions).toHaveBeenCalledWith(
      expect.objectContaining({ allowCredentials: [], userVerification: 'required' })
    );
    expect(mfaRepo.createWebauthnChallenge).toHaveBeenCalledWith(
      expect.objectContaining({ usuarioId: null, tipo: 'PASSKEY_LOGIN', ttlSeconds: 120 })
    );
  });
});

describe('PasskeyLoginVerify', () => {
  const useCase = new PasskeyLoginVerify(mfaRepo, passkeyRepo, usuarioRepo, tokenService);
  const assertion = { id: 'cred-b64url', rawId: 'cred-b64url', type: 'public-key', response: {} } as never;

  beforeEach(() => jest.clearAllMocks());

  it('challenge inexistente → CHALLENGE_EXPIRED', async () => {
    mfaRepo.findChallengeById.mockResolvedValue(val(null));
    expect(narrowErr(await useCase.execute({ challengeId: 'x', credential: assertion }))).toBeInstanceOf(MfaChallengeExpiredError);
  });

  it('challenge expirado → borra y 410', async () => {
    mfaRepo.findChallengeById.mockResolvedValue(val(makeChallenge({ tipo: 'PASSKEY_LOGIN', usuarioId: null, expiraAt: new Date(Date.now() - 1) })));
    const result = await useCase.execute({ challengeId: 'ch-1', credential: assertion });
    expect(mfaRepo.deleteChallenge).toHaveBeenCalled();
    expect(narrowErr(result)).toBeInstanceOf(MfaChallengeExpiredError);
  });

  it('credentialId desconocido → PASSKEY_UNKNOWN_CREDENTIAL', async () => {
    mfaRepo.findChallengeById.mockResolvedValue(val(makeChallenge({ tipo: 'PASSKEY_LOGIN', usuarioId: null })));
    passkeyRepo.findByCredentialId.mockResolvedValue(val(null));
    const result = await useCase.execute({ challengeId: 'ch-1', credential: assertion });
    expect(narrowErr(result)).toBeInstanceOf(PasskeyUnknownCredentialError);
  });

  it('passkey bloqueada (activo=false) → PASSKEY_INACTIVE', async () => {
    mfaRepo.findChallengeById.mockResolvedValue(val(makeChallenge({ tipo: 'PASSKEY_LOGIN', usuarioId: null })));
    passkeyRepo.findByCredentialId.mockResolvedValue(val(makePasskey({ activo: false })));
    const result = await useCase.execute({ challengeId: 'ch-1', credential: assertion });
    expect(narrowErr(result)).toBeInstanceOf(PasskeyInactiveError);
  });

  it('aserción inválida → PASSKEY_VERIFICATION_FAILED', async () => {
    mfaRepo.findChallengeById.mockResolvedValue(val(makeChallenge({ tipo: 'PASSKEY_LOGIN', usuarioId: null })));
    passkeyRepo.findByCredentialId.mockResolvedValue(val(makePasskey()));
    mockedVerifyAuthentication.mockResolvedValue({ verified: false });
    const result = await useCase.execute({ challengeId: 'ch-1', credential: assertion });
    expect(narrowErr(result)).toBeInstanceOf(PasskeyVerificationError);
  });

  it('login feliz: emite tokens sin pedir TOTP (D2) y actualiza contador', async () => {
    mfaRepo.findChallengeById.mockResolvedValue(val(makeChallenge({ tipo: 'PASSKEY_LOGIN', usuarioId: null })));
    passkeyRepo.findByCredentialId.mockResolvedValue(val(makePasskey()));
    mockedVerifyAuthentication.mockResolvedValue({ verified: true, authenticationInfo: { newCounter: 5 } });
    usuarioRepo.findById.mockResolvedValue(val(USUARIO_OK));
    tokenService.generateTokenPair.mockResolvedValue(val({ accessToken: 'at', refreshToken: 'rt' } as never));

    const result = await useCase.execute({ challengeId: 'ch-1', credential: assertion });

    expect(result.isSuccess).toBe(true);
    expect(narrowVal(result).mfaInfo.method).toBe('PASSKEY');
    expect(narrowVal(result).tokens.accessToken).toBe('at');
    expect(mfaRepo.deleteChallenge).toHaveBeenCalledWith('ch-1');
    expect(passkeyRepo.updateCounterAndUsage).toHaveBeenCalledWith('pk-1', 5);
  });

  it('política de contador: stored=0 ∧ assertion=0 → aceptar (passkeys sincronizadas)', async () => {
    mfaRepo.findChallengeById.mockResolvedValue(val(makeChallenge({ tipo: 'PASSKEY_LOGIN', usuarioId: null })));
    passkeyRepo.findByCredentialId.mockResolvedValue(val(makePasskey({ contador: 0 })));
    mockedVerifyAuthentication.mockResolvedValue({ verified: true, authenticationInfo: { newCounter: 0 } });
    usuarioRepo.findById.mockResolvedValue(val(USUARIO_OK));
    tokenService.generateTokenPair.mockResolvedValue(val({ accessToken: 'at', refreshToken: 'rt' } as never));

    const result = await useCase.execute({ challengeId: 'ch-1', credential: assertion });
    expect(result.isSuccess).toBe(true);
    expect(passkeyRepo.deactivate).not.toHaveBeenCalled();
  });

  it('política de contador: stored>0 ∧ assertion≤stored → REGRESIÓN: activo=false y rechazo', async () => {
    mfaRepo.findChallengeById.mockResolvedValue(val(makeChallenge({ tipo: 'PASSKEY_LOGIN', usuarioId: null })));
    passkeyRepo.findByCredentialId.mockResolvedValue(val(makePasskey({ contador: 10 })));
    mockedVerifyAuthentication.mockResolvedValue({ verified: true, authenticationInfo: { newCounter: 10 } });

    const result = await useCase.execute({ challengeId: 'ch-1', credential: assertion });
    expect(passkeyRepo.deactivate).toHaveBeenCalledWith('pk-1');
    expect(narrowErr(result)).toBeInstanceOf(PasskeyVerificationError);
    expect(tokenService.generateTokenPair).not.toHaveBeenCalled();
  });
});

// ============================================================================
// StepUpPasswordVerifier
// ============================================================================

describe('StepUpPasswordVerifier', () => {
  it('usuario inexistente → NotFoundError', async () => {
    const verifier = new (StepUpPasswordVerifier as any)(usuarioRepo, { verify: jest.fn() });
    usuarioRepo.findById.mockResolvedValue(val(null));
    const result = await verifier.verify('u1' as never, 'x');
    expect(narrowErr(result)).toBeInstanceOf(NotFoundError);
  });
});
