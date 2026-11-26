/**
 * Tests unitarios para TurnstileService (verificación del captcha en el registro).
 * Mockea axios.post: éxito, rechazo de Cloudflare, error de red y sin clave.
 */

import axios from 'axios';
import { TurnstileService } from '../../../../../src/infrastructure/external-services/auth/TurnstileService';

jest.mock('axios', () => ({
  __esModule: true,
  default: { post: jest.fn() },
}));

const mockedPost = jest.mocked(axios.post);

describe('TurnstileService', () => {
  beforeEach(() => {
    mockedPost.mockReset();
  });

  describe('enabled', () => {
    it('es false sin clave secreta', () => {
      const service = new TurnstileService(undefined);
      expect(service.enabled()).toBe(false);
    });

    it('es false con clave vacía', () => {
      const service = new TurnstileService('');
      expect(service.enabled()).toBe(false);
    });

    it('es true con clave configurada', () => {
      const service = new TurnstileService('clave-secreta');
      expect(service.enabled()).toBe(true);
    });
  });

  describe('verify', () => {
    it('acepta sin llamar a Cloudflare cuando no hay clave', async () => {
      const service = new TurnstileService(undefined);
      await expect(service.verify('cualquier-token')).resolves.toBe(true);
      expect(mockedPost).not.toHaveBeenCalled();
    });

    it('rechaza el token vacío cuando hay clave', async () => {
      const service = new TurnstileService('clave-secreta');
      await expect(service.verify('')).resolves.toBe(false);
      expect(mockedPost).not.toHaveBeenCalled();
    });

    it('devuelve true cuando Cloudflare responde success', async () => {
      mockedPost.mockResolvedValue({ data: { success: true } });
      const service = new TurnstileService('clave-secreta');

      await expect(service.verify('token-valido')).resolves.toBe(true);
      expect(mockedPost).toHaveBeenCalledWith(
        'https://challenges.cloudflare.com/turnstile/v0/siteverify',
        expect.any(URLSearchParams),
        expect.objectContaining({ timeout: 5000 })
      );
    });

    it('devuelve false cuando Cloudflare responde success: false', async () => {
      mockedPost.mockResolvedValue({ data: { success: false } });
      const service = new TurnstileService('clave-secreta');

      await expect(service.verify('token-malo')).resolves.toBe(false);
    });

    it('devuelve false si Cloudflare no responde (fail closed)', async () => {
      mockedPost.mockRejectedValue(new Error('Network Error'));
      const service = new TurnstileService('clave-secreta');

      await expect(service.verify('token-valido')).resolves.toBe(false);
    });
  });
});
