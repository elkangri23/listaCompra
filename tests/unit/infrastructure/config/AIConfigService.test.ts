/**
 * Tests CRÍTICOS - AIConfigService (CU-31: selección de proveedor LLM)
 * Configuración IA en runtime: inicialización desde env, actualización
 * en caliente y enmascaramiento seguro de la API key.
 */

process.env['PERPLEXITY_API_KEY'] = 'pplx-abcdefghijklmnopqrstuvwxyz0123456789';
process.env['AI_PROVIDER'] = 'perplexity';

import { AIConfigService } from '@infrastructure/config/AIConfigService';

describe('AIConfigService (CU-31)', () => {
  describe('inicialización', () => {
    it('debe inicializarse desde variables de entorno', () => {
      const service = new AIConfigService();

      expect(service.get().provider).toBe('perplexity');
      expect(service.get().apiKey).toBe('pplx-abcdefghijklmnopqrstuvwxyz0123456789');
      expect(service.isConfigured()).toBe(true);
    });

    it('debe quedar no configurado si la key es corta', () => {
      const service = new AIConfigService({
        provider: 'perplexity',
        apiKey: 'corta',
        apiUrl: 'https://api.perplexity.ai',
        model: 'llama-3.1-sonar-small-128k-online',
        temperature: 0.7,
        maxTokens: 1000,
        timeout: 30000,
        cache: { enabled: false, ttl: 3600 },
        rateLimit: { requestsPerMinute: 10 },
      });

      expect(service.isConfigured()).toBe(false);
    });
  });

  describe('getSafe', () => {
    it('NUNCA debe exponer la API key completa', () => {
      const service = new AIConfigService();
      const safe = service.getSafe();

      expect(JSON.stringify(safe)).not.toContain('apiKey":');
      expect(safe.apiKeyConfigured).toBe(true);
      expect(safe.apiKeyMasked).toContain('...');
      expect(JSON.stringify(safe)).not.toContain('pplx-abcdefghijklmnopqrstuvwxyz');
    });
  });

  describe('update', () => {
    const makeService = () =>
      new AIConfigService({
        provider: 'perplexity',
        apiKey: 'pplx-abcdefghijklmnopqrstuvwxyz0123456789',
        apiUrl: 'https://api.perplexity.ai',
        model: 'llama-3.1-sonar-small-128k-online',
        temperature: 0.7,
        maxTokens: 1000,
        timeout: 30000,
        cache: { enabled: false, ttl: 3600 },
        rateLimit: { requestsPerMinute: 10 },
      });

    it('debe actualizar provider, model y apiUrl', () => {
      const service = makeService();

      const updated = service.update({
        provider: 'openrouter',
        model: 'openai/gpt-4o-mini',
        apiUrl: 'https://openrouter.ai/api/v1',
      });

      expect(updated.provider).toBe('openrouter');
      expect(updated.model).toBe('openai/gpt-4o-mini');
      expect(updated.apiUrl).toBe('https://openrouter.ai/api/v1');
      // La key se conserva
      expect(updated.apiKey).toBe('pplx-abcdefghijklmnopqrstuvwxyz0123456789');
    });

    it('debe actualizar la API key si viene no vacía', () => {
      const service = makeService();
      const nuevaKey = 'sk-openrouter-abcdefghijklmnopqrstuvwxyz012345';

      service.update({ apiKey: nuevaKey });

      expect(service.get().apiKey).toBe(nuevaKey);
    });

    it('debe conservar la key actual si la nueva es vacía', () => {
      const service = makeService();

      service.update({ apiKey: '' });

      expect(service.get().apiKey).toBe('pplx-abcdefghijklmnopqrstuvwxyz0123456789');
    });

    it.each([
      [{ apiKey: 'corta' }, 'al menos 32 caracteres'],
      [{ temperature: 2 }, 'entre 0.0 y 1.0'],
      [{ maxTokens: 5000 }, 'entre 1 y 4000'],
    ])('debe rechazar %j (%s)', (dto, mensaje) => {
      const service = makeService();

      expect(() => service.update(dto as never)).toThrow(mensaje);
      // La configuración previa queda intacta
      expect(service.get().provider).toBe('perplexity');
    });
  });
});
