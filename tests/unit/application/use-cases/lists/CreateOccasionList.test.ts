/**
 * Tests para CreateOccasionList use case
 * Prueba la funcionalidad de generación de listas inteligentes por ocasión (CU-32)
 */

import { CreateOccasionListUseCase } from '../../../../../src/application/use-cases/lists/CreateOccasionList';
import { CreateOccasionListDto } from '../../../../../src/application/dto/lists/CreateOccasionListDto';
import { success, failure } from '../../../../../src/shared/result';
import { ValidationError } from '../../../../../src/application/errors/ValidationError';
import { NotFoundError } from '../../../../../src/application/errors/NotFoundError';
import { Lista } from '../../../../../src/domain/entities/Lista';
import { Producto } from '../../../../../src/domain/entities/Producto';
import { Tienda } from '../../../../../src/domain/entities/Tienda';

// Mocks
const mockAIService = {
  generateOccasionList: jest.fn(),
  suggestCategories: jest.fn(),
  analyzePurchaseHabits: jest.fn(),
  recommendProducts: jest.fn(),
  analyzeWithAI: jest.fn(),
  isAvailable: jest.fn(),
  getUsageInfo: jest.fn()
};

const mockListaRepository = {
  save: jest.fn(),
  update: jest.fn(),
  findById: jest.fn(),
  findByPropietario: jest.fn(),
  findSharedLists: jest.fn(),
  delete: jest.fn(),
  existsByNombre: jest.fn(),
  findAll: jest.fn()
};

const mockProductoRepository = {
  save: jest.fn(),
  update: jest.fn(),
  findById: jest.fn(),
  findByLista: jest.fn(),
  findByCategoria: jest.fn(),
  findByNombre: jest.fn(),
  delete: jest.fn(),
  markAsPurchased: jest.fn(),
  getStatistics: jest.fn(),
  findAll: jest.fn()
};

const mockTiendaRepository = {
  findById: jest.fn(),
  findAll: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  findByNombre: jest.fn(),
  existsByNombre: jest.fn()
};

const mockCategoriaRepository = {
  findByTienda: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
  findById: jest.fn(),
  findAll: jest.fn(),
  delete: jest.fn(),
  findByNombre: jest.fn(),
  findByColor: jest.fn(),
  existsByNombre: jest.fn()
};

const dependencies = {
  aiService: mockAIService,
  listaRepository: mockListaRepository,
  productoRepository: mockProductoRepository,
  tiendaRepository: mockTiendaRepository,
  categoriaRepository: mockCategoriaRepository
};

