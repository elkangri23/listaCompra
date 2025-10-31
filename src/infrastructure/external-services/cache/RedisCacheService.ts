/**
 * Servicio de Cache Redis para IA
 * Optimiza costos de API almacenando respuestas de IA
 */

import { createClient, RedisClientType } from 'redis';
import { RedisConfig, CACHE_TTL, CACHE_KEYS } from '../../config/redis.config';
import { Logger } from '../../observability/logger/Logger';

export interface CacheService {
  /**
   * Obtiene un valor del cache
   */
  get<T>(key: string): Promise<T | null>;

  /**
   * Almacena un valor en el cache
   */
  set<T>(key: string, value: T, ttl?: number): Promise<void>;

  /**
   * Elimina un valor del cache
   */
  delete(key: string): Promise<void>;

  /**
   * Elimina múltiples valores del cache por patrón
   */
  deletePattern(pattern: string): Promise<number>;

  /**
   * Verifica si una clave existe en el cache
   */
  exists(key: string): Promise<boolean>;

  /**
   * Obtiene el TTL restante de una clave
   */
  ttl(key: string): Promise<number>;

  /**
   * Verifica si el servicio está disponible
   */
  isAvailable(): Promise<boolean>;

  /**
   * Cierra la conexión
   */
  disconnect(): Promise<void>;
}

export class RedisCacheService implements CacheService {
  private readonly logger = new Logger('RedisCacheService');
  private client: RedisClientType | null = null;
  private isConnected = false;

  constructor(private readonly config: RedisConfig) {}

  /**
   * Inicializa la conexión a Redis
   */
  async initialize(): Promise<void> {
    try {
      this.logger.info('Inicializando conexión a Redis', {
        host: this.config.host,
        port: this.config.port,
        database: this.config.database
      });

      // Crear configuración del cliente Redis
      const clientConfig: any = {
        socket: {
          host: this.config.host,
          port: this.config.port,
          connectTimeout: this.config.connectTimeout,
          reconnectStrategy: (retries: number) => {
            const delay = Math.min(retries * this.config.retryDelayOnFailover, 3000);
            this.logger.warn(`Reintentando conexión a Redis en ${delay}ms (intento ${retries})`);
            return delay;
          }
        },
        database: this.config.database
      };

      // Agregar password solo si está definida
      if (this.config.password) {
        clientConfig.password = this.config.password;
      }

      this.client = createClient(clientConfig);

      // Eventos de conexión
      this.client.on('connect', () => {
        this.logger.info('Conectando a Redis...');
      });

      this.client.on('ready', () => {
        this.isConnected = true;
        this.logger.info('Conexión a Redis establecida correctamente');
      });

      this.client.on('error', (error) => {
        this.isConnected = false;
        this.logger.error('Error de conexión a Redis', error);
      });

      this.client.on('end', () => {
        this.isConnected = false;
        this.logger.warn('Conexión a Redis terminada');
      });

      // Conectar
      await this.client.connect();

    } catch (error) {
      this.isConnected = false;
      this.logger.error('Error al inicializar Redis', error as Error);
      throw error;
    }
  }

  /**
   * Obtiene un valor del cache
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.isConnected || !this.client) {
      this.logger.warn('Redis no disponible, saltando cache', { key });
      return null;
    }

    try {
      const fullKey = this.config.keyPrefix + key;
      const value = await this.client.get(fullKey);
      
      if (value === null) {
        this.logger.debug('Cache miss', { key: fullKey });
        return null;
      }

      const parsed = JSON.parse(value) as T;
      this.logger.debug('Cache hit', { key: fullKey });
      return parsed;

    } catch (error) {
      this.logger.error('Error al obtener del cache', error as Error, { key });
      return null;
    }
  }

  /**
   * Almacena un valor en el cache
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    if (!this.isConnected || !this.client) {
      this.logger.warn('Redis no disponible, saltando cache', { key });
      return;
    }

    try {
      const fullKey = this.config.keyPrefix + key;
      const serialized = JSON.stringify(value);

      if (ttl) {
        await this.client.setEx(fullKey, ttl, serialized);
      } else {
        await this.client.set(fullKey, serialized);
      }

      this.logger.debug('Valor almacenado en cache', { 
        key: fullKey, 
        ttl,
        size: serialized.length 
      });

    } catch (error) {
      this.logger.error('Error al almacenar en cache', error as Error, { key, ttl });
    }
  }

  /**
   * Elimina un valor del cache
   */
  async delete(key: string): Promise<void> {
    if (!this.isConnected || !this.client) {
      return;
    }

    try {
      const fullKey = this.config.keyPrefix + key;
      await this.client.del(fullKey);
      this.logger.debug('Valor eliminado del cache', { key: fullKey });

    } catch (error) {
      this.logger.error('Error al eliminar del cache', error as Error, { key });
    }
  }

