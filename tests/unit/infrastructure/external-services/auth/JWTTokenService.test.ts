/**
 * Tests unitarios para JWTTokenService.
 * Generación y verificación de tokens access/refresh reales (HS256).
 */

process.env['JWT_SECRET'] = 'test-secret-for-unit-tests-0123456789abcdef0123456789abcdef';

import { JWTTokenService } from '../../../../../src/infrastructure/external-services/auth/JWTTokenService';
import * as jwt from 'jsonwebtoken';

const payload = { userId: 'u1', email: 'a@b.com', role: 'USER' };

describe('JWTTokenService', () => {
  let service: JWTTokenService;

  beforeAll(() => {
    service = new JWTTokenService();
  });

  it('constructor exige JWT_SECRET >= 32 chars y no débil', () => {
    const secret = process.env['JWT_SECRET'];
    try {
      process.env['JWT_SECRET'] = 'corto';
      expect(() => new JWTTokenService()).toThrow('32 characters');
      // secreto de 36 chars incluido en la lista de débiles
      process.env['JWT_SECRET'] = 'fallback-secret-change-in-production';
      expect(() => new JWTTokenService()).toThrow('weak secret');
      delete process.env['JWT_SECRET'];
      expect(() => new JWTTokenService()).toThrow('required');
    } finally {
      process.env['JWT_SECRET'] = secret!;
    }
  });

  it('genera access token con claims correctos', async () => {
    const r = (await service.generateAccessToken(payload)) as any;
    expect(r.isSuccess).toBe(true);
    const decoded = jwt.verify(r.value, process.env['JWT_SECRET']!, {
      algorithms: ['HS256'], issuer: 'lista-compra-api', audience: 'lista-compra-client'
    }) as any;
    expect(decoded.type).toBe('access');
    expect(decoded.userId).toBe('u1');
    expect(decoded.role).toBe('USER');
  });

  it('genera refresh token con type=refresh y mayor expiración', async () => {
    const access = (await service.generateAccessToken(payload)) as any;
    const refresh = (await service.generateRefreshToken(payload)) as any;
    const dA = jwt.decode(access.value) as any;
    const dR = jwt.decode(refresh.value) as any;
    expect(dR.exp - dR.iat).toBeGreaterThan(dA.exp - dA.iat);
  });

  it('generateTokenPair devuelve ambos tokens', async () => {
    const r = (await service.generateTokenPair(payload)) as any;
    expect(r.isSuccess).toBe(true);
    expect(r.value.accessToken).toBeTruthy();
    expect(r.value.refreshToken).toBeTruthy();
  });

  it('verifyAccessToken válido devuelve payload con iat/exp', async () => {
    const token = ((await service.generateAccessToken(payload)) as any).value as string;
    const r = (await service.verifyAccessToken(token)) as any;
    expect(r.isSuccess).toBe(true);
    expect(r.value.userId).toBe('u1');
    expect(r.value.iat).toBeDefined();
    expect(r.value.exp).toBeDefined();
  });

  it('verifyAccessToken rechaza refresh token (type incorrecto)', async () => {
    const refresh = ((await service.generateRefreshToken(payload)) as any).value as string;
    const r = (await service.verifyAccessToken(refresh)) as any;
    expect(r.error.message).toContain('no es de acceso');
  });

  it('verifyAccessToken rechaza token malformado (sin campos)', async () => {
    const bad = jwt.sign({ userId: 'u1', type: 'access' }, process.env['JWT_SECRET']!, {
      algorithm: 'HS256', issuer: 'lista-compra-api', audience: 'lista-compra-client'
    });
    const r = (await service.verifyAccessToken(bad)) as any;
    expect(r.error.message).toContain('malformado');
  });

  it('verifyAccessToken rechaza firma inválida y expirado', async () => {
    const r = (await service.verifyAccessToken('no-es-un-jwt')) as any;
    expect(r.error.message).toContain('inválido');

    const expired = jwt.sign({ ...payload, type: 'access' }, process.env['JWT_SECRET']!, {
      algorithm: 'HS256', expiresIn: '1ms'
    });
    await new Promise(res => setTimeout(res, 30));
    const r2 = (await service.verifyAccessToken(expired)) as any;
    expect(r2.error.message).toContain('expirado');
  });

  it('verifyRefreshToken válido y rechaza access token', async () => {
    const refresh = ((await service.generateRefreshToken(payload)) as any).value as string;
    const r = (await service.verifyRefreshToken(refresh)) as any;
    expect(r.isSuccess).toBe(true);

    const access = ((await service.generateAccessToken(payload)) as any).value as string;
    const r2 = (await service.verifyRefreshToken(access)) as any;
    expect(r2.error.message).toContain('no es de refresh');
  });

  it('verifyRefreshToken rechaza malformado, inválido y expirado', async () => {
    const bad = jwt.sign({ userId: 'u1', type: 'refresh' }, process.env['JWT_SECRET']!, {
      algorithm: 'HS256', issuer: 'lista-compra-api', audience: 'lista-compra-client'
    });
    expect(((await service.verifyRefreshToken(bad)) as any).error.message).toContain('malformado');
    expect(((await service.verifyRefreshToken('pepe')) as any).error.message).toContain('inválido');

    const expired = jwt.sign({ ...payload, type: 'refresh' }, process.env['JWT_SECRET']!, {
      algorithm: 'HS256', expiresIn: '1ms'
    });
    await new Promise(res => setTimeout(res, 30));
    expect(((await service.verifyRefreshToken(expired)) as any).error.message).toContain('expirado');
  });

  it('extractTokenFromHeader valida formato Bearer', () => {
    expect(((service.extractTokenFromHeader('Bearer tok123')) as any).value).toBe('tok123');
    expect(((service.extractTokenFromHeader('') as any)).isFailure).toBe(true);
    expect(((service.extractTokenFromHeader(undefined as any)) as any).isFailure).toBe(true);
    expect(((service.extractTokenFromHeader('Basic tok')) as any).error.message).toContain('Bearer');
    expect(((service.extractTokenFromHeader('Bearer')) as any).isFailure).toBe(true);
  });

  it('isTokenNearExpiry detecta proximidad de expiración', async () => {
    const token = jwt.sign({ userId: 'u1' }, process.env['JWT_SECRET']!, { expiresIn: '1h' });
    const far = ((await service.isTokenNearExpiry(token)) as any).value;
    expect(far).toBe(false);

    const tokenExp = jwt.sign({ userId: 'u1' }, process.env['JWT_SECRET']!, { expiresIn: '1ms' });
    const near = ((await service.isTokenNearExpiry(tokenExp, 5)) as any).value;
    expect(near).toBe(true);

    expect(((await service.isTokenNearExpiry('no-jwt')) as any).isFailure).toBe(true);
  });

  it('getTokenTTL devuelve segundos restantes (nunca negativos)', async () => {
    const token = jwt.sign({ userId: 'u1' }, process.env['JWT_SECRET']!, { expiresIn: '1h' });
    const r = (await service.getTokenTTL(token)) as any;
    expect(r.isSuccess).toBe(true);
    expect(r.value).toBeGreaterThan(0);
    expect(r.value).toBeLessThanOrEqual(3600);

    expect(((await service.getTokenTTL('no-jwt')) as any).isFailure).toBe(true);
  });
});
