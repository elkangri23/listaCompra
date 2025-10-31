import { GetCategoriesByStore } from '../../../../../src/application/use-cases/categories/GetCategoriesByStore';
import { ICategoriaRepository } from '../../../../../src/application/ports/repositories/ICategoriaRepository';
import { ITiendaRepository } from '../../../../../src/application/ports/repositories/ITiendaRepository';
import { Categoria } from '../../../../../src/domain/entities/Categoria';
import { Tienda } from '../../../../../src/domain/entities/Tienda';
import { InvalidValueError } from '../../../../../src/domain/errors/DomainError';
import { success, failure } from '../../../../../src/shared/result';

describe('GetCategoriesByStore', () => {
  let getCategoriesByStore: GetCategoriesByStore;
  let categoriaRepository: jest.Mocked<ICategoriaRepository>;
  let tiendaRepository: jest.Mocked<ITiendaRepository>;

  beforeEach(() => {
    categoriaRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findByNombre: jest.fn(),
      findByTienda: jest.fn().mockResolvedValue(success([])),
      findAll: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    } as any;

    tiendaRepository = {
      save: jest.fn(),
      findById: jest.fn().mockResolvedValue(success(null)),
      findByName: jest.fn(),
      findAll: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    } as any;

    getCategoriesByStore = new GetCategoriesByStore(categoriaRepository, tiendaRepository);
  });

  describe('execute', () => {
    const mockTienda = {
      id: 'tienda-id',
      nombre: 'Walmart',
      direccion: 'Av. Principal 123',
      activa: true,
      fechaCreacion: new Date(),
      fechaActualizacion: new Date()
    } as Tienda;

    const mockCategorias = [
      {
        id: 'categoria-1',
        nombre: 'Lácteos',
        descripcion: 'Productos lácteos',
        color: '#FF5733',
        activa: true,
        tiendaId: 'tienda-id',
        fechaCreacion: new Date(),
        fechaActualizacion: new Date()
      },
      {
        id: 'categoria-2',
        nombre: 'Carnes',
        descripcion: 'Productos cárnicos',
        color: '#33FF57',
        activa: true,
        tiendaId: 'tienda-id',
        fechaCreacion: new Date(),
        fechaActualizacion: new Date()
      }
    ] as Categoria[];

    it('debería obtener categorías por tienda específica exitosamente', async () => {
      // Arrange
      const validInput = {
        tiendaId: 'tienda-id'
      };

      tiendaRepository.findById.mockResolvedValue(success(mockTienda));
      categoriaRepository.findByTienda.mockResolvedValue(success(mockCategorias));

      // Act
      const result = await getCategoriesByStore.execute(validInput);

      // Assert
      expect(result.isSuccess).toBe(true);
      if (result.isSuccess) {
        expect(result.value.categorias).toHaveLength(2);
        expect(result.value.tienda).toBeDefined();
        expect(result.value.tienda?.nombre).toBe('Walmart');
      }
      expect(tiendaRepository.findById).toHaveBeenCalledWith('tienda-id');
      expect(categoriaRepository.findByTienda).toHaveBeenCalledWith('tienda-id', false);
    });

    it('debería obtener categorías generales (sin tienda) exitosamente', async () => {
      // Arrange
      const validInput = {};

      const mockGeneralCategorias = [
        {
          id: 'categoria-1',
          nombre: 'Lácteos',
          descripcion: 'Productos lácteos',
          color: '#FF5733',
          activa: true,
          tiendaId: null,
          fechaCreacion: new Date(),
          fechaActualizacion: new Date()
        },
        {
          id: 'categoria-2',
          nombre: 'Carnes',
          descripcion: 'Productos cárnicos',
          color: '#33FF57',
          activa: true,
          tiendaId: null,
          fechaCreacion: new Date(),
          fechaActualizacion: new Date()
        }
      ] as Categoria[];

      categoriaRepository.findByTienda.mockResolvedValue(success(mockGeneralCategorias));

      // Act
      const result = await getCategoriesByStore.execute(validInput);

      // Assert
      expect(result.isSuccess).toBe(true);
      if (result.isSuccess) {
        expect(result.value.categorias).toHaveLength(2);
        expect(result.value.tienda).toBeUndefined();
      }
      expect(tiendaRepository.findById).not.toHaveBeenCalled();
      expect(categoriaRepository.findByTienda).toHaveBeenCalledWith(null, false);
    });

    it('debería fallar si la tienda no existe', async () => {
      // Arrange
      const invalidInput = {
        tiendaId: 'tienda-inexistente'
      };

      tiendaRepository.findById.mockResolvedValue(success(null));

      // Act
      const result = await getCategoriesByStore.execute(invalidInput);

      // Assert
      expect(result.isSuccess).toBe(false);
      expect(categoriaRepository.findByTienda).not.toHaveBeenCalled();
    });

    it('debería manejar errores del repositorio de tiendas', async () => {
      // Arrange
      const validInput = {
        tiendaId: 'tienda-id'
      };

      tiendaRepository.findById.mockResolvedValue(failure(new InvalidValueError('tienda', 'tienda-id', 'Database error')));

      // Act
      const result = await getCategoriesByStore.execute(validInput);

      // Assert
      expect(result.isSuccess).toBe(false);
    });

    it('debería manejar errores del repositorio de categorías', async () => {
      // Arrange
      const validInput = {
        tiendaId: 'tienda-id'
      };

      tiendaRepository.findById.mockResolvedValue(success(mockTienda));
      categoriaRepository.findByTienda.mockResolvedValue(failure(new InvalidValueError('tienda', 'tienda-id', 'Database error')));

      // Act
      const result = await getCategoriesByStore.execute(validInput);

      // Assert
      expect(result.isSuccess).toBe(false);
    });

    it('debería devolver lista vacía si no hay categorías', async () => {
      // Arrange
      const validInput = {
        tiendaId: 'tienda-id'
      };

      tiendaRepository.findById.mockResolvedValue(success(mockTienda));
      categoriaRepository.findByTienda.mockResolvedValue(success([]));

      // Act
      const result = await getCategoriesByStore.execute(validInput);

      // Assert
      expect(result.isSuccess).toBe(true);
      if (result.isSuccess) {
        expect(result.value.categorias).toHaveLength(0);
        expect(result.value.total).toBe(0);
      }
    });
  });
});