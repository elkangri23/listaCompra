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

describe('AIConfigService — persistencia en .env (Opción B)', () => {
  const fs = require('fs');
  const os = require('os');
  // Directorio temporal del sistema: la ruta fija de Windows no existe en el runner Linux de CI
  const tmp = os.tmpdir();
  let envPath: string;
  let prevNodeEnv: string | undefined;
  let prevEnvFilePath: string | undefined;

  const makeServiceWithPersist = (initial?: any) =>
    new (require('../../../../src/infrastructure/config/AIConfigService').AIConfigService)(initial, true);

  beforeEach(() => {
    envPath = `${tmp}/ai-env-${Date.now()}.env`;
    fs.writeFileSync(
      envPath,
      'AI_PROVIDER=freellmapi\nFREE_LLMAPI_API_KEY=clave-anterior-1234567890abcdef\n'
    );
    prevNodeEnv = process.env['NODE_ENV'];
    prevEnvFilePath = process.env['ENV_FILE_PATH'];
    process.env['NODE_ENV'] = 'development';
    process.env['ENV_FILE_PATH'] = envPath;
  });

  afterEach(() => {
    if (prevNodeEnv === undefined) delete process.env['NODE_ENV'];
    else process.env['NODE_ENV'] = prevNodeEnv;
    if (prevEnvFilePath === undefined) delete process.env['ENV_FILE_PATH'];
    else process.env['ENV_FILE_PATH'] = prevEnvFilePath;
    if (fs.existsSync(envPath)) fs.unlinkSync(envPath);
  });

  it('update() escribe proveedor y variables del proveedor en .env', () => {
    const initial = {
      provider: 'freellmapi',
      apiKey: 'clave-anterior-1234567890abcdef',
      apiUrl: 'https://api.electronhub.ai/v1',
      model: 'gpt-4o-mini',
      temperature: 0.7,
      maxTokens: 1000,
      timeout: 30000,
      cache: { enabled: true, ttl: 3600 },
      rateLimit: { requestsPerMinute: 10 }
    };
    const service = makeServiceWithPersist(initial);

    service.update({
      provider: 'anthropic',
      apiKey: 'sk-ant-api03-clave-nueva-larga-suficiente-123456789',
      model: 'claude-3-5-haiku-20241022',
      apiUrl: 'https://api.anthropic.com'
    });

    const out = fs.readFileSync(envPath, 'utf-8');
    expect(out).toContain('AI_PROVIDER=anthropic');
    expect(out).toMatch(/ANTHROPIC_API_KEY=sk-ant-api03/);
    expect(out).toContain('ANTHROPIC_MODEL=claude-3-5-haiku-20241022');
    expect(out).toContain('ANTHROPIC_API_URL=https://api.anthropic.com');
    // la variable del proveedor anterior se mantiene (histórica)
    expect(out).toContain('FREE_LLMAPI_API_KEY=clave-anterior');
  });

  it('update() sin cambio de proveedor actualiza su key', () => {
    const initial = {
      provider: 'freellmapi',
      apiKey: 'clave-anterior-1234567890abcdef',
      apiUrl: '',
      model: 'gpt-4o-mini',
      temperature: 0.7,
      maxTokens: 1000,
      timeout: 30000,
      cache: { enabled: false, ttl: 3600 },
      rateLimit: { requestsPerMinute: 10 }
    };
    const service = makeServiceWithPersist(initial);

    service.update({ apiKey: 'clave-actualizada-9876543210abcdef' });

    const out = fs.readFileSync(envPath, 'utf-8');
    expect(out).toContain('AI_PROVIDER=freellmapi');
    expect(out).toContain('FREE_LLMAPI_API_KEY=clave-actualizada-9876543210abcdef');
  });

  it('si la escritura del .env falla, el cambio en memoria sigue aplicado', () => {
    const initial = {
      provider: 'freellmapi',
      apiKey: 'clave-anterior-1234567890abcdef',
      apiUrl: '',
      model: 'm',
      temperature: 0.7,
      maxTokens: 1000,
      timeout: 30000,
      cache: { enabled: false, ttl: 3600 },
      rateLimit: { requestsPerMinute: 10 }
    };
    const service = makeServiceWithPersist(initial);
    process.env['ENV_FILE_PATH'] = `${tmp}/dir-no-existe/env.env`;

    const result = service.update({ apiKey: 'clave-otra-mas-larga-aaaa-bbbb-cccc' });
    expect(result.apiKey).toBe('clave-otra-mas-larga-aaaa-bbbb-cccc');
    expect(service.get().apiKey).toBe('clave-otra-mas-larga-aaaa-bbbb-cccc');
  });
});
