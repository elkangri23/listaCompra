/**
 * Tests unitarios para CreateListFromBlueprint
 */

import { CreateListFromBlueprint } from '../../../../../src/application/use-cases/blueprints/CreateListFromBlueprint';
import type { IBlueprintRepository } from '../../../../../src/application/ports/repositories/IBlueprintRepository';
import type { IListaRepository } from '../../../../../src/application/ports/repositories/IListaRepository';
import type { IProductoRepository } from '../../../../../src/application/ports/repositories/IProductoRepository';
import { success, failure } from '../../../../../src/shared/result';
import { ValidationError } from '../../../../../src/application/errors/ValidationError';
import { NotFoundError } from '../../../../../src/application/errors/NotFoundError';

describe('CreateListFromBlueprint', () => {
  let useCase: CreateListFromBlueprint;
  let mockBlueprintRepository: jest.Mocked<IBlueprintRepository>;
  let mockListaRepository: jest.Mocked<IListaRepository>;
  let mockProductoRepository: jest.Mocked<IProductoRepository>;

  const usuarioId = 'user-test-id';
  const blueprintId = 'blueprint-test-id';

  beforeEach(() => {
    mockBlueprintRepository = {
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
    } as jest.Mocked<IBlueprintRepository>;

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

    useCase = new CreateListFromBlueprint(
      mockBlueprintRepository,
      mockListaRepository,
      mockProductoRepository
    );
  });

  describe('execute', () => {
    it('debería fallar con datos de entrada inválidos', async () => {
      // Arrange
      const dto = {
        blueprintId: '', // ID vacío
        nombreLista: 'Mi Lista'
      };

      // Act
      const result = await useCase.execute(dto, usuarioId);

      // Assert
      expect(result.isSuccess).toBe(false);
      if (!result.isSuccess) {
        expect(result.error).toBeInstanceOf(ValidationError);
      }
    });

    it('debería fallar si el nombre de la lista está vacío', async () => {
      // Arrange
      const dto = {
        blueprintId,
        nombreLista: '' // Nombre vacío
      };

      // Act
      const result = await useCase.execute(dto, usuarioId);

      // Assert
      expect(result.isSuccess).toBe(false);
      if (!result.isSuccess) {
        expect(result.error).toBeInstanceOf(ValidationError);
      }
    });

    it('debería fallar si el blueprint no existe', async () => {
      // Arrange
      const dto = {
        blueprintId,
        nombreLista: 'Mi Lista'
      };

      mockBlueprintRepository.findById.mockResolvedValue(success(null));

      // Act
      const result = await useCase.execute(dto, usuarioId);

      // Assert
      expect(result.isSuccess).toBe(false);
      if (!result.isSuccess) {
        expect(result.error).toBeInstanceOf(NotFoundError);
      }
    });

    it('debería manejar errores del repositorio de blueprints', async () => {
      // Arrange
      const dto = {
        blueprintId,
        nombreLista: 'Mi Lista'
      };

      mockBlueprintRepository.findById.mockResolvedValue(
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
  });
});