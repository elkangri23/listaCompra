/**
 * Configuración de Redis para cache de IA
 * Optimiza costos de API evitando requests duplicados
 */

export interface RedisConfig {
  host: string;
  port: number;
  password?: string; // Opcional
  database: number;
  connectTimeout: number;
  commandTimeout: number;
  retryDelayOnFailover: number;
  maxRetriesPerRequest: number;
  keyPrefix: string;
}

/**
 * Configuración de Redis para cache de IA
 */
const getRedisConfig = (): RedisConfig => {
  const config: RedisConfig = {
    host: process.env['REDIS_HOST'] || 'localhost',
    port: parseInt(process.env['REDIS_PORT'] || '6379'),
    database: parseInt(process.env['REDIS_DATABASE'] || '0'),
    connectTimeout: parseInt(process.env['REDIS_CONNECT_TIMEOUT'] || '10000'),
    commandTimeout: parseInt(process.env['REDIS_COMMAND_TIMEOUT'] || '5000'),
    retryDelayOnFailover: parseInt(process.env['REDIS_RETRY_DELAY'] || '100'),
    maxRetriesPerRequest: parseInt(process.env['REDIS_MAX_RETRIES'] || '3'),
    keyPrefix: process.env['REDIS_KEY_PREFIX'] || 'lista-compra:'
  };

  // Agregar password solo si está definida
  if (process.env['REDIS_PASSWORD']) {
    config.password = process.env['REDIS_PASSWORD'];
  }

  // Validaciones
  if (config.port < 1 || config.port > 65535) {
    throw new Error('REDIS_PORT debe estar entre 1 y 65535');
  }

  if (config.database < 0 || config.database > 15) {
    throw new Error('REDIS_DATABASE debe estar entre 0 y 15');
  }

  if (config.connectTimeout < 1000) {
    throw new Error('REDIS_CONNECT_TIMEOUT debe ser mayor a 1000ms');
  }

  return config;
};

/**
 * Configuración de TTL (Time To Live) para diferentes tipos de cache
 */
export const CACHE_TTL = {
  // Sugerencias de categorías - TTL largo ya que raramente cambian
  CATEGORY_SUGGESTIONS: parseInt(process.env['CACHE_TTL_CATEGORY'] || '86400'), // 24 horas

  // Análisis de hábitos - TTL medio
  PURCHASE_ANALYSIS: parseInt(process.env['CACHE_TTL_ANALYSIS'] || '3600'), // 1 hora

  // Recomendaciones de productos - TTL corto (pueden cambiar con el tiempo)
  PRODUCT_RECOMMENDATIONS: parseInt(process.env['CACHE_TTL_RECOMMENDATIONS'] || '1800'), // 30 minutos

  // Cache general para otros tipos de análisis
  GENERAL_AI: parseInt(process.env['CACHE_TTL_GENERAL'] || '7200') // 2 horas
} as const;

/**
 * Prefijos de keys para organizar el cache
 */
export const CACHE_KEYS = {
  CATEGORY_SUGGESTIONS: 'cat:',
  PURCHASE_ANALYSIS: 'analysis:',
  PRODUCT_RECOMMENDATIONS: 'rec:',
  GENERAL_AI: 'ai:'
} as const;

export default getRedisConfig;