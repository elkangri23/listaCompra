/**
 * Tests unitarios para AddProduct
 */

import { AddProduct } from '../../../../../src/application/use-cases/products/AddProduct';
import type { IProductoRepository } from '../../../../../src/application/ports/repositories/IProductoRepository';
import type { IListaRepository } from '../../../../../src/application/ports/repositories/IListaRepository';
import type { ICategoriaRepository } from '../../../../../src/application/ports/repositories/ICategoriaRepository';
import type { ITiendaRepository } from '../../../../../src/application/ports/repositories/ITiendaRepository';
import type { IAIService } from '../../../../../src/application/ports/external/IAIService';
import { success, failure } from '../../../../../src/shared/result';
import { ValidationError } from '../../../../../src/application/errors/ValidationError';
import { NotFoundError } from '../../../../../src/application/errors/NotFoundError';

describe('AddProduct', () => {
  let useCase: AddProduct;
  let mockProductoRepository: jest.Mocked<IProductoRepository>;
  let mockListaRepository: jest.Mocked<IListaRepository>;
  let mockCategoriaRepository: jest.Mocked<ICategoriaRepository>;
  let mockTiendaRepository: jest.Mocked<ITiendaRepository>;
  let mockAIService: jest.Mocked<IAIService>;

  const usuarioId = 'user-test-id';
  const listaId = 'lista-test-id';

  beforeEach(() => {
    mockProductoRepository = {
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
      deleteAllByList: jest.fn()
    } as jest.Mocked<IProductoRepository>;

    mockListaRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findByIdAndOwner: jest.fn(),
      findByOwner: jest.fn(),
      findByNameAndOwner: jest.fn(),
      deleteById: jest.fn(),
      hardDelete: jest.fn(),
      existsById: jest.fn(),
      existsByNameAndOwner: jest.fn(),
      countByOwner: jest.fn(),
      updateActiveStatus: jest.fn()
    } as jest.Mocked<IListaRepository>;

    mockCategoriaRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findByTienda: jest.fn(),
      findAll: jest.fn(),
      existsById: jest.fn(),
      existsByNombreAndTienda: jest.fn(),
      countByTienda: jest.fn(),
      deleteById: jest.fn(),
      findByNombre: jest.fn(),
      findGeneral: jest.fn()
    } as any;

    mockTiendaRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
      findByNombre: jest.fn(),
      existsById: jest.fn(),
      existsByNombre: jest.fn(),
      countAll: jest.fn(),
      deleteById: jest.fn()
    } as any;

    mockAIService = {
      suggestCategories: jest.fn(),
      analyzePurchaseHabits: jest.fn(),
      recommendProducts: jest.fn(),
      generateShoppingList: jest.fn(),
      optimizeShoppingRoute: jest.fn(),
      predictPrices: jest.fn(),
      detectDuplicates: jest.fn(),
      validateProduct: jest.fn(),
      translateContent: jest.fn(),
      generateInsights: jest.fn()
    } as any;

    useCase = new AddProduct({
      productoRepository: mockProductoRepository,
      listaRepository: mockListaRepository,
      categoriaRepository: mockCategoriaRepository,
      tiendaRepository: mockTiendaRepository,
      aiService: mockAIService
    });
  });

  describe('execute', () => {
    it('debería fallar con datos de entrada inválidos - usuarioId vacío', async () => {
      // Arrange
      const dto = {
        listaId,
        nombre: 'Producto Test',
        cantidad: 1
      };

      // Act
      const result = await useCase.execute(dto, ''); // usuarioId vacío

      // Assert
      expect(result.isSuccess).toBe(false);
      if (!result.isSuccess) {
        expect(result.error).toBeInstanceOf(ValidationError);
      }
    });

    it('debería fallar si la lista ID está vacía', async () => {
      // Arrange
      const dto = {
        listaId: '', // listaId vacío
        nombre: 'Producto Test',
        cantidad: 1
      };

      // Act
      const result = await useCase.execute(dto, usuarioId);

      // Assert
      expect(result.isSuccess).toBe(false);
      if (!result.isSuccess) {
        expect(result.error).toBeInstanceOf(ValidationError);
      }
    });

    it('debería fallar si la lista no existe', async () => {
      // Arrange
      const dto = {
        listaId,
        nombre: 'Producto Test',
        cantidad: 1
      };

      mockListaRepository.findByIdAndOwner.mockResolvedValue(success(null));

      // Act
      const result = await useCase.execute(dto, usuarioId);

      // Assert
      expect(result.isSuccess).toBe(false);
      if (!result.isSuccess) {
        expect(result.error).toBeInstanceOf(NotFoundError);
      }
    });

    it('debería manejar errores del repositorio de listas', async () => {
      // Arrange
      const dto = {
        listaId,
        nombre: 'Producto Test',
        cantidad: 1
      };

      mockListaRepository.findByIdAndOwner.mockResolvedValue(
        failure(new Error('Error de base de datos'))
      );

      // Act
      const result = await useCase.execute(dto, usuarioId);

      // Assert
      expect(result.isSuccess).toBe(false);
      if (!result.isSuccess) {
        expect(result.error.message).toBe('Error de base de datos');
      }
    });

    it('debería fallar si el usuario no es propietario de la lista', async () => {
      // Arrange
      const dto = {
        listaId,
        nombre: 'Producto Test',
        cantidad: 1
      };

      // Mock lista que no pertenece al usuario - debe retornar null cuando no es propietario
      mockListaRepository.findByIdAndOwner.mockResolvedValue(success(null));

      // Act
      const result = await useCase.execute(dto, usuarioId);

      // Assert
      expect(result.isSuccess).toBe(false);
      if (!result.isSuccess) {
        expect(result.error).toBeInstanceOf(NotFoundError);
      }
    });

    it('debería manejar errores del repositorio de productos', async () => {
      // Arrange
      const dto = {
        listaId,
        nombre: 'Producto Test',
        cantidad: 1
      };

      // Mock lista válida con todos los métodos necesarios
      const mockLista = {
        id: listaId,
        nombre: 'Lista Test',
        propietarioId: usuarioId,
        esPropietario: jest.fn().mockReturnValue(true),
        estaActiva: jest.fn().mockReturnValue(true)
      };

      mockListaRepository.findByIdAndOwner.mockResolvedValue(success(mockLista as any));
      mockProductoRepository.countByList.mockResolvedValue(success(10)); // Mock count de productos
      mockProductoRepository.save.mockResolvedValue(
        failure(new Error('Error guardando producto'))
      );

      // Act
      const result = await useCase.execute(dto, usuarioId);

      // Assert
      expect(result.isSuccess).toBe(false);
      if (!result.isSuccess) {
        expect(result.error.message).toBe('Error guardando producto');
      }
    });
  });
});