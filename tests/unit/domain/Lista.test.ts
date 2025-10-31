const initialDate = new Date('2024-01-01T12:00:00.000Z');
let currentTime = initialDate.getTime();

jest.mock('../../../src/shared/utils', () => {
  const actual = jest.requireActual<typeof import('../../../src/shared/utils')>(
    '../../../src/shared/utils'
  );

  return {
    ...actual,
    createDate: jest.fn(),
  };
});

import { Lista } from '../../../src/domain/entities/Lista';
import { InvalidValueError } from '../../../src/domain/errors/DomainError';
import * as utils from '../../../src/shared/utils';

const createDateMock =
  utils.createDate as jest.MockedFunction<
    typeof import('../../../src/shared/utils')['createDate']
  >;

describe('Entidad Lista', () => {
  const advanceTime = (ms: number) => {
    currentTime += ms;
  };

  beforeEach(() => {
    currentTime = initialDate.getTime();
    createDateMock.mockImplementation((date?: string | Date) => {
      if (date) {
        return date instanceof Date ? date : new Date(date);
      }
      return new Date(currentTime);
    });
  });

  afterEach(() => {
    createDateMock.mockReset();
  });

  const validListaData = {
    nombre: 'Lista de Supermercado',
    descripcion: 'Lista semanal de compras',
    propietarioId: 'usuario-123',
    tiendaId: 'tienda-456',
    activa: true,
  };

  describe('create', () => {
    it('debería crear una lista válida con datos mínimos', () => {
      const data = {
        nombre: 'Lista Simple',
        propietarioId: 'usuario-123',
      };

      const result = Lista.create(data);

      expect(result.isSuccess).toBe(true);
      if (result.isSuccess) {
        const lista = result.value;
        expect(lista.nombre).toBe('Lista Simple');
        expect(lista.propietarioId).toBe('usuario-123');
        expect(lista.descripcion).toBeNull();
        expect(lista.tiendaId).toBeNull();
        expect(lista.activa).toBe(true);
        expect(lista.id).toBeDefined();
        expect(lista.fechaCreacion).toBeInstanceOf(Date);
        expect(lista.fechaActualizacion).toBeInstanceOf(Date);
      }
    });

    it('debería crear una lista válida con todos los datos', () => {
      const result = Lista.create(validListaData);

      expect(result.isSuccess).toBe(true);
      if (result.isSuccess) {
        const lista = result.value;
        expect(lista.nombre).toBe('Lista de Supermercado');
        expect(lista.descripcion).toBe('Lista semanal de compras');
        expect(lista.propietarioId).toBe('usuario-123');
        expect(lista.tiendaId).toBe('tienda-456');
        expect(lista.activa).toBe(true);
      }
    });

    it('debería fallar con nombre vacío', () => {
      const result = Lista.create({ ...validListaData, nombre: '' });
      
      expect(result.isFailure).toBe(true);
      if (result.isFailure) {
        expect(result.error).toBeInstanceOf(InvalidValueError);
        expect(result.error.message).toContain('El nombre de la lista es requerido');
      }
    });

    it('debería fallar con nombre solo espacios', () => {
      const result = Lista.create({ ...validListaData, nombre: '   ' });
      
      expect(result.isFailure).toBe(true);
      if (result.isFailure) {
        expect(result.error).toBeInstanceOf(InvalidValueError);
        expect(result.error.message).toContain('El nombre de la lista es requerido');
      }
    });

    it('debería fallar con nombre demasiado largo', () => {
      const nombreLargo = 'a'.repeat(101);
      const result = Lista.create({ ...validListaData, nombre: nombreLargo });
      
      expect(result.isFailure).toBe(true);
      if (result.isFailure) {
        expect(result.error).toBeInstanceOf(InvalidValueError);
        expect(result.error.message).toContain('no puede exceder 100 caracteres');
      }
    });

    it('debería fallar con descripción demasiado larga', () => {
      const descripcionLarga = 'a'.repeat(501);
      const result = Lista.create({ ...validListaData, descripcion: descripcionLarga });
      
      expect(result.isFailure).toBe(true);
      if (result.isFailure) {
        expect(result.error).toBeInstanceOf(InvalidValueError);
        expect(result.error.message).toContain('no puede exceder 500 caracteres');
      }
    });

    it('debería fallar sin propietarioId', () => {
      const result = Lista.create({ ...validListaData, propietarioId: '' });
      
      expect(result.isFailure).toBe(true);
      if (result.isFailure) {
        expect(result.error).toBeInstanceOf(InvalidValueError);
        expect(result.error.message).toContain('El ID del propietario es requerido');
      }
    });

    it('debería limpiar espacios en blanco en nombre', () => {
      const result = Lista.create({ ...validListaData, nombre: '  Lista con espacios  ' });
      
      expect(result.isSuccess).toBe(true);
      if (result.isSuccess) {
        expect(result.value.nombre).toBe('Lista con espacios');
      }
    });

    it('debería convertir descripción vacía a null', () => {
      const result = Lista.create({ ...validListaData, descripcion: '   ' });
      
      expect(result.isSuccess).toBe(true);
      if (result.isSuccess) {
        expect(result.value.descripcion).toBeNull();
      }
    });

    it('debería usar activa=true por defecto', () => {
      const data = { 
        nombre: validListaData.nombre,
        descripcion: validListaData.descripcion,
        propietarioId: validListaData.propietarioId,
        tiendaId: validListaData.tiendaId
      };
      const result = Lista.create(data);
      
      expect(result.isSuccess).toBe(true);
      if (result.isSuccess) {
        expect(result.value.activa).toBe(true);
      }
    });
  });

  describe('actualizarNombre', () => {
    let lista: Lista;

    beforeEach(() => {
      const result = Lista.create(validListaData);
      if (result.isSuccess) {
        lista = result.value;
      }
    });

    it('debería actualizar el nombre correctamente', () => {
      const fechaOriginal = lista.fechaActualizacion.getTime();
      advanceTime(1);
      const expectedTimestamp = initialDate.getTime() + 1;
      const result = lista.actualizarNombre('Nuevo Nombre');

      expect(result.isSuccess).toBe(true);
      expect(lista.nombre).toBe('Nuevo Nombre');
      expect(lista.fechaActualizacion.getTime()).toBe(expectedTimestamp);
      expect(lista.fechaActualizacion.getTime()).toBeGreaterThanOrEqual(fechaOriginal);
    });

    it('debería fallar con nombre vacío', () => {
      const result = lista.actualizarNombre('');
      
      expect(result.isFailure).toBe(true);
      if (result.isFailure) {
        expect(result.error).toBeInstanceOf(InvalidValueError);
        expect(result.error.message).toContain('El nombre de la lista es requerido');
      }
    });

    it('debería fallar con nombre demasiado largo', () => {
      const nombreLargo = 'a'.repeat(101);
      const result = lista.actualizarNombre(nombreLargo);
      
      expect(result.isFailure).toBe(true);
      if (result.isFailure) {
        expect(result.error).toBeInstanceOf(InvalidValueError);
        expect(result.error.message).toContain('no puede exceder 100 caracteres');
      }
    });

    it('debería limpiar espacios en blanco', () => {
      const result = lista.actualizarNombre('  Nombre con espacios  ');
      
      expect(result.isSuccess).toBe(true);
      expect(lista.nombre).toBe('Nombre con espacios');
    });
  });

  describe('actualizarDescripcion', () => {
    let lista: Lista;

    beforeEach(() => {
      const result = Lista.create(validListaData);
      if (result.isSuccess) {
        lista = result.value;
      }
    });

    it('debería actualizar la descripción correctamente', () => {
      const fechaOriginal = lista.fechaActualizacion.getTime();
      advanceTime(1);
      const expectedTimestamp = initialDate.getTime() + 1;
      const result = lista.actualizarDescripcion('Nueva descripción');

      expect(result.isSuccess).toBe(true);
      expect(lista.descripcion).toBe('Nueva descripción');
      expect(lista.fechaActualizacion.getTime()).toBe(expectedTimestamp);
      expect(lista.fechaActualizacion.getTime()).toBeGreaterThanOrEqual(fechaOriginal);
    });

    it('debería permitir descripción vacía (null)', () => {
      const result = lista.actualizarDescripcion();

      expect(result.isSuccess).toBe(true);
      expect(lista.descripcion).toBeNull();
    });

    it('debería convertir string vacío a null', () => {
      const result = lista.actualizarDescripcion('   ');

      expect(result.isSuccess).toBe(true);
      expect(lista.descripcion).toBeNull();
    });

    it('debería fallar con descripción demasiado larga', () => {
      const descripcionLarga = 'a'.repeat(501);
      const result = lista.actualizarDescripcion(descripcionLarga);
      
      expect(result.isFailure).toBe(true);
      if (result.isFailure) {
        expect(result.error).toBeInstanceOf(InvalidValueError);
        expect(result.error.message).toContain('no puede exceder 500 caracteres');
      }
    });
  });

  describe('actualizarTienda', () => {
    let lista: Lista;

    beforeEach(() => {
      const result = Lista.create(validListaData);
      if (result.isSuccess) {
        lista = result.value;
      }
    });

    it('debería actualizar la tienda correctamente', () => {
      const fechaOriginal = lista.fechaActualizacion.getTime();
      advanceTime(1);
      const expectedTimestamp = initialDate.getTime() + 1;
      const result = lista.actualizarTienda('nueva-tienda-123');

      expect(result.isSuccess).toBe(true);
      expect(lista.tiendaId).toBe('nueva-tienda-123');
      expect(lista.fechaActualizacion.getTime()).toBe(expectedTimestamp);
      expect(lista.fechaActualizacion.getTime()).toBeGreaterThanOrEqual(fechaOriginal);
    });

    it('debería permitir quitar la tienda (null)', () => {
      const result = lista.actualizarTienda();

      expect(result.isSuccess).toBe(true);
      expect(lista.tiendaId).toBeNull();
    });

    it('debería convertir string vacío a null', () => {
      const result = lista.actualizarTienda('   ');

      expect(result.isSuccess).toBe(true);
      expect(lista.tiendaId).toBeNull();
    });
  });

  describe('activar y desactivar', () => {
    let lista: Lista;

    beforeEach(() => {
      const result = Lista.create(validListaData);
      if (result.isSuccess) {
        lista = result.value;
      }
    });

    it('debería activar la lista', () => {
      // Primero desactivar para probar la activación
      advanceTime(10);
      lista.desactivar();
      expect(lista.activa).toBe(false);
      const fechaDesactivacion = lista.fechaActualizacion.getTime();
      expect(fechaDesactivacion).toBe(initialDate.getTime() + 10);

      advanceTime(10);
      const fechaOriginal = lista.fechaActualizacion.getTime();

      lista.activar();

      expect(lista.activa).toBe(true);
      expect(lista.fechaActualizacion.getTime()).toBe(initialDate.getTime() + 20);
      expect(lista.fechaActualizacion.getTime()).toBeGreaterThan(fechaDesactivacion);
      expect(lista.fechaActualizacion.getTime()).toBeGreaterThanOrEqual(fechaOriginal);
    });

    it('debería desactivar la lista', () => {
      const fechaOriginal = lista.fechaActualizacion.getTime();
      advanceTime(10);
      const expectedTimestamp = initialDate.getTime() + 10;
      lista.desactivar();

      expect(lista.activa).toBe(false);
      expect(lista.fechaActualizacion.getTime()).toBe(expectedTimestamp);
      expect(lista.fechaActualizacion.getTime()).toBeGreaterThanOrEqual(fechaOriginal);
    });

    it('estaActiva debería devolver el estado correcto', () => {
      expect(lista.estaActiva()).toBe(true);
      
      lista.desactivar();
      expect(lista.estaActiva()).toBe(false);
      
      lista.activar();
      expect(lista.estaActiva()).toBe(true);
    });
  });

  describe('esPropietario', () => {
    let lista: Lista;

    beforeEach(() => {
      const result = Lista.create(validListaData);
      if (result.isSuccess) {
        lista = result.value;
      }
    });

    it('debería devolver true para el propietario', () => {
      expect(lista.esPropietario('usuario-123')).toBe(true);
    });

    it('debería devolver false para otro usuario', () => {
      expect(lista.esPropietario('otro-usuario')).toBe(false);
    });

    it('debería manejar strings vacíos', () => {
      expect(lista.esPropietario('')).toBe(false);
    });
  });

  describe('toJSON', () => {
    let lista: Lista;

    beforeEach(() => {
      const result = Lista.create(validListaData);
      if (result.isSuccess) {
        lista = result.value;
      }
    });

    it('debería convertir a JSON correctamente', () => {
      const json = lista.toJSON();
      
      expect(json).toMatchObject({
        id: lista.id,
        nombre: 'Lista de Supermercado',
        descripcion: 'Lista semanal de compras',
        propietarioId: 'usuario-123',
        tiendaId: 'tienda-456',
        activa: true,
      });
      expect(json['fechaCreacion']).toBeDefined();
      expect(json['fechaActualizacion']).toBeDefined();
    });

    it('debería manejar valores null correctamente', () => {
      const data = {
        nombre: 'Lista Sin Extras',
        propietarioId: 'usuario-123',
      };
      
      const result = Lista.create(data);
      expect(result.isSuccess).toBe(true);
      
      if (result.isSuccess) {
        const json = result.value.toJSON();
        expect(json['descripcion']).toBeNull();
        expect(json['tiendaId']).toBeNull();
      }
    });
  });

  describe('toPersistence', () => {
    let lista: Lista;

    beforeEach(() => {
      const result = Lista.create(validListaData);
      if (result.isSuccess) {
        lista = result.value;
      }
    });

    it('debería convertir a formato de persistencia correctamente', () => {
      const persistence = lista.toPersistence();
      
      expect(persistence).toMatchObject({
        id: lista.id,
        nombre: 'Lista de Supermercado',
        descripcion: 'Lista semanal de compras',
        propietario_id: 'usuario-123',
        tienda_id: 'tienda-456',
        activa: true,
      });
      expect(persistence['fecha_creacion']).toBeInstanceOf(Date);
      expect(persistence['fecha_actualizacion']).toBeInstanceOf(Date);
    });
  });

  describe('fromPersistence', () => {
    it('debería reconstruir desde datos de persistencia', () => {
      const persistenceData = {
        id: 'lista-123',
        nombre: 'Lista desde DB',
        descripcion: 'Descripción desde DB',
        propietario_id: 'usuario-456',
        tienda_id: 'tienda-789',
        activa: true,
        fecha_creacion: new Date('2023-01-01'),
        fecha_actualizacion: new Date('2023-01-02'),
      };

      const result = Lista.fromPersistence(persistenceData);
      expect(result.isSuccess).toBe(true);
      
      if (result.isSuccess) {
        const lista = result.value;
        expect(lista.id).toBe('lista-123');
        expect(lista.nombre).toBe('Lista desde DB');
        expect(lista.descripcion).toBe('Descripción desde DB');
        expect(lista.propietarioId).toBe('usuario-456');
        expect(lista.tiendaId).toBe('tienda-789');
        expect(lista.activa).toBe(true);
        expect(lista.fechaCreacion).toEqual(new Date('2023-01-01'));
        expect(lista.fechaActualizacion).toEqual(new Date('2023-01-02'));
      }
    });

    it('debería manejar valores null en persistencia', () => {
      const persistenceData = {
        id: 'lista-123',
        nombre: 'Lista Simple',
        descripcion: null,
        propietario_id: 'usuario-456',
        tienda_id: null,
        activa: false,
        fecha_creacion: new Date(),
        fecha_actualizacion: new Date(),
      };

      const result = Lista.fromPersistence(persistenceData);
      expect(result.isSuccess).toBe(true);
      
      if (result.isSuccess) {
        const lista = result.value;
        expect(lista.descripcion).toBeNull();
        expect(lista.tiendaId).toBeNull();
        expect(lista.activa).toBe(false);
      }
    });
  });
});