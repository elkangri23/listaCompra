/**
 * Tests unitarios para la entidad Producto
 */

import { Producto } from '../../../src/domain/entities/Producto';
import { InvalidValueError } from '../../../src/domain/errors/DomainError';

describe('Entidad Producto', () => {
  const validProductData = {
    nombre: 'Leche',
    descripcion: 'Leche entera 1L',
    cantidad: 2,
    unidad: 'litros',
    precio: 1.50,
    urgente: false,
    listaId: 'lista-123',
    categoriaId: 'categoria-123',
    creadoPorId: 'usuario-123'
  };

  describe('create', () => {
    it('debería crear un producto válido con datos mínimos', () => {
      const data = {
        nombre: 'Pan',
        listaId: 'lista-123',
        creadoPorId: 'usuario-123'
      };

      const result = Producto.create(data);

      expect(result.isSuccess).toBe(true);
      if (result.isSuccess) {
        const producto = result.value;
        expect(producto.nombre).toBe('Pan');
        expect(producto.cantidad).toBe(1); // valor por defecto
        expect(producto.comprado).toBe(false); // valor por defecto
        expect(producto.urgente).toBe(false); // valor por defecto
        expect(producto.listaId).toBe('lista-123');
        expect(producto.creadoPorId).toBe('usuario-123');
        expect(producto.id).toBeDefined();
        expect(producto.fechaCreacion).toBeInstanceOf(Date);
        expect(producto.fechaActualizacion).toBeInstanceOf(Date);
      }
    });

    it('debería crear un producto válido con todos los datos', () => {
      const result = Producto.create(validProductData);

      expect(result.isSuccess).toBe(true);
      if (result.isSuccess) {
        const producto = result.value;
        expect(producto.nombre).toBe('Leche');
        expect(producto.descripcion).toBe('Leche entera 1L');
        expect(producto.cantidad).toBe(2);
        expect(producto.unidad).toBe('litros');
        expect(producto.precio).toBe(1.50);
        expect(producto.urgente).toBe(false);
        expect(producto.listaId).toBe('lista-123');
        expect(producto.categoriaId).toBe('categoria-123');
        expect(producto.creadoPorId).toBe('usuario-123');
      }
    });

    it('debería fallar con nombre vacío', () => {
      const data = { ...validProductData, nombre: '' };
      const result = Producto.create(data);

      expect(result.isFailure).toBe(true);
      if (result.isFailure) {
        expect(result.error).toBeInstanceOf(InvalidValueError);
        expect(result.error.message).toContain('El nombre del producto es requerido');
      }
    });

    it('debería fallar con nombre demasiado largo', () => {
      const data = { ...validProductData, nombre: 'a'.repeat(201) };
      const result = Producto.create(data);

      expect(result.isFailure).toBe(true);
      if (result.isFailure) {
        expect(result.error).toBeInstanceOf(InvalidValueError);
        expect(result.error.message).toContain('no puede exceder 200 caracteres');
      }
    });

    it('debería fallar con descripción demasiado larga', () => {
      const data = { ...validProductData, descripcion: 'a'.repeat(1001) };
      const result = Producto.create(data);

      expect(result.isFailure).toBe(true);
      if (result.isFailure) {
        expect(result.error).toBeInstanceOf(InvalidValueError);
        expect(result.error.message).toContain('no puede exceder 1000 caracteres');
      }
    });

    it('debería fallar con cantidad inválida', () => {
      const data = { ...validProductData, cantidad: 0 };
      const result = Producto.create(data);

      expect(result.isFailure).toBe(true);
      if (result.isFailure) {
        expect(result.error).toBeInstanceOf(InvalidValueError);
        expect(result.error.message).toContain('La cantidad debe ser mayor a 0');
      }
    });

    it('debería fallar con cantidad muy alta', () => {
      const data = { ...validProductData, cantidad: 1000000 };
      const result = Producto.create(data);

      expect(result.isFailure).toBe(true);
      if (result.isFailure) {
        expect(result.error).toBeInstanceOf(InvalidValueError);
        expect(result.error.message).toContain('no puede exceder 999,999');
      }
    });

    it('debería fallar con precio negativo', () => {
      const data = { ...validProductData, precio: -1 };
      const result = Producto.create(data);

      expect(result.isFailure).toBe(true);
      if (result.isFailure) {
        expect(result.error).toBeInstanceOf(InvalidValueError);
        expect(result.error.message).toContain('no puede ser negativo');
      }
    });

    it('debería fallar sin listaId', () => {
      const data = { ...validProductData, listaId: undefined as any };
      const result = Producto.create(data);

      expect(result.isFailure).toBe(true);
      if (result.isFailure) {
        expect(result.error).toBeInstanceOf(InvalidValueError);
        expect(result.error.message).toContain('El ID de la lista es requerido');
      }
    });

    it('debería fallar sin creadoPorId', () => {
      const data = { ...validProductData, creadoPorId: undefined as any };
      const result = Producto.create(data);

      expect(result.isFailure).toBe(true);
      if (result.isFailure) {
        expect(result.error).toBeInstanceOf(InvalidValueError);
        expect(result.error.message).toContain('El ID del creador es requerido');
      }
    });
  });

  describe('actualizar métodos', () => {
    let producto: Producto;

    beforeEach(() => {
      const result = Producto.create(validProductData);
      if (result.isSuccess) {
        producto = result.value;
      }
    });

    it('debería actualizar el nombre correctamente', async () => {
      // Delay más largo para asegurar que las fechas sean diferentes
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const result = producto.actualizarNombre('Leche Desnatada');

      expect(result.isSuccess).toBe(true);
      expect(producto.nombre).toBe('Leche Desnatada');
      expect(producto.fechaActualizacion.getTime()).toBeGreaterThan(producto.fechaCreacion.getTime());
    });

    it('debería actualizar cantidad correctamente', () => {
      const result = producto.actualizarCantidad(3);

      expect(result.isSuccess).toBe(true);
      expect(producto.cantidad).toBe(3);
    });

    it('debería actualizar precio correctamente', () => {
      const result = producto.actualizarPrecio(2.25);

      expect(result.isSuccess).toBe(true);
      expect(producto.precio).toBe(2.25);
    });

    it('debería fallar al actualizar con datos inválidos', () => {
      const result = producto.actualizarNombre('');

      expect(result.isFailure).toBe(true);
      if (result.isFailure) {
        expect(result.error).toBeInstanceOf(InvalidValueError);
      }
    });
  });

  describe('marcarComoComprado', () => {
    let producto: Producto;

    beforeEach(() => {
      const result = Producto.create(validProductData);
      if (result.isSuccess) {
        producto = result.value;
      }
    });

    it('debería marcar como comprado correctamente', () => {
      producto.marcarComoComprado();

      expect(producto.comprado).toBe(true);
      expect(producto.fechaCompra).toBeInstanceOf(Date);
      expect(producto.fechaCompra!.getTime()).toBeGreaterThanOrEqual(producto.fechaCreacion.getTime());
    });

    it('debería marcar como comprado con precio actualizado', () => {
      // Primero actualizar el precio, luego marcar como comprado
      producto.actualizarPrecio(2.50);
      producto.marcarComoComprado();

      expect(producto.comprado).toBe(true);
      expect(producto.precio).toBe(2.50);
      expect(producto.fechaCompra).toBeInstanceOf(Date);
    });

    it('debería desmarcar como comprado', () => {
      producto.marcarComoComprado();
      producto.marcarComoNoComprado();

      expect(producto.comprado).toBe(false);
      expect(producto.fechaCompra).toBeNull();
    });
  });

  describe('marcarComoUrgente', () => {
    let producto: Producto;

    beforeEach(() => {
      const result = Producto.create(validProductData);
      if (result.isSuccess) {
        producto = result.value;
      }
    });

    it('debería marcar como urgente', () => {
      producto.marcarComoUrgente();

      expect(producto.urgente).toBe(true);
    });

    it('debería desmarcar como urgente', () => {
      producto.marcarComoUrgente();
      producto.marcarComoNoUrgente();

      expect(producto.urgente).toBe(false);
    });
  });

  describe('validaciones de reglas de negocio', () => {
    it('debería crear un producto válido', () => {
      const result = Producto.create(validProductData);
      expect(result.isSuccess).toBe(true);
    });

    it('debería fallar con datos inválidos', () => {
      const result = Producto.create({ ...validProductData, nombre: '' });
      expect(result.isFailure).toBe(true);
    });

    it('debería reconstruir desde persistencia', () => {
      const persistenceData = {
        id: 'producto-123',
        nombre: 'Test Product',
        descripcion: null,
        cantidad: 1,
        unidad: null,
        precio: null,
        comprado: false,
        urgente: false,
        listaId: 'lista-123',
        categoriaId: null,
        creadoPorId: 'usuario-123',
        fechaCreacion: new Date(),
        fechaActualizacion: new Date(),
        fechaCompra: null
      };

      const result = Producto.fromPersistence(persistenceData);
      expect(result.isSuccess).toBe(true);
      
      if (result.isSuccess) {
        const producto = result.value;
        expect(producto.nombre).toBe('Test Product');
        expect(producto.id).toBe('producto-123');
      }
    });
  });

  describe('métodos de información', () => {
    let producto: Producto;

    beforeEach(() => {
      const result = Producto.create(validProductData);
      if (result.isSuccess) {
        producto = result.value;
      }
    });

    it('debería indicar si está comprado', () => {
      expect(producto.estaComprado()).toBe(false);
      
      producto.marcarComoComprado();
      expect(producto.estaComprado()).toBe(true);
    });

    it('debería calcular el valor total correctamente', () => {
      const valorTotal = producto.calcularValorTotal();
      expect(valorTotal).toBe(3.00); // 2 * 1.50
    });

    it('debería retornar null para valor total si no hay precio', () => {
      const data = { ...validProductData, precio: null };
      const result = Producto.create(data);
      
      if (result.isSuccess) {
        const producto = result.value;
        expect(producto.calcularValorTotal()).toBeNull();
      }
    });

    it('debería verificar si puede modificar', () => {
      expect(producto.puedeModificar('usuario-123')).toBe(true);
      expect(producto.puedeModificar('otro-usuario')).toBe(false);
    });

    it('debería convertir a JSON correctamente', () => {
      const json = producto.toJSON();
      
      expect(json).toMatchObject({
        id: producto.id,
        nombre: 'Leche',
        cantidad: 2,
        comprado: false,
        urgente: false,
        precio: 1.50,
        valorTotal: 3.00
      });
      expect(json['fechaCreacion']).toBeDefined();
      expect(json['fechaActualizacion']).toBeDefined();
    });
  });
});