/**
 * Operaciones de IA que se registran como eventos de uso real.
 * Solo las operaciones que consumen (o intentan consumir) el modelo.
 */
export type AIUsageOperation =
  | 'category-suggestions'
  | 'bulk-categorize'
  | 'config-test';

/**
 * Evento de uso de IA a registrar.
 *
 * userId es siempre null hoy: la capa de servicio no conoce al usuario y
 * los agregados que se exponen en GET /ai/usage son globales, no por
 * usuario. Se mantiene el campo (nullable, sin FK) por si en el futuro
 * se decide registrar el usuario desde la capa HTTP.
 */
export interface AIUsageEventInput {
  provider: string;
  model: string;
  operation: AIUsageOperation;
  latencyMs: number;
  success: boolean;
  cached: boolean;
  userId?: string | null;
}

/**
 * Puerto de registro de uso de IA (best-effort).
 *
 * La implementación NUNCA lanza: un fallo al registrar (BD caída, repo
 * que rechaza...) no puede romper la operación de IA que se está
 * registrando. DECISIÓN: el fallback por reglas NO es una llamada al
 * modelo y NO cuenta como éxito de IA → se registra con success=false.
 */
export interface IAIUsageRecorder {
  record(event: AIUsageEventInput): Promise<void>;
}
