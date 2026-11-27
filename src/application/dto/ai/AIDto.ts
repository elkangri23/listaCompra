/**
 * DTOs para funcionalidades de Inteligencia Artificial
 */

export interface GetCategorySuggestionsDto {
  productName: string;
  storeName?: string;
  existingCategories?: string[];
  language?: 'es' | 'en';
  /** ID del usuario autenticado (desde el token). Sin él no hay personalización. */
  userId?: string;
}

export interface CategorySuggestionResponseDto {
  suggestions: Array<{
    category: string;
    confidence: number;
    reasoning?: string;
  }>;
  productName: string;
  storeName?: string; // Hacer opcional para coincidir con el input
  cached: boolean;
  requestId: string;
  timestamp: string;
  /** true si la sugerencia usó ejemplos del historial del usuario */
  personalized: boolean;
  /** nº de ejemplos del historial incluidos en el prompt */
  examplesUsed: number;
}

export interface AnalyzePurchaseHabitsDto {
  userId: string;
  timeRange?: {
    startDate: Date;
    endDate: Date;
  };
  includeInsights?: boolean;
  includeRecommendations?: boolean;
}

export interface PurchaseAnalysisResponseDto {
  insights: Array<{
    type: 'frequency' | 'seasonal' | 'preference' | 'optimization';
    title: string;
    description: string;
    data?: Record<string, any>;
    confidence: number;
  }>;
  recommendations?: Array<{
    productName: string;
    category: string;
    reasoning: string;
    confidence: number;
    priority: 'high' | 'medium' | 'low';
  }>;
  analysisDate: string;
  requestId: string;
}