/**
 * Configuración para servicios de Inteligencia Artificial
 * Soporte para múltiples proveedores: Perplexity, OpenAI, Claude, Azure OpenAI
 */

export interface AIConfig {
  provider: AIProviderId;
  apiKey: string;
  apiUrl: string;
  model: string;
  temperature: number;
  maxTokens: number;
  timeout: number;
  cache: {
    enabled: boolean;
    ttl: number; // seconds
  };
  rateLimit: {
    requestsPerMinute: number;
  };
}

/**
 * Configuración efectiva del servicio IA. Permite cualquier modelo OpenAI-compatible;
 * la validación del modelo se hace en runtime contra el proveedor.
 */
export interface PerplexityConfig extends AIConfig {
  provider: AIProviderId;
  model: string;
}

/**
 * Estilos de API soportados:
 *  - openai:    POST {apiUrl}/chat/completions con Bearer auth (Perplexity, OpenAI,
 *               OpenRouter, Azure, FreeLLMAPI, cualquier endpoint compatible)
 *  - anthropic: POST {apiUrl}/v1/messages con x-api-key + anthropic-version
 *  - google:    POST {apiUrl}/v1beta/models/{model}:generateContent?key=...
 */
export type APIStyle = 'openai' | 'anthropic' | 'google';

export interface AIProviderMeta {
  id: string;
  nombre: string;
  apiUrlPorDefecto: string;
  modelosSugeridos: string[];
  apiStyle: APIStyle;
  /** Variable de entorno que contiene la API key de este proveedor */
  apiKeyEnv: string;
  /** Variable de entorno opcional para sobreescribir la apiUrl por defecto */
  apiUrlEnv: string;
  /** Variable de entorno opcional para fijar el modelo */
  modelEnv: string;
}

/**
 * Proveedores LLM soportados. Los de estilo 'openai' son intercambiables
 * entre sí (misma forma de llamada); 'anthropic' y 'google' usan adaptadores
 * propios (ver src/infrastructure/external-services/ai/providers/).
 */
export const AI_PROVIDERS: readonly AIProviderMeta[] = [
  {
    id: 'freellmapi',
    nombre: 'FreeLLMAPI (gratuito, OpenAI-compatible)',
    apiUrlPorDefecto: 'https://api.electronhub.ai/v1',
    modelosSugeridos: ['gpt-4o-mini', 'llama-3.1-8b-instruct', 'gemini-flash-1.5', 'claude-3-haiku'],
    apiStyle: 'openai',
    apiKeyEnv: 'FREE_LLMAPI_API_KEY',
    apiUrlEnv: 'FREE_LLMAPI_API_URL',
    modelEnv: 'FREE_LLMAPI_MODEL',
  },
  {
    id: 'perplexity',
    nombre: 'Perplexity (Sonar online)',
    apiUrlPorDefecto: 'https://api.perplexity.ai',
    modelosSugeridos: [
      'sonar',
      'sonar-pro',
      'sonar-reasoning-pro',
      'sonar-deep-research',
    ],
    apiStyle: 'openai',
    apiKeyEnv: 'PERPLEXITY_API_KEY',
    apiUrlEnv: 'PERPLEXITY_API_URL',
    modelEnv: 'PERPLEXITY_MODEL',
  },
  {
    id: 'openai',
    nombre: 'OpenAI (GPT)',
    apiUrlPorDefecto: 'https://api.openai.com/v1',
    modelosSugeridos: ['gpt-4o-mini', 'gpt-4o'],
    apiStyle: 'openai',
    apiKeyEnv: 'OPENAI_API_KEY',
    apiUrlEnv: 'OPENAI_API_URL',
    modelEnv: 'OPENAI_MODEL',
  },
  {
    id: 'openai-compatible',
    nombre: 'OpenAI-compatible (endpoint personalizado)',
    apiUrlPorDefecto: '',
    modelosSugeridos: [],
    apiStyle: 'openai',
    apiKeyEnv: 'OPENAI_COMPATIBLE_API_KEY',
    apiUrlEnv: 'OPENAI_COMPATIBLE_API_URL',
    modelEnv: 'OPENAI_COMPATIBLE_MODEL',
  },
  {
    id: 'anthropic',
    nombre: 'Anthropic Claude (API nativa /v1/messages)',
    apiUrlPorDefecto: 'https://api.anthropic.com',
    modelosSugeridos: ['claude-3-5-haiku-20241022', 'claude-3-5-sonnet-20241022'],
    apiStyle: 'anthropic',
    apiKeyEnv: 'ANTHROPIC_API_KEY',
    apiUrlEnv: 'ANTHROPIC_API_URL',
    modelEnv: 'ANTHROPIC_MODEL',
  },
  {
    id: 'google',
    nombre: 'Google Gemini (API nativa generateContent)',
    apiUrlPorDefecto: 'https://generativelanguage.googleapis.com',
    modelosSugeridos: ['gemini-1.5-flash', 'gemini-1.5-pro'],
    apiStyle: 'google',
    apiKeyEnv: 'GOOGLE_API_KEY',
    apiUrlEnv: 'GOOGLE_API_URL',
    modelEnv: 'GOOGLE_MODEL',
  },
  {
    id: 'openrouter',
    nombre: 'OpenRouter (multi-proveedor)',
    apiUrlPorDefecto: 'https://openrouter.ai/api/v1',
    modelosSugeridos: ['openai/gpt-4o-mini', 'meta-llama/llama-3.1-8b-instruct'],
    apiStyle: 'openai',
    apiKeyEnv: 'OPENROUTER_API_KEY',
    apiUrlEnv: 'OPENROUTER_API_URL',
    modelEnv: 'OPENROUTER_MODEL',
  },
  {
    id: 'azure-openai',
    nombre: 'Azure OpenAI',
    apiUrlPorDefecto: '',
    modelosSugeridos: [],
    apiStyle: 'openai',
    apiKeyEnv: 'AZURE_OPENAI_API_KEY',
    apiUrlEnv: 'AZURE_OPENAI_API_URL',
    modelEnv: 'AZURE_OPENAI_MODEL',
  },
];

