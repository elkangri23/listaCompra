import { describe, test, expect, beforeEach } from '@jest/globals';
import { CreateCategory } from '../../../../../src/application/use-cases/categories/CreateCategory';
import { CreateCategoryDto } from '../../../../../src/application/dto/categories';
import { Categoria } from '../../../../../src/domain/entities/Categoria';
import { Tienda } from '../../../../../src/domain/entities/Tienda';
import { success } from '../../../../../src/shared/result';
import { InvalidValueError, BusinessRuleViolationError } from '../../../../../src/domain/errors/DomainError';

// Mock repositories - implementamos solo los métodos que vamos a usar
class MockCategoriaRepository {
  private categorias: Map<string, Categoria> = new Map();
  
  async save(categoria: Categoria): Promise<any> {
    this.categorias.set(categoria.id, categoria);
    return success(categoria);
  }
  
  async existsByNombreAndTienda(nombre: string, tiendaId: string | null): Promise<any> {
    for (const categoria of this.categorias.values()) {
      if (categoria.nombre === nombre && categoria.tiendaId === tiendaId) {
        return success(true);
      }
    }
    return success(false);
  }
}

class MockTiendaRepository {
  private tiendas: Map<string, Tienda> = new Map();
  
  async save(tienda: Tienda): Promise<any> {
    this.tiendas.set(tienda.id, tienda);
    return success(tienda);
  }
  
  async findById(id: string): Promise<any> {
    const tienda = this.tiendas.get(id) || null;
    return success(tienda);
  }
}

describe('CreateCategory Use Case', () => {
  let useCase: CreateCategory;
  let categoriaRepository: MockCategoriaRepository;
  let tiendaRepository: MockTiendaRepository;

  beforeEach(() => {
    categoriaRepository = new MockCategoriaRepository();
    tiendaRepository = new MockTiendaRepository();
    useCase = new CreateCategory(categoriaRepository as any, tiendaRepository as any);
  });

  describe('execute', () => {
    test('should create a general category successfully', async () => {
      // Arrange
      const dto: CreateCategoryDto = {
        nombre: 'Frutas',
        descripcion: 'Categoría para frutas frescas',
        color: '#FF0000'
      };

      // Act
      const result = await useCase.execute(dto);

      // Assert
      expect(result.isSuccess).toBe(true);
      if (result.isSuccess) {
        expect(result.value.nombre).toBe('Frutas');
        expect(result.value.descripcion).toBe('Categoría para frutas frescas');
        expect(result.value.color).toBe('#FF0000');
        expect(result.value.tiendaId).toBeUndefined();
      }
    });

    test('should create a store-specific category successfully', async () => {
      // Arrange
      const tiendaResult = Tienda.create({
        nombre: 'Supermercado Central'
      });
      expect(tiendaResult.isSuccess).toBe(true);
      if (!tiendaResult.isSuccess) return;
      
      const tienda = tiendaResult.value;
      await tiendaRepository.save(tienda);

      const dto: CreateCategoryDto = {
        nombre: 'Ofertas',
        descripcion: 'Productos en oferta',
        tiendaId: tienda.id
      };

      // Act
      const result = await useCase.execute(dto);

      // Assert
      expect(result.isSuccess).toBe(true);
      if (result.isSuccess) {
        expect(result.value.nombre).toBe('Ofertas');
        expect(result.value.tiendaId).toBe(tienda.id);
      }
    });

    test('should fail with validation error for empty name', async () => {
      // Arrange
      const dto: CreateCategoryDto = {
        nombre: ''
      };

      // Act
      const result = await useCase.execute(dto);

      // Assert
      expect(result.isFailure).toBe(true);
      if (result.isFailure) {
        expect(result.error).toBeInstanceOf(InvalidValueError);
        expect(result.error.message).toContain('El nombre de la categoría es requerido');
      }
    });

    test('should fail with validation error for invalid color', async () => {
      // Arrange
      const dto: CreateCategoryDto = {
        nombre: 'Frutas',
        color: 'rojo'
      };

      // Act
      const result = await useCase.execute(dto);

      // Assert
      expect(result.isFailure).toBe(true);
      if (result.isFailure) {
        expect(result.error).toBeInstanceOf(InvalidValueError);
        expect(result.error.message).toContain('código hexadecimal válido');
      }
    });

    test('should fail when store does not exist', async () => {
      // Arrange
      const dto: CreateCategoryDto = {
        nombre: 'Ofertas',
        tiendaId: 'nonexistent-store'
      };

      // Act
      const result = await useCase.execute(dto);

      // Assert
      expect(result.isFailure).toBe(true);
      if (result.isFailure) {
        expect(result.error).toBeInstanceOf(InvalidValueError);
        expect(result.error.message).toContain('no existe');
      }
    });

    test('should fail when category with same name already exists for the store', async () => {
      // Arrange
      const existingCategoryResult = Categoria.create({
        nombre: 'Frutas'
      });
      expect(existingCategoryResult.isSuccess).toBe(true);
      if (!existingCategoryResult.isSuccess) return;
      
      const existingCategory = existingCategoryResult.value;
      await categoriaRepository.save(existingCategory);

      const dto: CreateCategoryDto = {
        nombre: 'Frutas'
      };

      // Act
      const result = await useCase.execute(dto);

      // Assert
      expect(result.isFailure).toBe(true);
      if (result.isFailure) {
        expect(result.error).toBeInstanceOf(BusinessRuleViolationError);
        expect(result.error.message).toContain('Ya existe');
      }
    });

    test('should allow same category name for different stores', async () => {
      // Arrange
      const tienda1Result = Tienda.create({
        nombre: 'Tienda 1'
      });
      const tienda2Result = Tienda.create({
        nombre: 'Tienda 2'
      });
      expect(tienda1Result.isSuccess).toBe(true);
      expect(tienda2Result.isSuccess).toBe(true);
      if (!tienda1Result.isSuccess || !tienda2Result.isSuccess) return;
      
      const tienda1 = tienda1Result.value;
      const tienda2 = tienda2Result.value;
      await tiendaRepository.save(tienda1);
      await tiendaRepository.save(tienda2);

      const category1Result = Categoria.create({
        nombre: 'Frutas',
        tiendaId: tienda1.id
      });
      expect(category1Result.isSuccess).toBe(true);
      if (!category1Result.isSuccess) return;
      
      await categoriaRepository.save(category1Result.value);

      const dto: CreateCategoryDto = {
        nombre: 'Frutas',
        tiendaId: tienda2.id
      };

      // Act
      const result = await useCase.execute(dto);

      // Assert
      expect(result.isSuccess).toBe(true);
    });
  });
});