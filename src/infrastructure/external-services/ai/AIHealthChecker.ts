/**
 * Comprobación HONESTA de salud del proveedor IA (panel admin, fase 3).
 * Hace un ping real (chat completion mínima, max_tokens 1) al proveedor
 * configurado. Los pings de salud NO se registran como eventos de uso.
 * El resultado se cachea en memoria 60 s a nivel de instancia.
 */

import axios from 'axios';
import type { AIConfigService } from '../../config/AIConfigService';
import { Logger } from '../../observability/logger/Logger';

export interface AIHealthCheckResult {
  status: 'healthy' | 'degraded';
  provider: string;
  model: string;
  latencyMs: number | null;
  reason?: string;
  checkedAt: string;
  cached: boolean;
}

const CACHE_TTL_MS = 60_000;
const PING_TIMEOUT_MS = 10_000;

export class AIHealthChecker {
  private readonly logger = new Logger('AIHealthChecker');
  private cachedResult: AIHealthCheckResult | null = null;
  private cachedAtMs = 0;

  constructor(private readonly aiConfigService: AIConfigService) {}

  async check(): Promise<AIHealthCheckResult> {
    const nowMs = Date.now();
    if (this.cachedResult && nowMs - this.cachedAtMs < CACHE_TTL_MS) {
      return { ...this.cachedResult, cached: true };
    }

    const result = await this.checkNow();
    this.cachedResult = { ...result, cached: false };
    this.cachedAtMs = nowMs;
    return this.cachedResult;
  }

  private async checkNow(): Promise<AIHealthCheckResult> {
    const config = this.aiConfigService.get();
    const checkedAt = new Date().toISOString();
    const base = {
      provider: config.provider,
      model: config.model,
      checkedAt,
    };

    if (!this.aiConfigService.isConfigured()) {
      return { ...base, status: 'degraded', latencyMs: null, reason: 'NOT_CONFIGURED', cached: false };
    }

    const startedAt = Date.now();
    try {
      await axios.post(
        `${config.apiUrl}/chat/completions`,
        {
          model: config.model,
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 1,
        },
        {
          timeout: PING_TIMEOUT_MS,
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );
      return { ...base, status: 'healthy', latencyMs: Date.now() - startedAt, cached: false };
    } catch (error) {
      // Reason corto y seguro: el detalle se loguea, nunca se devuelve
      // (podría contener fragmentos de la respuesta del proveedor).
      this.logger.error('Health check de IA fallido', error instanceof Error ? error : new Error(String(error)), {
        provider: config.provider,
        status: (error as { response?: { status?: number } }).response?.status,
      });
      return { ...base, status: 'degraded', latencyMs: null, reason: 'PROVIDER_ERROR', cached: false };
    }
  }
}
