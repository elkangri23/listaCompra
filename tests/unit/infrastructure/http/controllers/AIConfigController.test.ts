/**
 * Tests unitarios para AIConfigController (CU-31, panel admin IA).
 */

import { AIConfigController } from '../../../../../src/infrastructure/http/controllers/AIConfigController';

const makeReq = (over: Record<string, unknown> = {}) =>
  ({
    body: {},
    ...over
  }) as any;

const makeRes = () => {
  const res: any = { statusCode: 0, body: undefined };
  res.status = jest.fn((c: number) => { res.statusCode = c; return res; });
  res.json = jest.fn((b: unknown) => { res.body = b; return res; });
  return res;
};

const makeServices = (over: Record<string, unknown> = {}) => ({
  config: {
    getSafe: jest.fn().mockReturnValue({ provider: 'freellmapi', model: 'gpt-4o-mini', apiUrl: 'https://api', maskedApiKey: 'k***' }),
    get: jest.fn().mockReturnValue({ provider: 'freellmapi', model: 'gpt-4o-mini', apiUrl: 'https://api', apiKey: 'sk-12345678901234567890123456789012' }),
    update: jest.fn().mockReturnValue({ provider: 'openai', model: 'm', apiUrl: 'https://api2', apiKey: 'x' }),
    isConfigured: jest.fn().mockReturnValue(true),
    ...over
  },
  ai: {
    updateConfig: jest.fn(),
    generateCategorySuggestions: jest.fn()
  }
});

jest.mock('axios', () => ({
  __esModule: true,
  default: { post: jest.fn() }
}));

describe('AIConfigController', () => {
  let services: ReturnType<typeof makeServices>;
  let controller: AIConfigController;

  beforeEach(() => {
    services = makeServices();
    controller = new AIConfigController(services.config as any, services.ai as any);
  });

  describe('getConfig', () => {
    it('200 con config sin key', async () => {
      const res = makeRes();
      await controller.getConfig(makeReq(), res);
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.maskedApiKey).toBe('k***');
      expect(res.body.data.proveedores).toContain('AI_PROVIDERS');
    });
  });

  describe('updateConfig', () => {
    it('200 aplica en caliente y persiste', async () => {
      const req = makeReq({ body: { provider: 'openai' } });
      const res = makeRes();
      await controller.updateConfig(req, res);
      expect(services.config.update).toHaveBeenCalledWith({ provider: 'openai' });
      expect(services.ai.updateConfig).toHaveBeenCalled();
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('400 con mensaje de validación', async () => {
      services.config.update.mockImplementation(() => { throw new Error('provider debe ser válido'); });
      const res = makeRes();
      await controller.updateConfig(makeReq(), res);
      expect(res.statusCode).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('500 con error interno', async () => {
      services.config.update.mockImplementation(() => { throw new Error('boom'); });
      const res = makeRes();
      await controller.updateConfig(makeReq(), res);
      expect(res.statusCode).toBe(500);
      expect(res.body.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('testConfig', () => {
    it('400 key candidata demasiado corta', async () => {
      const res = makeRes();
      await controller.testConfig(makeReq({ body: { apiKey: 'corta' } }), res);
      expect(res.statusCode).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });

    it('400 sin key configurada ni candidata', async () => {
      services.config.isConfigured.mockReturnValue(false);
      const res = makeRes();
      await controller.testConfig(makeReq(), res);
      expect(res.statusCode).toBe(400);
      expect(res.body.code).toBe('NOT_CONFIGURED');
    });

    it('200 al responder el proveedor', async () => {
      const axios = jest.requireMock('axios');
      axios.default.post.mockResolvedValue({});
      const res = makeRes();
      await controller.testConfig(makeReq(), res);
      expect(res.statusCode).toBe(200);
      expect(res.body.data.provider).toBe('freellmapi');
      expect(typeof res.body.data.latencyMs).toBe('number');
      expect(axios.default.post).toHaveBeenCalledWith(
        'https://api/chat/completions',
        expect.objectContaining({ max_tokens: 1 }),
        expect.anything()
      );
    });

    it('usa la key candidata en el header', async () => {
      const axios = jest.requireMock('axios');
      axios.default.post.mockResolvedValue({});
      const res = makeRes();
      await controller.testConfig(makeReq({ body: { apiKey: 'sk-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' } }), res);
      expect(res.statusCode).toBe(200);
      const call = axios.default.post.mock.calls[0];
      expect((call[2] as any).headers.Authorization).toContain('sk-aaaa');
    });

    it('400 si el proveedor responde con error HTTP', async () => {
      const axios = jest.requireMock('axios');
      axios.default.post.mockRejectedValue({ response: { status: 401 } });
      const res = makeRes();
      await controller.testConfig(makeReq(), res);
      expect(res.statusCode).toBe(400);
      expect(res.body.code).toBe('CONNECTION_ERROR');
      expect(res.body.error).toContain('401');
    });

    it('400 si falla la conexión de red', async () => {
      const axios = jest.requireMock('axios');
      axios.default.post.mockRejectedValue(new Error('ECONNREFUSED'));
      const res = makeRes();
      await controller.testConfig(makeReq(), res);
      expect(res.statusCode).toBe(400);
      expect(res.body.error).toContain('No se pudo conectar');
    });
  });
});
