/**
 * DTOs para funcionalidades de Inteligencia Artificial
 */

export interface GetCategorySuggestionsDto {
  productName: string;
  storeName?: string;
  existingCategories?: string[];
  language?: 'es' | 'en';
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