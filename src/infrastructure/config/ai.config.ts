/**
 * Configuración para servicios de Inteligencia Artificial
 * Soporte para múltiples proveedores: Perplexity, OpenAI, Claude, Azure OpenAI
 */

export interface AIConfig {
  provider: 'perplexity' | 'openai' | 'claude' | 'azure-openai';
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

export interface PerplexityConfig extends AIConfig {
  provider: 'perplexity';
  model: 'llama-3.1-sonar-small-128k-online' | 'llama-3.1-sonar-large-128k-online' | 'llama-3.1-sonar-huge-128k-online';
}

/**
 * Configuración por defecto para desarrollo con Perplexity
 */
const getAIConfig = (): PerplexityConfig => {
  const config: PerplexityConfig = {
    provider: 'perplexity',
    apiKey: process.env['PERPLEXITY_API_KEY'] || '',
    apiUrl: process.env['PERPLEXITY_API_URL'] || 'https://api.perplexity.ai',
    model: (process.env['PERPLEXITY_MODEL'] as PerplexityConfig['model']) || 'llama-3.1-sonar-small-128k-online',
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

  // Validación que tenga formato de API key de Perplexity (comienza con 'pplx-')
  if (!config.apiKey.startsWith('pplx-')) {
    throw new Error('PERPLEXITY_API_KEY debe comenzar con "pplx-" para ser válida');
  }

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