/**
 * Tests unitarios para la entidad Tienda
 */

import { Tienda } from '@domain/entities/Tienda';
import { InvalidValueError } from '@domain/errors/DomainError';

describe('Tienda Entity', () => {
  describe('create', () => {
    it('should create a valid store with required fields', () => {
      // Arrange
      const nombre = 'Supermercado Central';

      // Act
      const result = Tienda.create({ nombre });

      // Assert
      expect(result.isSuccess).toBe(true);
      if (result.isSuccess) {
        expect(result.value.nombre).toBe(nombre);
        expect(result.value.activa).toBe(true);
        expect(result.value.id).toBeDefined();
        expect(result.value.fechaCreacion).toBeDefined();
        expect(result.value.fechaActualizacion).toBeDefined();
      }
    });

    it('should create a store with optional fields', () => {
      // Arrange
      const data = {
        nombre: 'Tienda Online',
        direccion: 'Calle Principal 123',
        telefono: '+34 123 456 789',
        sitioWeb: 'https://tienda.com'
      };

      // Act
      const result = Tienda.create(data);

      // Assert
      expect(result.isSuccess).toBe(true);
      if (result.isSuccess) {
        expect(result.value.direccion).toBe(data.direccion);
        expect(result.value.telefono).toBe(data.telefono);
        expect(result.value.sitioWeb).toBe(data.sitioWeb);
      }
    });

    it('should fail with empty name', () => {
      // Arrange
      const data = { nombre: '' };

      // Act
      const result = Tienda.create(data);

      // Assert
      expect(result.isFailure).toBe(true);
      if (result.isFailure) {
        expect(result.error).toBeInstanceOf(InvalidValueError);
        expect((result.error as InvalidValueError).field).toBe('nombre');
      }
    });

    it('should create with very short name', () => {
      // Arrange
      const data = { nombre: 'a' };

      // Act
      const result = Tienda.create(data);

      // Assert
      expect(result.isSuccess).toBe(true);
    });

    it('should fail with name too long', () => {
      // Arrange
      const data = { nombre: 'a'.repeat(201) };

      // Act
      const result = Tienda.create(data);

      // Assert
      expect(result.isFailure).toBe(true);
      if (result.isFailure) {
        expect(result.error).toBeInstanceOf(InvalidValueError);
        expect((result.error as InvalidValueError).field).toBe('nombre');
      }
    });

    it('should fail with invalid website URL', () => {
      // Arrange
      const data = { 
        nombre: 'Tienda Test',
        sitioWeb: 'invalid-url'
      };

      // Act
      const result = Tienda.create(data);

      // Assert
      expect(result.isFailure).toBe(true);
      if (result.isFailure) {
        expect(result.error).toBeInstanceOf(InvalidValueError);
        expect((result.error as InvalidValueError).field).toBe('sitioWeb');
      }
    });

    it('should fail with invalid phone format', () => {
      // Arrange
      const data = { 
        nombre: 'Tienda Test',
        telefono: '123'
      };

      // Act
      const result = Tienda.create(data);

      // Assert
      expect(result.isFailure).toBe(true);
      if (result.isFailure) {
        expect(result.error).toBeInstanceOf(InvalidValueError);
        expect((result.error as InvalidValueError).field).toBe('telefono');
      }
    });
  });

  describe('updateNombre', () => {
    it('should update name successfully', () => {
      // Arrange
      const tienda = Tienda.create({ nombre: 'Tienda Original' });
      expect(tienda.isSuccess).toBe(true);
      
      const newName = 'Tienda Actualizada';

      // Act
      if (tienda.isSuccess) {
        const result = tienda.value.updateNombre(newName);

        // Assert
        expect(result.isSuccess).toBe(true);
        expect(tienda.value.nombre).toBe(newName);
      }
    });

    it('should fail to update with invalid name', () => {
      // Arrange
      const tienda = Tienda.create({ nombre: 'Tienda Original' });
      expect(tienda.isSuccess).toBe(true);

      // Act
      if (tienda.isSuccess) {
        const result = tienda.value.updateNombre('');

        // Assert
        expect(result.isFailure).toBe(true);
        if (result.isFailure) {
          expect(result.error).toBeInstanceOf(InvalidValueError);
        }
      }
    });
  });

  describe('updateDireccion', () => {
    it('should update address successfully', () => {
      // Arrange
      const tienda = Tienda.create({ nombre: 'Tienda Test' });
      expect(tienda.isSuccess).toBe(true);
      
      const newAddress = 'Nueva Dirección 456';

      // Act
      if (tienda.isSuccess) {
        const result = tienda.value.updateDireccion(newAddress);

        // Assert
        expect(result.isSuccess).toBe(true);
        expect(tienda.value.direccion).toBe(newAddress);
      }
    });

    it('should clear address when null', () => {
      // Arrange
      const tienda = Tienda.create({ 
        nombre: 'Tienda Test',
        direccion: 'Dirección Original'
      });
      expect(tienda.isSuccess).toBe(true);

      // Act
      if (tienda.isSuccess) {
        const result = tienda.value.updateDireccion(undefined);

        // Assert
        expect(result.isSuccess).toBe(true);
        expect(tienda.value.direccion).toBeNull();
      }
    });
  });

  describe('updateTelefono', () => {
    it('should update phone successfully', () => {
      // Arrange
      const tienda = Tienda.create({ nombre: 'Tienda Test' });
      expect(tienda.isSuccess).toBe(true);
      
      const newPhone = '+34 987 654 321';

      // Act
      if (tienda.isSuccess) {
        const result = tienda.value.updateTelefono(newPhone);

        // Assert
        expect(result.isSuccess).toBe(true);
        expect(tienda.value.telefono).toBe(newPhone);
      }
    });

    it('should fail with invalid phone format', () => {
      // Arrange
      const tienda = Tienda.create({ nombre: 'Tienda Test' });
      expect(tienda.isSuccess).toBe(true);

      // Act
      if (tienda.isSuccess) {
        const result = tienda.value.updateTelefono('123');

        // Assert
        expect(result.isFailure).toBe(true);
        if (result.isFailure) {
          expect(result.error).toBeInstanceOf(InvalidValueError);
        }
      }
    });
  });

  describe('updateSitioWeb', () => {
    it('should update website successfully', () => {
      // Arrange
      const tienda = Tienda.create({ nombre: 'Tienda Test' });
      expect(tienda.isSuccess).toBe(true);
      
      const newWebsite = 'https://nueva-tienda.com';

      // Act
      if (tienda.isSuccess) {
        const result = tienda.value.updateSitioWeb(newWebsite);

        // Assert
        expect(result.isSuccess).toBe(true);
        expect(tienda.value.sitioWeb).toBe(newWebsite);
      }
    });

    it('should fail with invalid URL', () => {
      // Arrange
      const tienda = Tienda.create({ nombre: 'Tienda Test' });
      expect(tienda.isSuccess).toBe(true);

      // Act
      if (tienda.isSuccess) {
        const result = tienda.value.updateSitioWeb('invalid-url');

        // Assert
        expect(result.isFailure).toBe(true);
        if (result.isFailure) {
          expect(result.error).toBeInstanceOf(InvalidValueError);
        }
      }
    });
  });

  describe('deactivate', () => {
    it('should deactivate store', () => {
      // Arrange
      const tienda = Tienda.create({ nombre: 'Tienda Test' });
      expect(tienda.isSuccess).toBe(true);

      // Act & Assert
      if (tienda.isSuccess) {
        expect(tienda.value.activa).toBe(true);
        
        tienda.value.desactivar();
        expect(tienda.value.activa).toBe(false);
      }
    });
  });

  describe('hasContactInfo', () => {
    it('should return true when has phone', () => {
      // Arrange
      const tienda = Tienda.create({ 
        nombre: 'Tienda Test',
        telefono: '+34 123 456 789'
      });
      expect(tienda.isSuccess).toBe(true);

      // Act & Assert
      if (tienda.isSuccess) {
        expect(tienda.value.hasContactInfo()).toBe(true);
      }
    });

    it('should return true when has website', () => {
      // Arrange
      const tienda = Tienda.create({ 
        nombre: 'Tienda Test',
        sitioWeb: 'https://tienda.com'
      });
      expect(tienda.isSuccess).toBe(true);

      // Act & Assert
      if (tienda.isSuccess) {
        expect(tienda.value.hasContactInfo()).toBe(true);
      }
    });

    it('should return false when has no contact info', () => {
      // Arrange
      const tienda = Tienda.create({ nombre: 'Tienda Test' });
      expect(tienda.isSuccess).toBe(true);

      // Act & Assert
      if (tienda.isSuccess) {
        expect(tienda.value.hasContactInfo()).toBe(false);
      }
    });
  });
});