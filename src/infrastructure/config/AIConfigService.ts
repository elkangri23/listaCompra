/**
 * Servicio de configuración IA en runtime (CU-31: selección de proveedor LLM)
 *
 * Mantiene la configuración efectiva del servicio de IA. Se inicializa desde
 * variables de entorno y puede actualizarse en caliente desde los endpoints
 * de administración (PUT /api/v1/ai/admin/config) sin reiniciar el servidor.
 *
 * Nota de alcance: la configuración vive en memoria (se resetea al reiniciar,
 * volviendo a las variables de entorno). Persistir en BD requeriría una
 * migración; se documenta como mejora futura.
 */

import { AIConfig, AIProviderId, PerplexityConfig } from './ai.config';
import { Logger } from '@infrastructure/observability/logger/Logger';

export interface AIConfigUpdateDto {
  provider?: AIProviderId;
  apiUrl?: string;
  model?: string;
  apiKey?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AISafeConfig
  extends Omit<AIConfig, 'apiKey'> {
  apiKeyConfigured: boolean;
  apiKeyMasked: string;
}

export class AIConfigService {
  private readonly logger = new Logger('AIConfigService');
  private current: PerplexityConfig;

  constructor(initial?: PerplexityConfig) {
    this.current = initial ?? AIConfigService.fromEnvironment();
  }

  /**
   * Construye la configuración desde variables de entorno (sin lanzar si
   * falta la key: el servicio queda sin configurar y los endpoints IA
   * devuelven error de configuración en runtime).
   */
  static fromEnvironment(): PerplexityConfig {
    return {
      provider: (process.env['AI_PROVIDER'] as AIProviderId) || 'perplexity',
      apiKey: process.env['PERPLEXITY_API_KEY'] || '',
      apiUrl: process.env['PERPLEXITY_API_URL'] || 'https://api.perplexity.ai',
      model:
        process.env['PERPLEXITY_MODEL'] || 'sonar',
      temperature: parseFloat(process.env['AI_TEMPERATURE'] || '0.7'),
      maxTokens: parseInt(process.env['AI_MAX_TOKENS'] || '1000'),
      timeout: parseInt(process.env['AI_TIMEOUT'] || '30000'),
      cache: {
        enabled: process.env['AI_CACHE_ENABLED'] === 'true',
        ttl: parseInt(process.env['AI_CACHE_TTL'] || '3600'),
      },
      rateLimit: {
        requestsPerMinute: parseInt(
          process.env['AI_RATE_LIMIT_PER_MINUTE'] || '10'
        ),
      },
    };
  }

  get(): PerplexityConfig {
    return this.current;
  }

  isConfigured(): boolean {
    return (
      typeof this.current.apiKey === 'string' &&
      this.current.apiKey.length >= 32
    );
  }

  /**
   * Actualiza la configuración en caliente. Solo se modifican los campos
   * enviados; la apiKey vacía/undefined conserva la actual.
   */
  update(dto: AIConfigUpdateDto): PerplexityConfig {
    const next: PerplexityConfig = {
      ...this.current,
      ...dto,
      apiKey:
        dto.apiKey && dto.apiKey.trim().length > 0
          ? dto.apiKey.trim()
          : this.current.apiKey,
      cache: { ...this.current.cache },
      rateLimit: { ...this.current.rateLimit },
    };

    this.validate(next);
    this.current = next;

    this.logger.ai('Configuración IA actualizada en runtime', {
      provider: next.provider,
      model: next.model,
      apiUrl: next.apiUrl,
      apiKeyLength: next.apiKey.length,
    });

    return next;
  }

  private validate(config: PerplexityConfig): void {
    if (!config.apiKey || config.apiKey.length < 32) {
      throw new Error(
        'La API key debe ser una cadena válida de al menos 32 caracteres'
      );
    }

    const invalidKeys = ['default-key', 'your-api-key', 'example-key', 'test-key'];
    if (invalidKeys.includes(config.apiKey.toLowerCase())) {
      throw new Error('La API key no puede ser un valor de ejemplo');
    }

    if (config.temperature < 0 || config.temperature > 1) {
      throw new Error('AI_TEMPERATURE debe estar entre 0.0 y 1.0');
    }

    if (config.maxTokens < 1 || config.maxTokens > 4000) {
      throw new Error('AI_MAX_TOKENS debe estar entre 1 y 4000');
    }
  }

  /**
   * Versión segura para respuestas HTTP: NUNCA expone la key completa.
   */
  getSafe(): AISafeConfig {
    const { apiKey, ...rest } = this.current;
    return {
      ...rest,
      apiKeyConfigured: apiKey.length > 0,
      apiKeyMasked:
        apiKey.length > 8 ? `${apiKey.substring(0, 6)}...${apiKey.slice(-4)}` : '',
    };
  }
}
