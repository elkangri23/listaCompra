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

import type { AIConfig, AIProviderId, PerplexityConfig} from './ai.config';
import { getAIProviderMeta, getDefaultModelForProvider } from './ai.config';
import { Logger } from '@infrastructure/observability/logger/Logger';
import { persistEnvVars } from './EnvFileWriter';

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

  constructor(
    initial?: PerplexityConfig,
    private readonly persistToEnv = true
  ) {
    this.current = initial ?? AIConfigService.fromEnvironment();
  }

  /**
   * Construye la configuración desde variables de entorno (sin lanzar si
   * falta la key: el servicio queda sin configurar y los endpoints IA
   * devuelven error de configuración en runtime).
   *
   * Proveedor por defecto: FREE_LLMAPI (AI_PROVIDER=freellmapi). Cada
   * proveedor tiene su propia variable de API key (ver AI_PROVIDERS).
   */
  static fromEnvironment(): PerplexityConfig {
    const provider = process.env['AI_PROVIDER'] || 'freellmapi';
    const meta = getAIProviderMeta(provider);

    // API key específica del proveedor (con fallback a PERPLEXITY_API_KEY
    // por compatibilidad con instalaciones anteriores)
    const apiKey =
      process.env[meta?.apiKeyEnv ?? 'FREE_LLMAPI_API_KEY'] ||
      (provider === 'perplexity'
        ? ''
        : process.env['PERPLEXITY_API_KEY'] || '');

    const apiUrl =
      process.env[meta?.apiUrlEnv ?? 'FREE_LLMAPI_API_URL'] ||
      meta?.apiUrlPorDefecto ||
      '';

    return {
      provider,
      apiKey,
      apiUrl,
      model:
        process.env[meta?.modelEnv ?? 'AI_MODEL'] ||
        process.env['AI_MODEL'] ||
        getDefaultModelForProvider(provider),
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
   *
   * Tras aplicar el cambio persiste en .env (Opción B): AI_PROVIDER y las
   * variables específicas del proveedor resultante (key, url y modelo).
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

    // Opción B: hacer perdurable el cambio en .env (nunca lanza)
    this.persistToEnvFile(next);

    this.logger.ai('Configuración IA actualizada en runtime', {
      provider: next.provider,
      model: next.model,
      apiUrl: next.apiUrl,
      apiKeyLength: next.apiKey.length,
    });

    return next;
  }

  /**
   * Escribe en .env las variables que definen la configuración activa:
   * el proveedor y las env vars propias del proveedor (key, url, modelo).
   * Se desactiva en tests para no tocar el .env del repo.
   */
  private persistToEnvFile(config: PerplexityConfig): void {
    if (!this.persistToEnv || process.env['NODE_ENV'] === 'test') {
      return;
    }

    const meta = getAIProviderMeta(config.provider);
    const updates: Record<string, string> = {
      AI_PROVIDER: config.provider,
    };

    if (meta) {
      if (meta.apiKeyEnv) updates[meta.apiKeyEnv] = config.apiKey;
      if (meta.modelEnv && config.model) updates[meta.modelEnv] = config.model;
      if (meta.apiUrlEnv && config.apiUrl) updates[meta.apiUrlEnv] = config.apiUrl;
    }

    persistEnvVars(updates);
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
