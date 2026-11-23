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
 * Proveedores LLM soportados (todos OpenAI-compatible: POST {apiUrl}/chat/completions)
 */
export const AI_PROVIDERS = [
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
  },
  {
    id: 'openai',
    nombre: 'OpenAI (GPT)',
    apiUrlPorDefecto: 'https://api.openai.com/v1',
    modelosSugeridos: ['gpt-4o-mini', 'gpt-4o'],
  },
  {
    id: 'openrouter',
    nombre: 'OpenRouter (multi-proveedor)',
    apiUrlPorDefecto: 'https://openrouter.ai/api/v1',
    modelosSugeridos: ['openai/gpt-4o-mini', 'meta-llama/llama-3.1-8b-instruct'],
  },
  {
    id: 'claude',
    nombre: 'Anthropic Claude (compatible OpenAI)',
    apiUrlPorDefecto: 'https://api.anthropic.com/v1',
    modelosSugeridos: [],
  },
  {
    id: 'azure-openai',
    nombre: 'Azure OpenAI',
    apiUrlPorDefecto: '',
    modelosSugeridos: [],
  },
] as const;

export type AIProviderId = (typeof AI_PROVIDERS)[number]['id'];

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