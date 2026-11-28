/**
 * Tests unitarios para AIHealthChecker (panel admin, fase 3).
 * Mockea axios.post: el checker hace un ping real al proveedor.
 */

import { AIHealthChecker } from '../../../../../src/infrastructure/external-services/ai/AIHealthChecker';

const postMock = jest.fn();

jest.mock('axios', () => ({
  __esModule: true,
  // postMock se define debajo: el factory no puede referenciarlo en su
  // evaluación (jest hoistea el mock por encima de los const), así que
  // se delega en tiempo de llamada.
  default: { post: (...args: unknown[]) => (postMock as jest.Mock)(...args) },
}));

const makeConfigService = (over: Record<string, unknown> = {}) => ({
  get: jest.fn().mockReturnValue({
    provider: 'freellmapi',
    model: 'qwen3.8-27b',
    apiUrl: 'http://freellmapi:3001/v1',
    apiKey: 'k'.repeat(40),
  }),
  isConfigured: jest.fn().mockReturnValue(true),
  ...over,
});

describe('AIHealthChecker', () => {
  beforeEach(() => {
    postMock.mockReset();
  });

  it('proveedor que responde → healthy con latencyMs', async () => {
    postMock.mockResolvedValue({ data: { choices: [{ message: { content: 'pong' } }] } });
    const checker = new AIHealthChecker(makeConfigService() as any);

    const result = await checker.check();

    expect(result.status).toBe('healthy');
    expect(result.provider).toBe('freellmapi');
    expect(result.model).toBe('qwen3.8-27b');
    expect(typeof result.latencyMs).toBe('number');
    expect(result.cached).toBe(false);
    expect(result.checkedAt).toBeTruthy();
    expect(postMock).toHaveBeenCalledTimes(1);
    expect(postMock).toHaveBeenCalledWith(
      'http://freellmapi:3001/v1/chat/completions',
      { model: 'qwen3.8-27b', messages: [{ role: 'user', content: 'ping' }], max_tokens: 1 },
      expect.objectContaining({ timeout: 10000 })
    );
    // La key viaja en el header, nunca en el cuerpo ni en la respuesta
    expect(JSON.stringify(result)).not.toContain('k'.repeat(10));
  });

  it('proveedor que falla → degraded con reason PROVIDER_ERROR', async () => {
    postMock.mockRejectedValue(new Error('ECONNREFUSED'));
    const checker = new AIHealthChecker(makeConfigService() as any);

    const result = await checker.check();

    expect(result.status).toBe('degraded');
    expect(result.reason).toBe('PROVIDER_ERROR');
    expect(result.latencyMs).toBeNull();
    expect(result.cached).toBe(false);
  });

  it('sin configurar → degraded NOT_CONFIGURED sin llamar al modelo', async () => {
    const checker = new AIHealthChecker(
      makeConfigService({ isConfigured: jest.fn().mockReturnValue(false) }) as any
    );

    const result = await checker.check();

    expect(result.status).toBe('degraded');
    expect(result.reason).toBe('NOT_CONFIGURED');
    expect(result.latencyMs).toBeNull();
    expect(postMock).not.toHaveBeenCalled();
  });

  it('segunda llamada dentro de 60 s → cached:true sin nueva llamada HTTP', async () => {
    postMock.mockResolvedValue({ data: {} });
    const checker = new AIHealthChecker(makeConfigService() as any);

    const first = await checker.check();
    const second = await checker.check();

    expect(postMock).toHaveBeenCalledTimes(1);
    expect(first.cached).toBe(false);
    expect(second.cached).toBe(true);
    expect(second.status).toBe('healthy');
    // checkedAt original, no renovado
    expect(second.checkedAt).toBe(first.checkedAt);
  });
});
