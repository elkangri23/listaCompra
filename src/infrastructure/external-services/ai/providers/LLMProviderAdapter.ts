/**
 * Adaptadores de proveedor LLM
 *
 * Normaliza las diferencias entre APIs para que el resto del código
 * (PerplexityService, CachedAIService, casos de uso IA) trabaje siempre con
 * una interfaz común:
 *
 *   chat(systemPrompt, userPrompt, opciones) -> string (contenido del modelo)
 *
 * Estilos soportados:
 *  - openai:    Perplexity, OpenAI, OpenRouter, Azure, FreeLLMAPI y cualquier
 *               endpoint OpenAI-compatible (POST {apiUrl}/chat/completions)
 *  - anthropic: API nativa de Claude (POST {apiUrl}/v1/messages)
 *  - google:    API nativa de Gemini (POST {apiUrl}/v1beta/models/{model}:generateContent)
 */

import axios from 'axios';
import { getAIProviderMeta } from '../../../config/ai.config';
import type { PerplexityConfig } from '../../../config/ai.config';

export interface ChatOptions {
  temperature: number;
  maxTokens: number;
  /** Pide JSON estricto (solo soportado por APIs de estilo OpenAI; el resto lo ignora) */
  responseFormatJson?: boolean;
}

export interface ChatResult {
  content: string;
  usage?: { totalTokens?: number };
}

export interface ILLMChatAdapter {
  chat(systemPrompt: string, userPrompt: string, options: ChatOptions): Promise<ChatResult>;
}

class OpenAICompatibleAdapter implements ILLMChatAdapter {
  private readonly client: any;

  constructor(private readonly config: PerplexityConfig) {
    this.client = axios.create({
      baseURL: config.apiUrl,
      timeout: config.timeout,
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
    });
  }

  async chat(systemPrompt: string, userPrompt: string, options: ChatOptions): Promise<ChatResult> {
    const response = await this.client.post('/chat/completions', {
      model: this.config.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: options.temperature,
      max_tokens: options.maxTokens,
      return_citations: false,
      return_images: false,
      ...(options.responseFormatJson ? { response_format: { type: 'json_object' } } : {}),
    });

    const content = response.data?.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('Respuesta vacía del proveedor LLM');
    }

    const result: ChatResult = { content };
    if (response.data?.usage?.total_tokens != null) {
      result.usage = { totalTokens: response.data.usage.total_tokens };
    }
    return result;
  }
}

class AnthropicAdapter implements ILLMChatAdapter {
  private readonly client: any;

  constructor(private readonly config: PerplexityConfig) {
    this.client = axios.create({
      baseURL: config.apiUrl,
      timeout: config.timeout,
      headers: {
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
    });
  }

  async chat(systemPrompt: string, userPrompt: string, options: ChatOptions): Promise<ChatResult> {
    const response = await this.client.post('/v1/messages', {
      model: this.config.model,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      temperature: options.temperature,
      max_tokens: options.maxTokens,
    });

    const content = response.data?.content?.[0]?.text;
    if (!content) {
      throw new Error('Respuesta vacía del proveedor LLM (Anthropic)');
    }

    const result: ChatResult = { content };
    if (response.data?.usage?.input_tokens != null) {
      result.usage = {
        totalTokens: (response.data.usage.input_tokens ?? 0) + (response.data.usage.output_tokens ?? 0),
      };
    }
    return result;
  }
}

class GoogleGeminiAdapter implements ILLMChatAdapter {
  private readonly client: any;

  constructor(private readonly config: PerplexityConfig) {
    this.client = axios.create({
      baseURL: config.apiUrl,
      timeout: config.timeout,
      headers: {
        'x-goog-api-key': config.apiKey,
        'Content-Type': 'application/json',
      },
    });
  }

  async chat(systemPrompt: string, userPrompt: string, options: ChatOptions): Promise<ChatResult> {
    const response = await this.client.post(
      `/v1beta/models/${this.config.model}:generateContent`,
      {
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: {
          temperature: options.temperature,
          maxOutputTokens: options.maxTokens,
        },
      }
    );

    const content = response.data?.candidates?.[0]?.content?.parts
      ?.map((part: any) => part.text)
      .filter(Boolean)
      .join('');
    if (!content) {
      throw new Error('Respuesta vacía del proveedor LLM (Google)');
    }

    const result: ChatResult = { content };
    if (response.data?.usageMetadata?.totalTokenCount != null) {
      result.usage = { totalTokens: response.data.usageMetadata.totalTokenCount };
    }
    return result;
  }
}

/**
 * Factory: elige el adaptador según el estilo de API del proveedor configurado.
 */
export function createChatAdapter(config: PerplexityConfig): ILLMChatAdapter {
  const meta = getAIProviderMeta(config.provider);
  switch (meta?.apiStyle) {
    case 'anthropic':
      return new AnthropicAdapter(config);
    case 'google':
      return new GoogleGeminiAdapter(config);
    case 'openai':
    default:
      return new OpenAICompatibleAdapter(config);
  }
}
