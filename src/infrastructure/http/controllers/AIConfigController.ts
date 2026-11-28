/**
 * Controlador de administración de la configuración IA (CU-31)
 * Endpoints protegidos por requireAdmin:
 *   GET  /api/v1/ai/admin/config        - Config actual (key enmascarada)
 *   PUT  /api/v1/ai/admin/config        - Actualizar provider/model/apiUrl/apiKey
 *   POST /api/v1/ai/admin/config/test   - Verificar conectividad con el proveedor
 */

import type { Request, Response } from 'express';
import type { AIConfigService } from '@infrastructure/config/AIConfigService';
import type { PerplexityService } from '@infrastructure/external-services/ai/PerplexityService';
import type { IAIUsageRecorder } from '@application/ports/external/IAIUsageRecorder';
import { Logger } from '@infrastructure/observability/logger/Logger';

export class AIConfigController {
  private readonly logger = new Logger('AIConfigController');

  constructor(
    private readonly aiConfigService: AIConfigService,
    private readonly aiService: PerplexityService,
    private readonly usageRecorder?: IAIUsageRecorder
  ) {}

  /**
   * GET /api/v1/ai/admin/config
   */
  async getConfig(_req: Request, res: Response): Promise<void> {
    try {
      res.status(200).json({
        success: true,
        data: {
          ...this.aiConfigService.getSafe(),
          proveedores: 'ver src/infrastructure/config/ai.config.ts AI_PROVIDERS',
        },
      });
    } catch (error) {
      this.logger.error('Error obteniendo configuración IA', error);
      res.status(500).json({
        success: false,
        error: 'Error interno obteniendo la configuración IA',
        code: 'INTERNAL_ERROR',
      });
    }
  }

  /**
   * PUT /api/v1/ai/admin/config
   */
  async updateConfig(req: Request, res: Response): Promise<void> {
    try {
      const dto = req.body;
      const updated = this.aiConfigService.update(dto);

      // Aplicar la nueva configuración al servicio en caliente
      this.aiService.updateConfig(updated);

      res.status(200).json({
        success: true,
        data: this.aiConfigService.getSafe(),
        message: 'Configuración IA actualizada correctamente',
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Error interno del servidor';

      this.logger.error('Error actualizando configuración IA', error);

      res.status(message.includes('debe') || message.includes('no puede') ? 400 : 500).json({
        success: false,
        error: message,
        code: message.includes('debe') || message.includes('no puede')
          ? 'VALIDATION_ERROR'
          : 'INTERNAL_ERROR',
      });
    }
  }

  /**
   * POST /api/v1/ai/admin/config/test
   * Verifica que el proveedor configurado responde. Opcionalmente recibe
   * una key candidata sin guardarla (body.apiKey) para probar antes de guardar.
   */
  async testConfig(req: Request, res: Response): Promise<void> {
    // startedAt fuera del try: el catch solo registra si se llegó a
    // intentar la llamada al modelo (los 400 NOT_CONFIGURED / clave
    // corta retornan antes, con startedAt en 0, y NO se registran).
    let startedAt = 0;
    try {
      const candidateApiKey: string | undefined = req.body?.apiKey;

      if (candidateApiKey && candidateApiKey.length < 32) {
        res.status(400).json({
          success: false,
          error: 'La API key debe tener al menos 32 caracteres',
          code: 'VALIDATION_ERROR',
        });
        return;
      }

      const config = this.aiConfigService.get();

      if (!this.aiConfigService.isConfigured() && !candidateApiKey) {
        res.status(400).json({
          success: false,
          error: 'No hay API key configurada. Configúrala antes de probar la conexión.',
          code: 'NOT_CONFIGURED',
        });
        return;
      }

      // Verificar conectividad con una petición mínima de chat completions
      const axiosModule = await import('axios');
      startedAt = Date.now();
      await axiosModule.default.post(
        `${config.apiUrl}/chat/completions`,
        {
          model: config.model,
          messages: [{ role: 'user', content: 'ping' }],
          max_tokens: 1,
        },
        {
          timeout: 15000,
          headers: {
            Authorization: `Bearer ${candidateApiKey || config.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );
      const latencyMs = Date.now() - startedAt;

      // Evento config-test (best-effort, nunca rompe la respuesta).
      await this.recordConfigTest(config, latencyMs, true);

      res.status(200).json({
        success: true,
        data: {
          provider: config.provider,
          model: config.model,
          apiUrl: config.apiUrl,
          latencyMs,
        },
        message: 'Conexión con el proveedor IA verificada correctamente',
      });
    } catch (error) {
      const axiosError = error as {
        response?: { status?: number; data?: unknown };
        message?: string;
      };

      this.logger.error('Test de configuración IA fallido', error);

      // Solo se registra cuando se intentó la llamada al modelo: los
      // 400 NOT_CONFIGURED / clave corta retornan antes (startedAt en 0)
      // y NO se registran.
      if (startedAt > 0) {
        await this.recordConfigTest(this.aiConfigService.get(), Date.now() - startedAt, false);
      }

      res.status(400).json({
        success: false,
        error:
          axiosError.response
            ? `El proveedor respondió ${axiosError.response.status}: verifica modelo, apiUrl y API key`
            : `No se pudo conectar con el proveedor: ${axiosError.message || 'error de red'}`,
        code: 'CONNECTION_ERROR',
      });
    }
  }

  /**
   * Registra un evento `config-test` (best-effort, nunca lanza).
   */
  private async recordConfigTest(
    config: { provider: string; model: string },
    latencyMs: number,
    success: boolean
  ): Promise<void> {
    if (!this.usageRecorder) return;
    try {
      await this.usageRecorder.record({
        provider: config.provider,
        model: config.model,
        operation: 'config-test',
        latencyMs,
        success,
        cached: false,
        userId: null,
      });
    } catch {
      // Best-effort: un fallo del registro no rompe la respuesta.
    }
  }
}
