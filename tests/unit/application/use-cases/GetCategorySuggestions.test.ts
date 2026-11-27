/**
 * Tests unitarios para GetCategorySuggestionsUseCase
 * Verifica la lógica de categorización automática con IA
 */

import { GetCategorySuggestionsUseCase } from '../../../../src/application/use-cases/ai/GetCategorySuggestions';
import type { IAIService, CategorySuggestion } from '../../../../src/application/ports/external/IAIService';
import type { GetCategorySuggestionsDto } from '../../../../src/application/dto/ai/AIDto';
import { ValidationError } from '../../../../src/application/errors/ValidationError';
import { success, failure } from '@shared/result';
import type { IProductoRepository } from '../../../../src/application/ports/repositories/IProductoRepository';
import type { ICategoriaRepository } from '../../../../src/application/ports/repositories/ICategoriaRepository';
import type { Producto } from '../../../../src/domain/entities/Producto';
import type { Categoria } from '../../../../src/domain/entities/Categoria';

// Mocks de repositorios (historial del usuario)
const mockProductoRepository: jest.Mocked<IProductoRepository> = {
  save: jest.fn(),
  findById: jest.fn(),
  findByIdAndList: jest.fn(),
  findByList: jest.fn(),
  findByNameAndList: jest.fn(),
  deleteById: jest.fn(),
  existsById: jest.fn(),
  countByList: jest.fn(),
  getResumenByList: jest.fn(),
  markAllAsPurchased: jest.fn(),
  findByCategory: jest.fn(),
  findUrgentByUser: jest.fn(),
  findCategorizedByUser: jest.fn(),
  deleteAllByList: jest.fn(),
  updateOrden: jest.fn()
};

