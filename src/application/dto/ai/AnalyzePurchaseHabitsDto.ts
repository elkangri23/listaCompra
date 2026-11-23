/**
 * DTOs y validación para CU-30: Análisis de Hábitos de Compra
 * Endpoint: GET /api/v1/ai/purchase-habits/:userId
 */

import { z } from 'zod';

/**
 * Presets de rango temporal admitidos
 */
export const TIME_RANGE_PRESETS = ['30d', '90d', '365d', 'all'] as const;
export type TimeRangePreset = (typeof TIME_RANGE_PRESETS)[number];

const timeRangePresetSchema = z.enum(TIME_RANGE_PRESETS);

/**
 * Schema de validación de la petición
 */
export const analyzePurchaseHabitsSchema = z.object({
  userId: z
    .string()
    .uuid('ID de usuario inválido'),
  timeRange: timeRangePresetSchema
    .default('90d'),
});

export type AnalyzePurchaseHabitsDto = z.infer<typeof analyzePurchaseHabitsSchema>;

/**
 * Presets → días hacia atrás (null = todo el historial)
 */
export const PRESET_DAYS: Record<TimeRangePreset, number | null> = {
  '30d': 30,
  '90d': 90,
  '365d': 365,
  'all': null,
};

/**
 * Respuesta del caso de uso
 */
export interface PurchaseHabitsResponse {
  insights: Array<{
    type: 'frequency' | 'seasonal' | 'preference' | 'optimization';
    title: string;
    description: string;
    data?: Record<string, any>;
    confidence: number;
  }>;
  metadata: {
    period: {
      start: string | null;
      end: string;
      preset: TimeRangePreset;
    };
    productsAnalyzed: number;
    listsAnalyzed: number;
    generatedAt: string;
  };
}

/**
 * Valida y parsea los parámetros del caso de uso.
 * Lanza ValidationError (mensaje legible) si algo falla.
 */
export function validateAnalyzePurchaseHabitsDto(
  input: unknown
): AnalyzePurchaseHabitsDto {
  const result = analyzePurchaseHabitsSchema.safeParse(input);
  if (!result.success) {
    const first = result.error.issues[0];
    const message = first
      ? `${first.path.join('.') || 'campo'}: ${first.message}`
      : 'Datos de entrada inválidos';
    throw new Error(message);
  }
  return result.data;
}
