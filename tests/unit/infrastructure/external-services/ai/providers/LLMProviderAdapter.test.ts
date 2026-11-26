/**
 * Tests unitarios para los adaptadores de proveedor LLM
 * (OpenAI-compatible, Anthropic nativo y Google Gemini nativo)
 */

import axios from 'axios';
import {
  createChatAdapter,
  type ILLMChatAdapter
} from '../../../../../../src/infrastructure/external-services/ai/providers/LLMProviderAdapter';
import type { PerplexityConfig } from '../../../../../../src/infrastructure/config/ai.config';

const postMock = jest.fn();

jest.mock('axios', () => ({
  __esModule: true,
  default: { create: jest.fn() },
  isAxiosError: (e: unknown) => !!(e as any)?.isAxiosError
}));

const makeConfig = (overrides: Partial<PerplexityConfig> = {}): PerplexityConfig => ({
  provider: 'freellmapi',
  apiKey: 'sk-test-key-1234567890abcdef1234',
  apiUrl: 'https://api.electronhub.ai/v1',
  model: 'gpt-4o-mini',
  temperature: 0.3,
  maxTokens: 1000,
  timeout: 10000,
  cache: { enabled: false, ttl: 3600 },
  rateLimit: { requestsPerMinute: 10 },
  ...overrides
} as PerplexityConfig);

const OPTS = { temperature: 0.3, maxTokens: 500 };

describe('createChatAdapter (factory)', () => {
  beforeEach(() => {
    postMock.mockReset();
    (axios.create as unknown as jest.Mock).mockImplementation(() => ({ post: postMock }));
  });

  it('freellmapi → adaptador OpenAI-compatible', () => {
    const adapter = createChatAdapter(makeConfig({ provider: 'freellmapi' }));
    expect(adapter).toBeTruthy();
  });

  it('proveedor desconocido → fallback OpenAI-compatible', () => {
    const adapter = createChatAdapter(makeConfig({ provider: 'no-existe' }));
    expect(adapter).toBeTruthy();
  });
});

describe('OpenAICompatibleAdapter (freellmapi/openai/openrouter/perplexity)', () => {
  let adapter: ILLMChatAdapter;

  beforeEach(() => {
    postMock.mockReset();
    (axios.create as unknown as jest.Mock).mockImplementation(() => ({ post: postMock }));
    adapter = createChatAdapter(makeConfig({ provider: 'freellmapi' }));
  });

  it('POST /chat/completions con Bearer auth y modelo configurado', async () => {
    postMock.mockResolvedValue({ data: { choices: [{ message: { content: 'hola' } }], usage: { total_tokens: 7 } } });

    const result = await adapter.chat('sistema', 'usuario', OPTS);

    expect(result.content).toBe('hola');
    expect(result.usage?.totalTokens).toBe(7);
    const [url, body] = postMock.mock.calls[0] as [string, any];
    expect(url).toBe('/chat/completions');
    expect(body.model).toBe('gpt-4o-mini');
    expect(body.messages).toEqual([
      { role: 'system', content: 'sistema' },
      { role: 'user', content: 'usuario' }
    ]);
    expect(body.max_tokens).toBe(500);
  });

  it('responseFormatJson añade response_format cuando se pide', async () => {
    postMock.mockResolvedValue({ data: { choices: [{ message: { content: '{}' } }] } });

    await adapter.chat('s', 'u', { ...OPTS, responseFormatJson: true });

    expect(postMock.mock.calls[0]?.[1]?.response_format).toEqual({ type: 'json_object' });
  });

  it('sin responseFormatJson no incluye response_format', async () => {
    postMock.mockResolvedValue({ data: { choices: [{ message: { content: '{}' } }] } });

    await adapter.chat('s', 'u', OPTS);

    expect(postMock.mock.calls[0]?.[1]?.response_format).toBeUndefined();
  });

  it('lanza si la respuesta está vacía', async () => {
    postMock.mockResolvedValue({ data: { choices: [] } });

    await expect(adapter.chat('s', 'u', OPTS)).rejects.toThrow(/vacía/i);
  });
});

describe('AnthropicAdapter (API nativa /v1/messages)', () => {
  let adapter: ILLMChatAdapter;

  beforeEach(() => {
    postMock.mockReset();
    (axios.create as unknown as jest.Mock).mockImplementation(() => ({ post: postMock }));
    adapter = createChatAdapter(makeConfig({
      provider: 'anthropic',
      apiUrl: 'https://api.anthropic.com',
      model: 'claude-3-5-haiku-20241022'
    }));
  });

  it('usa headers x-api-key + anthropic-version y POST /v1/messages', async () => {
    postMock.mockResolvedValue({ data: { content: [{ text: 'respuesta' }], usage: { input_tokens: 5, output_tokens: 9 } } });

    const result = await adapter.chat('sistema', 'usuario', OPTS);

    expect(result.content).toBe('respuesta');
    expect(result.usage?.totalTokens).toBe(14);

    const clientConfig = (axios.create as unknown as jest.Mock).mock.calls[0]?.[0];
    expect(clientConfig.baseURL).toBe('https://api.anthropic.com');
    expect(clientConfig.headers['x-api-key']).toContain('sk-test-key');
    expect(clientConfig.headers['anthropic-version']).toBe('2023-06-01');

    const [url, body] = postMock.mock.calls[0] as [string, any];
    expect(url).toBe('/v1/messages');
    expect(body.system).toBe('sistema');
    expect(body.messages).toEqual([{ role: 'user', content: 'usuario' }]);
    expect(body.model).toBe('claude-3-5-haiku-20241022');
  });

  it('lanza si la respuesta está vacía', async () => {
    postMock.mockResolvedValue({ data: { content: [] } });

    await expect(adapter.chat('s', 'u', OPTS)).rejects.toThrow(/vacía/i);
  });
});

describe('GoogleGeminiAdapter (API nativa generateContent)', () => {
  let adapter: ILLMChatAdapter;

  beforeEach(() => {
    postMock.mockReset();
    (axios.create as unknown as jest.Mock).mockImplementation(() => ({ post: postMock }));
    adapter = createChatAdapter(makeConfig({
      provider: 'google',
      apiUrl: 'https://generativelanguage.googleapis.com',
      model: 'gemini-1.5-flash'
    }));
  });

  it('usa x-goog-api-key y POST /v1beta/models/{model}:generateContent', async () => {
    postMock.mockResolvedValue({
      data: {
        candidates: [{ content: { parts: [{ text: 'hola ' }, { text: 'mundo' }] } }],
        usageMetadata: { totalTokenCount: 11 }
      }
    });

    const result = await adapter.chat('sistema', 'usuario', OPTS);

    expect(result.content).toBe('hola mundo');
    expect(result.usage?.totalTokens).toBe(11);

    const clientConfig = (axios.create as unknown as jest.Mock).mock.calls[0]?.[0];
    expect(clientConfig.headers['x-goog-api-key']).toContain('sk-test-key');

    const [url, body] = postMock.mock.calls[0] as [string, any];
    expect(url).toBe('/v1beta/models/gemini-1.5-flash:generateContent');
    expect(body.systemInstruction.parts[0].text).toBe('sistema');
    expect(body.contents[0].parts[0].text).toBe('usuario');
    expect(body.generationConfig.maxOutputTokens).toBe(500);
  });

  it('lanza si la respuesta no tiene candidatos', async () => {
    postMock.mockResolvedValue({ data: {} });

    await expect(adapter.chat('s', 'u', OPTS)).rejects.toThrow(/vacía/i);
  });
});
