/**
 * Tests unitarios para GetCategorySuggestionsUseCase
 * Verifica la lógica de categorización automática con IA
 */

import { GetCategorySuggestionsUseCase } from '../../../../src/application/use-cases/ai/GetCategorySuggestions';
import { IAIService, CategorySuggestion } from '../../../../src/application/ports/external/IAIService';
import { GetCategorySuggestionsDto } from '../../../../src/application/dto/ai/AIDto';
import { ValidationError } from '../../../../src/application/errors/ValidationError';

// Mock del servicio de IA
const mockAIService: jest.Mocked<IAIService> = {
  suggestCategories: jest.fn(),
  analyzePurchaseHabits: jest.fn(),
  recommendProducts: jest.fn(),
  analyzeWithAI: jest.fn(),
  isAvailable: jest.fn(),
  getUsageInfo: jest.fn(),
  generateOccasionList: jest.fn(),
  getProductRecommendations: jest.fn(),
  bulkCategorizeProducts: jest.fn()
};

describe('GetCategorySuggestionsUseCase', () => {
  let useCase: GetCategorySuggestionsUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    useCase = new GetCategorySuggestionsUseCase({
      aiService: mockAIService
    });
  });

  describe('execute', () => {
    it('debe devolver sugerencias válidas para un producto normal', async () => {
      // Arrange
      const dto: GetCategorySuggestionsDto = {
        productName: 'Leche desnatada',
        storeName: 'Mercadona',
        existingCategories: ['Bebidas', 'Carne'] // No incluir "Lácteos"
      };

      const mockSuggestions: CategorySuggestion[] = [
        {
          category: 'Lácteos',
          confidence: 0.95,
          reasoning: 'La leche es claramente un producto lácteo'
        }
      ];

      mockAIService.suggestCategories.mockResolvedValue(mockSuggestions);

      // Act
      const result = await useCase.execute(dto);

      // Assert
      expect(result.isSuccess).toBe(true);
      if (result.isSuccess) {
        expect(result.value.suggestions).toHaveLength(1);
        const firstSuggestion = result.value.suggestions[0];
        expect(firstSuggestion).toBeDefined();
        expect(firstSuggestion!.category).toBe('Lácteos');
        expect(firstSuggestion!.confidence).toBe(0.95);
        expect(result.value.productName).toBe('Leche desnatada');
      }

      expect(mockAIService.suggestCategories).toHaveBeenCalledWith(
        'Leche desnatada',
        'Mercadona',
        ['Bebidas', 'Carne'] // Actualizar las categorías
      );
    });

    it('debe validar que el nombre del producto no esté vacío', async () => {
      // Arrange
      const dto: GetCategorySuggestionsDto = {
        productName: '',
        storeName: 'Mercadona'
      };

      // Act
      const result = await useCase.execute(dto);

      // Assert
      expect(result.isFailure).toBe(true);
      if (result.isFailure) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toContain('nombre del producto');
      }

      expect(mockAIService.suggestCategories).not.toHaveBeenCalled();
    });

    it('debe validar que el nombre del producto no sea solo espacios', async () => {
      // Arrange
      const dto: GetCategorySuggestionsDto = {
        productName: '   ',
        storeName: 'Mercadona'
      };

      // Act
      const result = await useCase.execute(dto);

      // Assert
      expect(result.isFailure).toBe(true);
      if (result.isFailure) {
        expect(result.error).toBeInstanceOf(ValidationError);
      }

      expect(mockAIService.suggestCategories).not.toHaveBeenCalled();
    });

    it('debe validar productos con nombres muy largos', async () => {
      // Arrange
      const longName = 'a'.repeat(101); // 101 caracteres
      const dto: GetCategorySuggestionsDto = {
        productName: longName
      };

      // Act
      const result = await useCase.execute(dto);

      // Assert
      expect(result.isFailure).toBe(true);
      if (result.isFailure) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toContain('no puede exceder 100 caracteres');
      }

      expect(mockAIService.suggestCategories).not.toHaveBeenCalled();
    });

    it('debe detectar patrones sospechosos en el nombre del producto', async () => {
      // Arrange
      const dto: GetCategorySuggestionsDto = {
        productName: '<script>alert("hack")</script>'
      };

      // Act
      const result = await useCase.execute(dto);

      // Assert
      expect(result.isFailure).toBe(true);
      if (result.isFailure) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toContain('caracteres no válidos');
      }

      expect(mockAIService.suggestCategories).not.toHaveBeenCalled();
    });

    it('debe filtrar sugerencias con baja confianza', async () => {
      // Arrange
      const dto: GetCategorySuggestionsDto = {
        productName: 'Producto ambiguo'
      };

      const mockSuggestions: CategorySuggestion[] = [
        {
          category: 'Categoría segura',
          confidence: 0.95
        },
        {
          category: 'Categoría incierta',
          confidence: 0.3
        },
        {
          category: 'Otra categoría buena',
          confidence: 0.8
        }
      ];

      mockAIService.suggestCategories.mockResolvedValue(mockSuggestions);

      // Act
      const result = await useCase.execute(dto);

      // Assert
      expect(result.isSuccess).toBe(true);
      if (result.isSuccess) {
        // Solo debería devolver sugerencias con confianza >= 0.3
        expect(result.value.suggestions).toHaveLength(3);
        expect(result.value.suggestions.every(s => s.confidence >= 0.3)).toBe(true);
      }
    });

    it('debe normalizar nombres de categorías', async () => {
      // Arrange
      const dto: GetCategorySuggestionsDto = {
        productName: 'Pan integral'
      };

      const mockSuggestions: CategorySuggestion[] = [
        {
          category: '  PANADERÍA  ', // Con espacios y mayúsculas
          confidence: 0.9
        }
      ];

      mockAIService.suggestCategories.mockResolvedValue(mockSuggestions);

      // Act
      const result = await useCase.execute(dto);

      // Assert
      expect(result.isSuccess).toBe(true);
      if (result.isSuccess) {
        const firstSuggestion = result.value.suggestions[0];
        expect(firstSuggestion).toBeDefined();
        expect(firstSuggestion!.category).toBe('Panadería');
      }
    });

    it('debe manejar errores del servicio de IA gracefully', async () => {
      // Arrange
      const dto: GetCategorySuggestionsDto = {
        productName: 'Producto test'
      };

      mockAIService.suggestCategories.mockRejectedValue(
        new Error('API no disponible')
      );

      // Act
      const result = await useCase.execute(dto);

      // Assert
      expect(result.isFailure).toBe(true);
      if (result.isFailure) {
        expect(result.error.message).toContain('API no disponible');
      }
    });

    it('debe incluir requestId único en cada respuesta', async () => {
      // Arrange
      const dto: GetCategorySuggestionsDto = {
        productName: 'Producto test'
      };

      mockAIService.suggestCategories.mockResolvedValue([
        { category: 'Test', confidence: 0.8 }
      ]);

      // Act
      const result1 = await useCase.execute(dto);
      const result2 = await useCase.execute(dto);

      // Assert
      expect(result1.isSuccess).toBe(true);
      expect(result2.isSuccess).toBe(true);
      
      if (result1.isSuccess && result2.isSuccess) {
        expect(result1.value.requestId).toBeDefined();
        expect(result2.value.requestId).toBeDefined();
        expect(result1.value.requestId).not.toBe(result2.value.requestId);
      }
    });
  });
});