const mockCategoriaRepository: jest.Mocked<ICategoriaRepository> = {
  save: jest.fn(),
  update: jest.fn(),
  findById: jest.fn(),
  findByTienda: jest.fn(),
  findAll: jest.fn(),
  findByNombre: jest.fn(),
  findByColor: jest.fn(),
  existsByNombreAndTienda: jest.fn(),
  delete: jest.fn(),
  countByTienda: jest.fn(),
  search: jest.fn(),
  getMostUsed: jest.fn(),
  moveToTienda: jest.fn(),
  deactivateByTienda: jest.fn(),
  getStats: jest.fn()
};

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
    mockProductoRepository.findCategorizedByUser.mockResolvedValue(success([]));
    useCase = new GetCategorySuggestionsUseCase({
      aiService: mockAIService,
      productoRepository: mockProductoRepository,
      categoriaRepository: mockCategoriaRepository
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
        ['Bebidas', 'Carne'], // Actualizar las categorías
        [],
        'supermercado general español'
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

    describe('personalización por historial del usuario', () => {
      const historyProducts = [
        { nombre: 'Leche entera', categoriaId: 'cat-lacteos', fechaActualizacion: new Date('2026-11-20T10:00:00Z') },
        { nombre: 'Leche desnatada', categoriaId: 'cat-lacteos', fechaActualizacion: new Date('2026-11-21T10:00:00Z') },
        { nombre: 'Pan de molde', categoriaId: 'cat-panaderia', fechaActualizacion: new Date('2026-11-22T10:00:00Z') }
      ];

      beforeEach(() => {
        mockProductoRepository.findCategorizedByUser.mockResolvedValue(
          success(historyProducts as unknown as Producto[])
        );
        mockCategoriaRepository.findById.mockImplementation(async (id: string) =>
          success({ nombre: id === 'cat-lacteos' ? 'Lácteos' : 'Panadería' } as unknown as Categoria)
        );
      });

      it('con userId e historial, pasa los ejemplos a la IA y marca personalized', async () => {
        const dto: GetCategorySuggestionsDto = { productName: 'Leche semidesnatada', userId: 'user-1' };
        mockAIService.suggestCategories.mockResolvedValue([{ category: 'Lácteos', confidence: 0.97 }]);

        const result = await useCase.execute(dto);

        expect(result.isSuccess).toBe(true);
        expect(mockProductoRepository.findCategorizedByUser).toHaveBeenCalledWith('user-1', 200);
        expect(mockAIService.suggestCategories).toHaveBeenCalledWith(
          'Leche semidesnatada',
          undefined,
          undefined,
          [
            { productName: 'Leche desnatada', category: 'Lácteos' },
            { productName: 'Leche entera', category: 'Lácteos' }
          ],
          undefined
        );
        if (result.isSuccess) {
          expect(result.value.personalized).toBe(true);
          expect(result.value.examplesUsed).toBe(2);
        }
      });

      it('con userId sin historial, se comporta como antes (genérico)', async () => {
        mockProductoRepository.findCategorizedByUser.mockResolvedValue(success([]));
        const dto: GetCategorySuggestionsDto = { productName: 'Leche', userId: 'user-1' };
        mockAIService.suggestCategories.mockResolvedValue([{ category: 'Lácteos', confidence: 0.9 }]);

        const result = await useCase.execute(dto);

        expect(result.isSuccess).toBe(true);
        expect(mockAIService.suggestCategories).toHaveBeenCalledWith('Leche', undefined, undefined, [], undefined);
        if (result.isSuccess) {
          expect(result.value.personalized).toBe(false);
          expect(result.value.examplesUsed).toBe(0);
        }
      });

      it('sin userId no consulta el historial', async () => {
        const dto: GetCategorySuggestionsDto = { productName: 'Leche' };
        mockAIService.suggestCategories.mockResolvedValue([{ category: 'Lácteos', confidence: 0.9 }]);

        const result = await useCase.execute(dto);

        expect(result.isSuccess).toBe(true);
        expect(mockProductoRepository.findCategorizedByUser).not.toHaveBeenCalled();
        expect(mockAIService.suggestCategories).toHaveBeenCalledWith('Leche', undefined, undefined, [], undefined);
        if (result.isSuccess) {
          expect(result.value.personalized).toBe(false);
          expect(result.value.examplesUsed).toBe(0);
        }
      });

      it('si el historial falla, la sugerencia sigue siendo genérica', async () => {
        mockProductoRepository.findCategorizedByUser.mockResolvedValue(
          failure(new Error('BD caída'))
        );
        const dto: GetCategorySuggestionsDto = { productName: 'Leche', userId: 'user-1' };
        mockAIService.suggestCategories.mockResolvedValue([{ category: 'Lácteos', confidence: 0.9 }]);

        const result = await useCase.execute(dto);

        expect(result.isSuccess).toBe(true);
        expect(mockAIService.suggestCategories).toHaveBeenCalledWith('Leche', undefined, undefined, [], undefined);
        if (result.isSuccess) {
          expect(result.value.personalized).toBe(false);
          expect(result.value.examplesUsed).toBe(0);
        }
      });

      it('sin repositorios inyectados (solo aiService), la sugerencia es genérica', async () => {
        const useCaseSinRepos = new GetCategorySuggestionsUseCase({ aiService: mockAIService });
        const dto: GetCategorySuggestionsDto = { productName: 'Leche', userId: 'user-1' };
        mockAIService.suggestCategories.mockResolvedValue([{ category: 'Lácteos', confidence: 0.9 }]);

        const result = await useCaseSinRepos.execute(dto);

        expect(result.isSuccess).toBe(true);
        expect(mockAIService.suggestCategories).toHaveBeenCalledWith('Leche', undefined, undefined, [], undefined);
        if (result.isSuccess) {
          expect(result.value.personalized).toBe(false);
          expect(result.value.examplesUsed).toBe(0);
        }
      });

      it('mantiene y prioriza las sugerencias que ya son categorías del usuario', async () => {
        const dto: GetCategorySuggestionsDto = {
          productName: 'Leche',
          existingCategories: ['Lácteos', 'Bebidas']
        };
        mockAIService.suggestCategories.mockResolvedValue([
          { category: 'Bebidas', confidence: 0.8 },
          { category: 'Lácteos', confidence: 0.9 },
          { category: 'Otros', confidence: 0.7 }
        ]);

        const result = await useCase.execute(dto);

        expect(result.isSuccess).toBe(true);
        if (result.isSuccess) {
          expect(result.value.suggestions.map(s => s.category)).toEqual(['Lácteos', 'Bebidas', 'Otros']);
        }
      });
    });
  });
});