/**
 * Devuelve los metadatos de un proveedor (o undefined si no existe)
 */
export const getAIProviderMeta = (id: string): AIProviderMeta | undefined =>
  AI_PROVIDERS.find(p => p.id === id);

/**
 * Modelo por defecto de un proveedor (primer modelo sugerido o fallback genérico)
 */
export const getDefaultModelForProvider = (id: string): string => {
  const meta = getAIProviderMeta(id);
  return meta?.modelosSugeridos[0] ?? 'gpt-4o-mini';
};

/**
 * ID de proveedor IA (extensible: los de la lista AI_PROVIDERS)
 */
export type AIProviderId = string;

/**
 * Configuración por defecto para desarrollo con Perplexity
 */
const getAIConfig = (): PerplexityConfig => {
  const config: PerplexityConfig = {
    provider: 'perplexity',
    apiKey: process.env['PERPLEXITY_API_KEY'] || '',
    apiUrl: process.env['PERPLEXITY_API_URL'] || 'https://api.perplexity.ai',
    model: (process.env['PERPLEXITY_MODEL'] as PerplexityConfig['model']) || 'sonar',
    temperature: parseFloat(process.env['AI_TEMPERATURE'] || '0.7'),
    maxTokens: parseInt(process.env['AI_MAX_TOKENS'] || '1000'),
    timeout: parseInt(process.env['AI_TIMEOUT'] || '30000'),
    cache: {
      enabled: process.env['AI_CACHE_ENABLED'] === 'true',
      ttl: parseInt(process.env['AI_CACHE_TTL'] || '3600')
    },
    rateLimit: {
      requestsPerMinute: parseInt(process.env['AI_RATE_LIMIT_PER_MINUTE'] || '10')
    }
  };

  // Validaciones robustas de seguridad
  if (!config.apiKey) {
    throw new Error('PERPLEXITY_API_KEY es requerido para usar servicios de IA');
  }

  // Validación de formato de API key (debe ser un string válido de longitud suficiente)
  if (typeof config.apiKey !== 'string' || config.apiKey.length < 32) {
    throw new Error('PERPLEXITY_API_KEY parece inválida - debe ser una cadena de al menos 32 caracteres');
  }

  // Validación que no sea una key por defecto o de ejemplo
  const invalidKeys = ['default-key', 'your-api-key', 'example-key', 'test-key'];
  if (invalidKeys.includes(config.apiKey.toLowerCase())) {
    throw new Error('PERPLEXITY_API_KEY no puede ser un valor de ejemplo - configura una API key válida');
  }

  // NOTA: se elimina la exigencia del prefijo 'pplx-' para permitir proveedores
  // OpenAI-compatibles (OpenAI, OpenRouter, Claude, Azure) configurados desde
  // la UI de administración. La validez real de la key se verifica en runtime
  // contra el endpoint del proveedor (POST /admin/ai/config/test).

  if (config.temperature < 0 || config.temperature > 1) {
    throw new Error('AI_TEMPERATURE debe estar entre 0.0 y 1.0');
  }

  if (config.maxTokens < 1 || config.maxTokens > 4000) {
    throw new Error('AI_MAX_TOKENS debe estar entre 1 y 4000');
  }

  return config;
};

/**
 * Configuración específica para diferentes casos de uso
 */
export const AI_USE_CASES = {
  CATEGORY_SUGGESTIONS: {
    temperature: 0.3, // Más determinístico para categorías
    maxTokens: 200,
    systemPrompt: `Eres un asistente especializado en categorización de productos de supermercado.
Tu tarea es sugerir categorías apropiadas para productos basándote en el nombre del producto y la tienda.
Responde solo con categorías válidas y coherentes en español.`
  },
  PURCHASE_ANALYSIS: {
    temperature: 0.5, // Balance entre creatividad y precisión
    maxTokens: 500,
    systemPrompt: `Eres un analista especializado en hábitos de compra.
Analiza los patrones de compra del usuario y proporciona insights útiles sobre:
- Frecuencia de compras
- Productos más comprados
- Tendencias estacionales
- Sugerencias de optimización`
  },
  PRODUCT_RECOMMENDATIONS: {
    temperature: 0.6, // Más creativo para recomendaciones
    maxTokens: 300,
    systemPrompt: `Eres un asistente especializado en recomendaciones de productos de supermercado.
Basándote en el historial de compras del usuario, sugiere productos relacionados o complementarios.
Considera factores como estacionalidad, combinaciones frecuentes y preferencias alimentarias.`
  }
} as const;

export default getAIConfig;