describe('CreateOccasionListUseCase', () => {
  let useCase: CreateOccasionListUseCase;

  beforeEach(() => {
    useCase = new CreateOccasionListUseCase(dependencies);
    jest.clearAllMocks();
  });

  describe('Validación de entrada', () => {
    it('debe fallar si la ocasión está vacía', async () => {
      const dto: CreateOccasionListDto = {
        occasion: '',
        numberOfPeople: 4
      };

      const result = await useCase.execute(dto, 'user-123');

      expect(result.isFailure).toBe(true);
      expect(result.error).toBeInstanceOf(ValidationError);
      expect(result.error?.message).toContain('ocasión es requerida');
    });

    it('debe fallar si el número de personas es inválido', async () => {
      const dto: CreateOccasionListDto = {
        occasion: 'Barbacoa',
        numberOfPeople: 0
      };

      const result = await useCase.execute(dto, 'user-123');

      expect(result.isFailure).toBe(true);
      expect(result.error).toBeInstanceOf(ValidationError);
      expect(result.error?.message).toContain('número de personas debe ser al menos 1');
    });

    it('debe fallar si el presupuesto es negativo', async () => {
      const dto: CreateOccasionListDto = {
        occasion: 'Barbacoa',
        numberOfPeople: 4,
        maxBudget: -10
      };

      const result = await useCase.execute(dto, 'user-123');

      expect(result.isFailure).toBe(true);
      expect(result.error).toBeInstanceOf(ValidationError);
      expect(result.error?.message).toContain('presupuesto no puede ser negativo');
    });

    it('debe validar exitosamente un DTO correcto', async () => {
      const dto: CreateOccasionListDto = {
        occasion: 'Barbacoa familiar',
        numberOfPeople: 6,
        maxBudget: 80,
        dietaryRestrictions: ['sin gluten'],
        additionalPreferences: 'Productos frescos'
      };

      // Setup mocks para éxito
      mockTiendaRepository.findAll.mockResolvedValue(success([]));
      mockCategoriaRepository.findByTienda.mockResolvedValue(success([]));
      mockAIService.generateOccasionList.mockResolvedValue(JSON.stringify({
        products: [{
          name: 'Carne para asar',
          quantity: 2,
          unit: 'kg',
          category: 'Carnes',
          estimatedPrice: 18.5,
          priority: 1,
          reason: 'Esencial para barbacoa'
        }]
      }));

      const lista = Lista.create({
        nombre: 'Test Lista',
        propietarioId: 'user-123'
      });
      mockListaRepository.save.mockResolvedValue(success(lista.value));

      const producto = Producto.create({
        nombre: 'Test Producto',
        listaId: 'lista-123',
        creadoPorId: 'user-123'
      });
      mockProductoRepository.save.mockResolvedValue(success(producto.value));

      const result = await useCase.execute(dto, 'user-123');

      expect(result.isSuccess).toBe(true);
    });
  });

  describe('Manejo de tiendas', () => {
    it('debe usar tienda especificada si existe', async () => {
      const dto: CreateOccasionListDto = {
        occasion: 'Barbacoa',
        numberOfPeople: 4,
        storeId: 'tienda-123'
      };

      const tienda = Tienda.create({
        nombre: 'Supermercado Test',
        propietarioId: 'owner-123'
      });
      mockTiendaRepository.findById.mockResolvedValue(success(tienda.value));
      mockCategoriaRepository.findByTienda.mockResolvedValue(success([]));
      mockAIService.generateOccasionList.mockResolvedValue('{"products":[]}');

      const lista = Lista.create({
        nombre: 'Test Lista',
        propietarioId: 'user-123'
      });
      mockListaRepository.save.mockResolvedValue(success(lista.value));

      await useCase.execute(dto, 'user-123');

      expect(mockTiendaRepository.findById).toHaveBeenCalledWith('tienda-123');
    });

    it('debe fallar si la tienda especificada no existe', async () => {
      const dto: CreateOccasionListDto = {
        occasion: 'Barbacoa',
        numberOfPeople: 4,
        storeId: 'tienda-inexistente'
      };

      mockTiendaRepository.findById.mockResolvedValue(success(null));

      const result = await useCase.execute(dto, 'user-123');

      expect(result.isFailure).toBe(true);
      expect(result.error).toBeInstanceOf(NotFoundError);
    });

    it('debe usar primera tienda disponible si no se especifica ninguna', async () => {
      const dto: CreateOccasionListDto = {
        occasion: 'Barbacoa',
        numberOfPeople: 4
      };

      const tienda = Tienda.create({
        nombre: 'Tienda Default',
        propietarioId: 'owner-123'
      });
      mockTiendaRepository.findAll.mockResolvedValue(success([tienda.value]));
      mockCategoriaRepository.findByTienda.mockResolvedValue(success([]));
      mockAIService.generateOccasionList.mockResolvedValue('{"products":[]}');

      const lista = Lista.create({
        nombre: 'Test Lista',
        propietarioId: 'user-123'
      });
      mockListaRepository.save.mockResolvedValue(success(lista.value));

      await useCase.execute(dto, 'user-123');

      expect(mockTiendaRepository.findAll).toHaveBeenCalled();
    });
  });

  describe('Generación con IA', () => {
    beforeEach(() => {
      mockTiendaRepository.findAll.mockResolvedValue(success([]));
      mockCategoriaRepository.findByTienda.mockResolvedValue(success([]));
    });

    it('debe construir prompt correcto para la IA', async () => {
      const dto: CreateOccasionListDto = {
        occasion: 'Barbacoa familiar',
        numberOfPeople: 6,
        maxBudget: 80,
        dietaryRestrictions: ['vegetariano'],
        additionalPreferences: 'Productos locales'
      };

      mockAIService.generateOccasionList.mockResolvedValue('{"products":[]}');

      const lista = Lista.create({
        nombre: 'Test Lista',
        propietarioId: 'user-123'
      });
      mockListaRepository.save.mockResolvedValue(success(lista.value));

      await useCase.execute(dto, 'user-123');

      expect(mockAIService.generateOccasionList).toHaveBeenCalledWith(
        expect.stringContaining('OCASIÓN: Barbacoa familiar')
      );
      expect(mockAIService.generateOccasionList).toHaveBeenCalledWith(
        expect.stringContaining('PERSONAS: 6')
      );
      expect(mockAIService.generateOccasionList).toHaveBeenCalledWith(
        expect.stringContaining('PRESUPUESTO: Máximo 80€')
      );
      expect(mockAIService.generateOccasionList).toHaveBeenCalledWith(
        expect.stringContaining('RESTRICCIONES: vegetariano')
      );
    });

    it('debe parsear correctamente respuesta JSON válida de la IA', async () => {
      const dto: CreateOccasionListDto = {
        occasion: 'Barbacoa',
        numberOfPeople: 4
      };

      const aiResponse = JSON.stringify({
        products: [
          {
            name: 'Carne para asar',
            quantity: 2,
            unit: 'kg',
            category: 'Carnes',
            estimatedPrice: 18.5,
            priority: 1,
            reason: 'Producto principal para barbacoa',
            alternatives: ['Pollo', 'Pescado']
          },
          {
            name: 'Pan',
            quantity: 4,
            unit: 'unidades',
            category: 'Panadería',
            priority: 2,
            reason: 'Acompañamiento típico'
          }
        ]
      });

      mockAIService.generateOccasionList.mockResolvedValue(aiResponse);

      const lista = Lista.create({
        nombre: 'Test Lista',
        propietarioId: 'user-123'
      });
      mockListaRepository.save.mockResolvedValue(success(lista.value));

      const producto = Producto.create({
        nombre: 'Test Producto',
        listaId: 'lista-123',
        creadoPorId: 'user-123'
      });
      mockProductoRepository.save.mockResolvedValue(success(producto.value));

      const result = await useCase.execute(dto, 'user-123');

      expect(result.isSuccess).toBe(true);
      expect(result.value?.products).toHaveLength(2);
      expect(result.value?.products[0].name).toBe('Carne para asar');
      expect(result.value?.products[0].alternatives).toEqual(['Pollo', 'Pescado']);
      expect(result.value?.products[1].estimatedPrice).toBeUndefined();
    });

    it('debe manejar respuesta inválida de IA con fallback', async () => {
      const dto: CreateOccasionListDto = {
        occasion: 'Barbacoa',
        numberOfPeople: 4
      };

      mockAIService.generateOccasionList.mockResolvedValue('respuesta inválida sin JSON');

      const lista = Lista.create({
        nombre: 'Test Lista',
        propietarioId: 'user-123'
      });
      mockListaRepository.save.mockResolvedValue(success(lista.value));

      const producto = Producto.create({
        nombre: 'Test Producto',
        listaId: 'lista-123',
        creadoPorId: 'user-123'
      });
      mockProductoRepository.save.mockResolvedValue(success(producto.value));

      const result = await useCase.execute(dto, 'user-123');

      expect(result.isSuccess).toBe(true);
      expect(result.value?.products.length).toBeGreaterThan(0);
      // Debería generar productos de fallback
    });
  });

  describe('Creación de lista y productos', () => {
    beforeEach(() => {
      mockTiendaRepository.findAll.mockResolvedValue(success([]));
      mockCategoriaRepository.findByTienda.mockResolvedValue(success([]));
      mockAIService.generateOccasionList.mockResolvedValue(JSON.stringify({
        products: [{
          name: 'Producto Test',
          quantity: 1,
          unit: 'unidades',
          category: 'General',
          priority: 1,
          reason: 'Test'
        }]
      }));
    });

    it('debe crear lista con nombre personalizado si se especifica', async () => {
      const dto: CreateOccasionListDto = {
        occasion: 'Barbacoa',
        numberOfPeople: 4,
        customListName: 'Mi Barbacoa Especial'
      };

      const lista = Lista.create({
        nombre: 'Mi Barbacoa Especial',
        propietarioId: 'user-123'
      });
      mockListaRepository.save.mockResolvedValue(success(lista.value));

      const producto = Producto.create({
        nombre: 'Test Producto',
        listaId: 'lista-123',
        creadoPorId: 'user-123'
      });
      mockProductoRepository.save.mockResolvedValue(success(producto.value));

      const result = await useCase.execute(dto, 'user-123');

      expect(result.isSuccess).toBe(true);
      expect(result.value?.listName).toBe('Mi Barbacoa Especial');
    });

    it('debe crear lista con nombre generado automáticamente', async () => {
      const dto: CreateOccasionListDto = {
        occasion: 'Barbacoa familiar',
        numberOfPeople: 6
      };

      const lista = Lista.create({
        nombre: 'Barbacoa familiar (6 personas)',
        propietarioId: 'user-123'
      });
      mockListaRepository.save.mockResolvedValue(success(lista.value));

      const producto = Producto.create({
        nombre: 'Test Producto',
        listaId: 'lista-123',
        creadoPorId: 'user-123'
      });
      mockProductoRepository.save.mockResolvedValue(success(producto.value));

      const result = await useCase.execute(dto, 'user-123');

      expect(result.isSuccess).toBe(true);
      expect(result.value?.listName).toBe('Barbacoa familiar (6 personas)');
    });

    it('debe calcular costo estimado total correctamente', async () => {
      const dto: CreateOccasionListDto = {
        occasion: 'Barbacoa',
        numberOfPeople: 4
      };

      mockAIService.generateOccasionList.mockResolvedValue(JSON.stringify({
        products: [
          {
            name: 'Producto 1',
            quantity: 2,
            unit: 'kg',
            category: 'Test',
            estimatedPrice: 10.5,
            priority: 1,
            reason: 'Test'
          },
          {
            name: 'Producto 2',
            quantity: 3,
            unit: 'unidades',
            category: 'Test',
            estimatedPrice: 5.0,
            priority: 1,
            reason: 'Test'
          }
        ]
      }));

      const lista = Lista.create({
        nombre: 'Test Lista',
        propietarioId: 'user-123'
      });
      mockListaRepository.save.mockResolvedValue(success(lista.value));

      const producto = Producto.create({
        nombre: 'Test Producto',
        listaId: 'lista-123',
        creadoPorId: 'user-123'
      });
      mockProductoRepository.save.mockResolvedValue(success(producto.value));

      const result = await useCase.execute(dto, 'user-123');

      expect(result.isSuccess).toBe(true);
      // (2 * 10.5) + (3 * 5.0) = 21 + 15 = 36
      expect(result.value?.summary.estimatedCost).toBe(36);
    });

    it('debe calcular confianza de IA basada en calidad de productos', async () => {
      const dto: CreateOccasionListDto = {
        occasion: 'Barbacoa',
        numberOfPeople: 4
      };

      mockAIService.generateOccasionList.mockResolvedValue(JSON.stringify({
        products: [{
          name: 'Producto completo con detalles',
          quantity: 2,
          unit: 'kg',
          category: 'Carnes',
          estimatedPrice: 15.0,
          priority: 1,
          reason: 'Explicación detallada del producto',
          alternatives: ['Alternativa 1', 'Alternativa 2']
        }]
      }));

      const lista = Lista.create({
        nombre: 'Test Lista',
        propietarioId: 'user-123'
      });
      mockListaRepository.save.mockResolvedValue(success(lista.value));

      const producto = Producto.create({
        nombre: 'Test Producto',
        listaId: 'lista-123',
        creadoPorId: 'user-123'
      });
      mockProductoRepository.save.mockResolvedValue(success(producto.value));

      const result = await useCase.execute(dto, 'user-123');

      expect(result.isSuccess).toBe(true);
      expect(result.value?.aiConfidence).toBeGreaterThan(80); // Producto completo = alta confianza
    });
  });

  describe('Manejo de errores', () => {
    it('debe manejar error en creación de lista', async () => {
      const dto: CreateOccasionListDto = {
        occasion: 'Barbacoa',
        numberOfPeople: 4
      };

      mockTiendaRepository.findAll.mockResolvedValue(success([]));
      mockCategoriaRepository.findByTienda.mockResolvedValue(success([]));
      mockAIService.generateOccasionList.mockResolvedValue('{"products":[]}');
      
      mockListaRepository.save.mockResolvedValue(failure(new Error('Error en BD')));

      const result = await useCase.execute(dto, 'user-123');

      expect(result.isFailure).toBe(true);
      expect(result.error?.message).toContain('Error en BD');
    });

    it('debe manejar error en servicio de IA', async () => {
      const dto: CreateOccasionListDto = {
        occasion: 'Barbacoa',
        numberOfPeople: 4
      };

      mockTiendaRepository.findAll.mockResolvedValue(success([]));
      mockCategoriaRepository.findByTienda.mockResolvedValue(success([]));
      mockAIService.generateOccasionList.mockRejectedValue(new Error('IA no disponible'));

      const result = await useCase.execute(dto, 'user-123');

      expect(result.isFailure).toBe(true);
      expect(result.error?.message).toContain('Error interno al generar lista');
    });

    it('debe continuar creando productos válidos aunque algunos fallen', async () => {
      const dto: CreateOccasionListDto = {
        occasion: 'Barbacoa',
        numberOfPeople: 4
      };

      mockTiendaRepository.findAll.mockResolvedValue(success([]));
      mockCategoriaRepository.findByTienda.mockResolvedValue(success([]));
      mockAIService.generateOccasionList.mockResolvedValue(JSON.stringify({
        products: [
          { name: 'Producto válido', quantity: 1, unit: 'unidades', category: 'Test', priority: 1, reason: 'Test' },
          { name: '', quantity: -1, unit: '', category: '', priority: 1, reason: '' } // Producto inválido
        ]
      }));

      const lista = Lista.create({
        nombre: 'Test Lista',
        propietarioId: 'user-123'
      });
      mockListaRepository.save.mockResolvedValue(success(lista.value));

      const producto = Producto.create({
        nombre: 'Producto válido',
        listaId: 'lista-123',
        creadoPorId: 'user-123'
      });
      
      // Mock: primer producto válido, segundo falla
      mockProductoRepository.save
        .mockResolvedValueOnce(success(producto.value))
        .mockResolvedValueOnce(failure(new Error('Producto inválido')));

      const result = await useCase.execute(dto, 'user-123');

      expect(result.isSuccess).toBe(true);
      expect(result.value?.summary.totalProducts).toBe(2); // Cuenta productos generados por IA
      // Aunque solo uno se guardó exitosamente en BD
    });
  });
});