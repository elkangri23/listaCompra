/**
 * Tests unitarios para CreateBlueprint use case
 */

import { CreateBlueprint, CreateBlueprintDto } from '../../../../../src/application/use-cases/blueprints/CreateBlueprint';
import { IBlueprintRepository } from '../../../../../src/application/ports/repositories/IBlueprintRepository';

import { ValidationError } from '../../../../../src/application/errors/ValidationError';
import { BusinessRuleViolationError } from '../../../../../src/domain/errors/DomainError';
import { success, failure } from '../../../../../src/shared/result';

describe('CreateBlueprint Use Case', () => {
  let useCase: CreateBlueprint;
  let mockRepository: jest.Mocked<IBlueprintRepository>;

  beforeEach(() => {
    mockRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findByUsuarioId: jest.fn(),
      findActiveByUsuarioId: jest.fn(),
      findByNombre: jest.fn(),
      deleteById: jest.fn(),
      existsById: jest.fn(),
      existsByNombreAndUsuario: jest.fn(),
      countByUsuarioId: jest.fn(),
      findAll: jest.fn(),
      deactivateAllByUsuarioId: jest.fn()
    };

    useCase = new CreateBlueprint(mockRepository);
  });

  const validDto: CreateBlueprintDto = {
    nombre: 'Lista de prueba',
    descripcion: 'Descripción de prueba',
    productos: [
      {
        nombre: 'Producto 1',
        cantidad: 2,
        descripcion: 'Notas del producto',
        categoriaId: '550e8400-e29b-41d4-a716-446655440000',
        urgente: false
      }
    ]
  };

  describe('execute', () => {
    it('debería crear un blueprint exitosamente', async () => {
      // Arrange
      mockRepository.existsByNombreAndUsuario.mockResolvedValue(success(false));
      mockRepository.countByUsuarioId.mockResolvedValue(success(10));
      mockRepository.save.mockImplementation(async (blueprint) => success(blueprint));

      // Act
      const result = await useCase.execute(validDto, 'test-user-id');

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(mockRepository.existsByNombreAndUsuario).toHaveBeenCalledWith(
        validDto.nombre,
        'test-user-id'
      );
      expect(mockRepository.countByUsuarioId).toHaveBeenCalledWith('test-user-id', true);
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('debería fallar si el nombre ya existe para el usuario', async () => {
      // Arrange
      mockRepository.existsByNombreAndUsuario.mockResolvedValue(success(true));

      // Act
      const result = await useCase.execute(validDto, 'test-user-id');

      // Assert
      expect(result.isSuccess).toBe(false);
      if (!result.isSuccess) {
        expect(result.error).toBeInstanceOf(ValidationError);
        expect(result.error.message).toContain('Ya existe un blueprint con ese nombre');
      }
    });

    it('debería fallar si el usuario ha alcanzado el límite de blueprints', async () => {
      // Arrange
      mockRepository.existsByNombreAndUsuario.mockResolvedValue(success(false));
      mockRepository.countByUsuarioId.mockResolvedValue(success(50));

      // Act
      const result = await useCase.execute(validDto, 'test-user-id');

      // Assert
      expect(result.isSuccess).toBe(false);
      if (!result.isSuccess) {
        expect(result.error).toBeInstanceOf(BusinessRuleViolationError);
        expect(result.error.message).toContain('máximo de 50 blueprints');
      }
    });

    it('debería fallar con datos inválidos', async () => {
      // Arrange
      const invalidDto = {
        ...validDto,
        nombre: '', // Nombre vacío
      };

      // Act
      const result = await useCase.execute(invalidDto, 'test-user-id');

      // Assert
      expect(result.isSuccess).toBe(false);
      if (!result.isSuccess) {
        expect(result.error).toBeInstanceOf(ValidationError);
      }
    });

    it('debería manejar errores del repositorio', async () => {
      // Arrange
      mockRepository.existsByNombreAndUsuario.mockResolvedValue(failure(new Error('Database error')));

      // Act
      const result = await useCase.execute(validDto, 'test-user-id');

      // Assert
      expect(result.isSuccess).toBe(false);
      if (!result.isSuccess) {
        expect(result.error.message).toBe('Database error');
      }
    });
  });
});
