import { CreateList } from '../../../../../src/application/use-cases/lists/CreateList';
import { IListaRepository } from '../../../../../src/application/ports/repositories/IListaRepository';
import { Lista } from '../../../../../src/domain/entities/Lista';
import { success, failure } from '../../../../../src/shared/result';

describe('CreateList', () => {
  let createList: CreateList;
  let listaRepository: jest.Mocked<IListaRepository>;

  beforeEach(() => {
    listaRepository = {
      findById: jest.fn(),
      findByPropietarioId: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findByIdWithPermissions: jest.fn(),
      findSharedWithUser: jest.fn(),
      existsByNameAndOwner: jest.fn().mockResolvedValue(success(false)),
      countByOwner: jest.fn().mockResolvedValue(success(0))
    } as any;

    createList = new CreateList(listaRepository);
  });

  describe('execute', () => {
    const validInput = {
      nombre: 'Lista de Supermercado',
      descripcion: 'Compras semanales',
      tiendaId: 'store-id'
    };

    const propietarioId = 'user-id';

    it('debería crear una lista exitosamente', async () => {
      // Arrange
      const mockLista = {
        id: 'lista-id',
        nombre: 'Mi Lista',
        descripcion: null,
        activa: true,
        propietarioId: 'user-id',
        tiendaId: null,
        fechaCreacion: new Date(),
        fechaActualizacion: new Date()
      } as Lista;
      
      listaRepository.existsByNameAndOwner.mockResolvedValue(success(false));
      listaRepository.save.mockResolvedValue(success(mockLista));

      // Act
      const result = await createList.execute(validInput, propietarioId);

      // Assert
      expect(result.isSuccess).toBe(true);
      expect(listaRepository.existsByNameAndOwner).toHaveBeenCalledWith(validInput.nombre, propietarioId);
      expect(listaRepository.save).toHaveBeenCalled();
    });

    it('debería fallar con datos de entrada inválidos - nombre vacío', async () => {
      // Arrange
      const invalidInput = {
        nombre: '',
        descripcion: 'Test'
      };

      // Act
      const result = await createList.execute(invalidInput, propietarioId);

      // Assert
      expect(result.isSuccess).toBe(false);
      expect(listaRepository.save).not.toHaveBeenCalled();
    });

    it('debería fallar con propietarioId vacío', async () => {
      // Act
      const result = await createList.execute(validInput, '');

      // Assert
      expect(result.isSuccess).toBe(false);
      expect(listaRepository.save).not.toHaveBeenCalled();
    });

    it('debería crear lista sin descripción', async () => {
      // Arrange
      const inputSinDescripcion = {
        nombre: 'Lista Simple'
      };

      const mockLista = {
        id: 'lista-id',
        nombre: 'Lista Simple',
        descripcion: null,
        activa: true,
        propietarioId: 'user-id',
        tiendaId: null,
        fechaCreacion: new Date(),
        fechaActualizacion: new Date()
      } as Lista;

      listaRepository.save.mockResolvedValue(success(mockLista));

      // Act
      const result = await createList.execute(inputSinDescripcion, propietarioId);

      // Assert
      expect(result.isSuccess).toBe(true);
    });

    it('debería manejar errores del repositorio de lista', async () => {
      // Arrange
      listaRepository.save.mockResolvedValue(failure(new Error('Save error')));

      // Act
      const result = await createList.execute(validInput, propietarioId);

      // Assert
      expect(result.isSuccess).toBe(false);
    });

    it('debería validar nombre con solo espacios', async () => {
      // Arrange
      const inputEspacios = {
        nombre: '   ',
        descripcion: 'Test'
      };

      // Act
      const result = await createList.execute(inputEspacios, propietarioId);

      // Assert
      expect(result.isSuccess).toBe(false);
    });

    it('debería manejar lista con tienda específica', async () => {
      // Arrange
      const inputConTienda = {
        nombre: 'Lista para Walmart',
        descripcion: 'Compras en tienda específica',
        tiendaId: 'walmart-id'
      };

      const mockLista = {
        id: 'lista-id',
        nombre: 'Lista para Walmart',
        descripcion: 'Compras en tienda específica',
        activa: true,
        propietarioId: 'user-id',
        tiendaId: 'walmart-id',
        fechaCreacion: new Date(),
        fechaActualizacion: new Date()
      } as Lista;

      listaRepository.save.mockResolvedValue(success(mockLista));

      // Act
      const result = await createList.execute(inputConTienda, propietarioId);

      // Assert
      expect(result.isSuccess).toBe(true);
    });
  });
});