  /**
   * Elimina múltiples valores del cache por patrón
   */
  async deletePattern(pattern: string): Promise<number> {
    if (!this.isConnected || !this.client) {
      return 0;
    }

    try {
      const fullPattern = this.config.keyPrefix + pattern;
      const keys = await this.client.keys(fullPattern);
      
      if (keys.length === 0) {
        return 0;
      }

      const deleted = await this.client.del(keys);
      this.logger.debug('Valores eliminados por patrón', { 
        pattern: fullPattern, 
        deleted 
      });
      
      return deleted;

    } catch (error) {
      this.logger.error('Error al eliminar por patrón', error as Error, { pattern });
      return 0;
    }
  }

  /**
   * Verifica si una clave existe en el cache
   */
  async exists(key: string): Promise<boolean> {
    if (!this.isConnected || !this.client) {
      return false;
    }

    try {
      const fullKey = this.config.keyPrefix + key;
      const exists = await this.client.exists(fullKey);
      return exists === 1;

    } catch (error) {
      this.logger.error('Error al verificar existencia', error as Error, { key });
      return false;
    }
  }

  /**
   * Obtiene el TTL restante de una clave
   */
  async ttl(key: string): Promise<number> {
    if (!this.isConnected || !this.client) {
      return -1;
    }

    try {
      const fullKey = this.config.keyPrefix + key;
      return await this.client.ttl(fullKey);

    } catch (error) {
      this.logger.error('Error al obtener TTL', error as Error, { key });
      return -1;
    }
  }

  /**
   * Verifica si el servicio está disponible
   */
  async isAvailable(): Promise<boolean> {
    if (!this.isConnected || !this.client) {
      return false;
    }

    try {
      await this.client.ping();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Cierra la conexión
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.quit();
        this.logger.info('Conexión a Redis cerrada correctamente');
      } catch (error) {
        this.logger.error('Error al cerrar conexión a Redis', error as Error);
      } finally {
        this.isConnected = false;
        this.client = null;
      }
    }
  }
}

/**
 * Utilidades para generar claves de cache consistentes
 */
export class CacheKeyBuilder {
  /**
   * Genera clave para sugerencias de categorías
   */
  static buildCategorySuggestionsKey(
    productName: string,
    storeName?: string,
    existingCategories?: string[]
  ): string {
    const normalizedProduct = productName.toLowerCase().trim();
    const normalizedStore = storeName?.toLowerCase().trim() || 'generic';
    const categoriesHash = existingCategories?.sort().join(',') || '';
    
    // Crear hash simple para evitar claves muy largas
    const hash = Buffer.from(normalizedProduct + normalizedStore + categoriesHash)
      .toString('base64')
      .replace(/[/+=]/g, '');
    
    return CACHE_KEYS.CATEGORY_SUGGESTIONS + hash;
  }

  /**
   * Genera clave para análisis de hábitos
   */
  static buildPurchaseAnalysisKey(
    userId: string,
    timeRange: { start: Date; end: Date }
  ): string {
    const startStr = timeRange.start.toISOString().split('T')[0];
    const endStr = timeRange.end.toISOString().split('T')[0];
    return CACHE_KEYS.PURCHASE_ANALYSIS + `${userId}:${startStr}:${endStr}`;
  }

  /**
   * Genera clave para recomendaciones de productos
   */
  static buildProductRecommendationsKey(
    userId: string,
    contextHash?: string
  ): string {
    const context = contextHash || 'general';
    return CACHE_KEYS.PRODUCT_RECOMMENDATIONS + `${userId}:${context}`;
  }

  /**
   * Genera clave genérica para análisis de IA
   */
  static buildGeneralAIKey(prompt: string, context?: Record<string, any>): string {
    const contextStr = context ? JSON.stringify(context) : '';
    const hash = Buffer.from(prompt + contextStr)
      .toString('base64')
      .replace(/[/+=]/g, '')
      .substring(0, 50);
    
    return CACHE_KEYS.GENERAL_AI + hash;
  }
}

export { CACHE_TTL, CACHE_KEYS };