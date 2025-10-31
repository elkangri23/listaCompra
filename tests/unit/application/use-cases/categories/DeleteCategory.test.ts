import { DeleteCategory } from '../../../../../src/application/use-cases/categories/DeleteCategory';
import { ICategoriaRepository } from '../../../../../src/application/ports/repositories/ICategoriaRepository';
import { IProductoRepository } from '../../../../../src/application/ports/repositories/IProductoRepository';
import { Categoria } from '../../../../../src/domain/entities/Categoria';
import { InvalidValueError, BusinessRuleViolationError } from '../../../../../src/domain/errors/DomainError';
import { success, failure } from '../../../../../src/shared/result';

describe('DeleteCategory', () => {
  let deleteCategory: DeleteCategory;
  let categoriaRepository: jest.Mocked<ICategoriaRepository>;
  let productoRepository: jest.Mocked<IProductoRepository>;

  beforeEach(() => {
    categoriaRepository = {
      save: jest.fn(),
      findById: jest.fn().mockResolvedValue(success(null)),
      findByName: jest.fn(),
      findByStore: jest.fn(),
      findAll: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    } as any;

    productoRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findByListaId: jest.fn(),
      findAll: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findByCategory: jest.fn().mockResolvedValue(success([]))
    } as any;

    deleteCategory = new DeleteCategory(categoriaRepository, productoRepository);
  });

  describe('execute', () => {
    const validInput = {
      id: 'categoria-id'
    };

    const mockCategoria = {
      id: 'categoria-id',
      nombre: 'Lácteos',
      descripcion: 'Productos lácteos',
      color: '#FF5733',
      activa: true,
      tiendaId: null,
      fechaCreacion: new Date(),
      fechaActualizacion: new Date()
    } as Categoria;

    it('debería eliminar una categoría exitosamente', async () => {
      // Arrange
      categoriaRepository.findById.mockResolvedValue(success(mockCategoria));
      productoRepository.findByCategory.mockResolvedValue(success([]));
      categoriaRepository.delete.mockResolvedValue(success(true));

      // Act
      const result = await deleteCategory.execute(validInput);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(categoriaRepository.findById).toHaveBeenCalledWith('categoria-id');
      expect(productoRepository.findByCategory).toHaveBeenCalledWith('categoria-id');
      expect(categoriaRepository.delete).toHaveBeenCalledWith('categoria-id');
    });

    it('debería fallar con ID vacío', async () => {
      // Arrange
      const invalidInput = {
        id: ''
      };

      // Act
      const result = await deleteCategory.execute(invalidInput);

      // Assert
      expect(result.isSuccess).toBe(false);
      expect(categoriaRepository.findById).toHaveBeenCalledWith('');
    });

    it('debería fallar si la categoría no existe', async () => {
      // Arrange
      categoriaRepository.findById.mockResolvedValue(success(null));

      // Act
      const result = await deleteCategory.execute(validInput);

      // Assert
      expect(result.isSuccess).toBe(false);
      expect(productoRepository.findByCategory).not.toHaveBeenCalled();
    });

    it('debería fallar si la categoría tiene productos asociados', async () => {
      // Arrange
      const mockProductos = [
        { id: 'producto-1', categoriaId: 'categoria-id' } as any,
        { id: 'producto-2', categoriaId: 'categoria-id' } as any
      ];

      categoriaRepository.findById.mockResolvedValue(success(mockCategoria));
      productoRepository.findByCategory.mockResolvedValue(success(mockProductos));

      // Act
      const result = await deleteCategory.execute(validInput);

      // Assert
      expect(result.isSuccess).toBe(false);
      expect(categoriaRepository.delete).not.toHaveBeenCalled();
    });

    it('debería manejar errores del repositorio de categorías', async () => {
      // Arrange
      categoriaRepository.findById.mockResolvedValue(failure(new InvalidValueError('id', 'categoria-id', 'Database error')));

      // Act
      const result = await deleteCategory.execute(validInput);

      // Assert
      expect(result.isSuccess).toBe(false);
    });

    it('debería manejar errores del repositorio de productos', async () => {
      // Arrange
      categoriaRepository.findById.mockResolvedValue(success(mockCategoria));
      productoRepository.findByCategory.mockResolvedValue(failure(new InvalidValueError('categoria', 'categoria-id', 'Database error')));

      // Act
      const result = await deleteCategory.execute(validInput);

      // Assert
      expect(result.isSuccess).toBe(false);
    });

    it('debería manejar errores al eliminar', async () => {
      // Arrange
      categoriaRepository.findById.mockResolvedValue(success(mockCategoria));
      productoRepository.findByCategory.mockResolvedValue(success([]));
      categoriaRepository.delete.mockResolvedValue(failure(new BusinessRuleViolationError('DELETE_CONSTRAINT', 'Delete error')));

      // Act
      const result = await deleteCategory.execute(validInput);

      // Assert
      expect(result.isSuccess).toBe(false);
    });
  });
});