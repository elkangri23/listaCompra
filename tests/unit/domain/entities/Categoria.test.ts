/**
 * Tests unitarios para la entidad Categoria
 */

import { Categoria } from '@domain/entities/Categoria';
import { InvalidValueError } from '@domain/errors/DomainError';

describe('Categoria Entity', () => {
  describe('create', () => {
    it('should create a valid category with required fields', () => {
      // Arrange
      const nombre = 'Frutas';
      const descripcion = 'Productos frescos';

      // Act
      const result = Categoria.create({ nombre, descripcion });

      // Assert
      expect(result.isSuccess).toBe(true);
      if (result.isSuccess) {
        expect(result.value.nombre).toBe(nombre);
        expect(result.value.descripcion).toBe(descripcion);
        expect(result.value.activa).toBe(true);
        expect(result.value.id).toBeDefined();
        expect(result.value.fechaCreacion).toBeDefined();
        expect(result.value.fechaActualizacion).toBeDefined();
      }
    });

    it('should create a category with optional fields', () => {
      // Arrange
      const data = {
        nombre: 'Verduras',
        descripcion: 'Vegetales frescos',
        color: '#00FF00',
        icono: '🥬',
        tiendaId: 'tienda-123'
      };

      // Act
      const result = Categoria.create(data);

      // Assert
      expect(result.isSuccess).toBe(true);
      if (result.isSuccess) {
        expect(result.value.color).toBe(data.color);
        expect(result.value.icono).toBe(data.icono);
        expect(result.value.tiendaId).toBe(data.tiendaId);
      }
    });

    it('should fail with empty name', () => {
      // Arrange
      const data = { nombre: '', descripcion: 'Test' };

      // Act
      const result = Categoria.create(data);

      // Assert
      expect(result.isFailure).toBe(true);
      if (result.isFailure) {
        expect(result.error).toBeInstanceOf(InvalidValueError);
        expect((result.error as InvalidValueError).field).toBe('nombre');
      }
    });

    it('should create with very short name', () => {
      // Arrange
      const data = { nombre: 'a', descripcion: 'Test' };

      // Act
      const result = Categoria.create(data);

      // Assert
      expect(result.isSuccess).toBe(true);
    });

    it('should fail with name too long', () => {
      // Arrange
      const data = { 
        nombre: 'a'.repeat(101), 
        descripcion: 'Test' 
      };

      // Act
      const result = Categoria.create(data);

      // Assert
      expect(result.isFailure).toBe(true);
      if (result.isFailure) {
        expect(result.error).toBeInstanceOf(InvalidValueError);
        expect((result.error as InvalidValueError).field).toBe('nombre');
      }
    });

    it('should fail with invalid color format', () => {
      // Arrange
      const data = { 
        nombre: 'Test', 
        descripcion: 'Test',
        color: 'invalid-color'
      };

      // Act
      const result = Categoria.create(data);

      // Assert
      expect(result.isFailure).toBe(true);
      if (result.isFailure) {
        expect(result.error).toBeInstanceOf(InvalidValueError);
        expect((result.error as InvalidValueError).field).toBe('color');
      }
    });
  });

  describe('updateNombre', () => {
    it('should update name successfully', () => {
      // Arrange
      const categoria = Categoria.create({ 
        nombre: 'Frutas', 
        descripcion: 'Test' 
      });
      expect(categoria.isSuccess).toBe(true);
      
      const newName = 'Frutas Tropicales';

      // Act
      if (categoria.isSuccess) {
        const result = categoria.value.updateNombre(newName);

        // Assert
        expect(result.isSuccess).toBe(true);
        expect(categoria.value.nombre).toBe(newName);
      }
    });

    it('should fail to update with invalid name', () => {
      // Arrange
      const categoria = Categoria.create({ 
        nombre: 'Frutas', 
        descripcion: 'Test' 
      });
      expect(categoria.isSuccess).toBe(true);

      // Act
      if (categoria.isSuccess) {
        const result = categoria.value.updateNombre('');

        // Assert
        expect(result.isFailure).toBe(true);
        if (result.isFailure) {
          expect(result.error).toBeInstanceOf(InvalidValueError);
        }
      }
    });
  });

  describe('updateDescripcion', () => {
    it('should update description successfully', () => {
      // Arrange
      const categoria = Categoria.create({ 
        nombre: 'Frutas', 
        descripcion: 'Test' 
      });
      expect(categoria.isSuccess).toBe(true);
      
      const newDescription = 'Frutas frescas de temporada';

      // Act
      if (categoria.isSuccess) {
        const result = categoria.value.updateDescripcion(newDescription);

        // Assert
        expect(result.isSuccess).toBe(true);
        expect(categoria.value.descripcion).toBe(newDescription);
      }
    });
  });

  describe('assignToTienda', () => {
    it('should assign category to store successfully', () => {
      // Arrange
      const categoria = Categoria.create({ 
        nombre: 'Frutas', 
        descripcion: 'Test' 
      });
      expect(categoria.isSuccess).toBe(true);
      
      const tiendaId = 'tienda-123';

      // Act
      if (categoria.isSuccess) {
        categoria.value.assignToTienda(tiendaId);

        // Assert
        expect(categoria.value.tiendaId).toBe(tiendaId);
      }
    });

    it('should remove category from store', () => {
      // Arrange
      const categoria = Categoria.create({ 
        nombre: 'Frutas', 
        descripcion: 'Test',
        tiendaId: 'tienda-123'
      });
      expect(categoria.isSuccess).toBe(true);

      // Act
      if (categoria.isSuccess) {
        categoria.value.removeFromTienda();

        // Assert
        expect(categoria.value.tiendaId).toBeNull();
      }
    });
  });

  describe('deactivate', () => {
    it('should deactivate category', () => {
      // Arrange
      const categoria = Categoria.create({ 
        nombre: 'Frutas', 
        descripcion: 'Test' 
      });
      expect(categoria.isSuccess).toBe(true);

      // Act & Assert
      if (categoria.isSuccess) {
        expect(categoria.value.activa).toBe(true);
        
        categoria.value.desactivar();
        expect(categoria.value.activa).toBe(false);
      }
    });
  });

  describe('updateColor', () => {
    it('should update color successfully', () => {
      // Arrange
      const categoria = Categoria.create({ 
        nombre: 'Frutas', 
        descripcion: 'Test' 
      });
      expect(categoria.isSuccess).toBe(true);
      
      const newColor = '#FF0000';

      // Act
      if (categoria.isSuccess) {
        const result = categoria.value.updateColor(newColor);

        // Assert
        expect(result.isSuccess).toBe(true);
        expect(categoria.value.color).toBe(newColor);
      }
    });

    it('should fail with invalid color', () => {
      // Arrange
      const categoria = Categoria.create({ 
        nombre: 'Frutas', 
        descripcion: 'Test' 
      });
      expect(categoria.isSuccess).toBe(true);

      // Act
      if (categoria.isSuccess) {
        const result = categoria.value.updateColor('invalid');

        // Assert
        expect(result.isFailure).toBe(true);
        if (result.isFailure) {
          expect(result.error).toBeInstanceOf(InvalidValueError);
        }
      }
    });
  });
});