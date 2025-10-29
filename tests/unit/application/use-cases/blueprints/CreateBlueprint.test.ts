/**
 * Tests unitarios para CreateBlueprint use case
 */

import { CreateBlueprint } from '../../../../../src/application/use-cases/blueprints/CreateBlueprint';
import { IBlueprintRepository } from '../../../../../src/application/ports/repositories/IBlueprintRepository';
import { CreateBlueprintDto } from '../../../../../src/application/dto/blueprints/CreateBlueprintDto';
import { ValidationError } from '../../../../../src/application/errors/ValidationError';
import { BusinessRuleViolationError } from '../../../../../src/application/errors/BusinessRuleViolationError';
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
    publico: false,
    productos: [
      {
        nombre: 'Producto 1',
        cantidad: 2,
        notas: 'Notas del producto',
        categoriaId: 'cat-001'
      }
    ],
    creadoPorId: 'user-001'
  };

  describe('execute', () => {
    it('debería crear un blueprint exitosamente', async () => {
      // Arrange
      mockRepository.existsByNombreAndUsuario.mockResolvedValue(success(false));
      mockRepository.countByUsuarioId.mockResolvedValue(success(10));
      mockRepository.save.mockResolvedValue(success(expect.any(Object)));

      // Act
      const result = await useCase.execute(validDto);

      // Assert
      expect(result.isSuccess()).toBe(true);
      expect(mockRepository.existsByNombreAndUsuario).toHaveBeenCalledWith(
        validDto.nombre,
        validDto.creadoPorId,
        undefined
      );
      expect(mockRepository.countByUsuarioId).toHaveBeenCalledWith(validDto.creadoPorId);
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('debería fallar si el nombre ya existe para el usuario', async () => {
      // Arrange
      mockRepository.existsByNombreAndUsuario.mockResolvedValue(success(true));

      // Act
      const result = await useCase.execute(validDto);

      // Assert
      expect(result.isSuccess()).toBe(false);
      expect(result.getError()).toBeInstanceOf(ValidationError);
      expect(result.getError().message).toContain('ya existe un blueprint con ese nombre');
    });

    it('debería fallar si el usuario ha alcanzado el límite de blueprints', async () => {
      // Arrange
      mockRepository.existsByNombreAndUsuario.mockResolvedValue(success(false));
      mockRepository.countByUsuarioId.mockResolvedValue(success(50));

      // Act
      const result = await useCase.execute(validDto);

      // Assert
      expect(result.isSuccess()).toBe(false);
      expect(result.getError()).toBeInstanceOf(BusinessRuleViolationError);
      expect(result.getError().message).toContain('máximo de 50 blueprints');
    });

    it('debería fallar con datos inválidos', async () => {
      // Arrange
      const invalidDto = {
        ...validDto,
        nombre: '', // Nombre vacío
      };

      // Act
      const result = await useCase.execute(invalidDto);

      // Assert
      expect(result.isSuccess()).toBe(false);
      expect(result.getError()).toBeInstanceOf(ValidationError);
    });

    it('debería manejar errores del repositorio', async () => {
      // Arrange
      mockRepository.existsByNombreAndUsuario.mockResolvedValue(failure(new Error('Database error')));

      // Act
      const result = await useCase.execute(validDto);

      // Assert
      expect(result.isSuccess()).toBe(false);
      expect(result.getError().message).toBe('Database error');
    });
  });
});