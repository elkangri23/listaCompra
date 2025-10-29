/**
 * Tests unitarios para la entidad Blueprint
 */

import { Blueprint, ProductoPlantilla } from '../../../../src/domain/entities/Blueprint';

describe('Blueprint Entity', () => {
  const sampleProducts: ProductoPlantilla[] = [
    {
      nombre: 'Leche',
      cantidad: 2,
      notas: 'Preferiblemente deslactosada',
      categoriaId: 'cat-001'
    },
    {
      nombre: 'Pan',
      cantidad: 1,
      notas: undefined,
      categoriaId: undefined
    }
  ];

  describe('crear', () => {
    it('debería crear un blueprint válido', () => {
      const result = Blueprint.crear(
        'Lista básica',
        'Productos esenciales para el hogar',
        false,
        sampleProducts,
        'user-001'
      );

      expect(result.isSuccess()).toBe(true);
      const blueprint = result.getValue();
      expect(blueprint.nombre).toBe('Lista básica');
      expect(blueprint.descripcion).toBe('Productos esenciales para el hogar');
      expect(blueprint.publico).toBe(false);
      expect(blueprint.productos).toHaveLength(2);
      expect(blueprint.creadoPorId).toBe('user-001');
    });

    it('debería fallar con nombre vacío', () => {
      const result = Blueprint.crear(
        '',
        'Descripción válida',
        false,
        sampleProducts,
        'user-001'
      );

      expect(result.isSuccess()).toBe(false);
      expect(result.getError().message).toContain('nombre no puede estar vacío');
    });

    it('debería fallar con nombre muy largo', () => {
      const nombreLargo = 'a'.repeat(101);
      const result = Blueprint.crear(
        nombreLargo,
        'Descripción válida',
        false,
        sampleProducts,
        'user-001'
      );

      expect(result.isSuccess()).toBe(false);
      expect(result.getError().message).toContain('nombre no puede exceder 100 caracteres');
    });

    it('debería fallar con descripción muy larga', () => {
      const descripcionLarga = 'a'.repeat(501);
      const result = Blueprint.crear(
        'Nombre válido',
        descripcionLarga,
        false,
        sampleProducts,
        'user-001'
      );

      expect(result.isSuccess()).toBe(false);
      expect(result.getError().message).toContain('descripción no puede exceder 500 caracteres');
    });

    it('debería fallar sin productos', () => {
      const result = Blueprint.crear(
        'Nombre válido',
        'Descripción válida',
        false,
        [],
        'user-001'
      );

      expect(result.isSuccess()).toBe(false);
      expect(result.getError().message).toContain('debe contener al menos un producto');
    });

    it('debería fallar con demasiados productos', () => {
      const muchosProductos: ProductoPlantilla[] = Array.from({ length: 51 }, (_, i) => ({
        nombre: `Producto ${i + 1}`,
        cantidad: 1
      }));

      const result = Blueprint.crear(
        'Nombre válido',
        'Descripción válida',
        false,
        muchosProductos,
        'user-001'
      );

      expect(result.isSuccess()).toBe(false);
      expect(result.getError().message).toContain('no puede contener más de 50 productos');
    });

    it('debería fallar con producto inválido', () => {
      const productosConError: ProductoPlantilla[] = [
        {
          nombre: '',
          cantidad: 1
        }
      ];

      const result = Blueprint.crear(
        'Nombre válido',
        'Descripción válida',
        false,
        productosConError,
        'user-001'
      );

      expect(result.isSuccess()).toBe(false);
      expect(result.getError().message).toContain('El producto 1 tiene un nombre inválido');
    });
  });

  describe('actualizar', () => {
    let blueprint: Blueprint;

    beforeEach(() => {
      const result = Blueprint.crear(
        'Lista inicial',
        'Descripción inicial',
        false,
        sampleProducts,
        'user-001'
      );
      blueprint = result.getValue();
    });

    it('debería actualizar correctamente', () => {
      const nuevosProductos: ProductoPlantilla[] = [
        {
          nombre: 'Agua',
          cantidad: 6
        }
      ];

      const result = blueprint.actualizar(
        'Lista actualizada',
        'Nueva descripción',
        true,
        nuevosProductos
      );

      expect(result.isSuccess()).toBe(true);
      const updated = result.getValue();
      expect(updated.nombre).toBe('Lista actualizada');
      expect(updated.descripcion).toBe('Nueva descripción');
      expect(updated.publico).toBe(true);
      expect(updated.productos).toHaveLength(1);
      expect(updated.productos[0].nombre).toBe('Agua');
      expect(updated.fechaActualizacion).not.toEqual(blueprint.fechaActualizacion);
    });

    it('debería fallar con datos inválidos', () => {
      const result = blueprint.actualizar(
        '',
        'Descripción válida',
        false,
        sampleProducts
      );

      expect(result.isSuccess()).toBe(false);
      expect(result.getError().message).toContain('nombre no puede estar vacío');
    });
  });

  describe('recrear', () => {
    it('debería recrear un blueprint desde datos persistidos', () => {
      const fechaCreacion = new Date('2023-01-01');
      const fechaActualizacion = new Date('2023-01-02');

      const blueprint = Blueprint.recrear(
        'blueprint-001',
        'Lista recreada',
        'Descripción recreada',
        true,
        sampleProducts,
        'user-001',
        fechaCreacion,
        fechaActualizacion
      );

      expect(blueprint.id).toBe('blueprint-001');
      expect(blueprint.nombre).toBe('Lista recreada');
      expect(blueprint.descripcion).toBe('Descripción recreada');
      expect(blueprint.publico).toBe(true);
      expect(blueprint.productos).toEqual(sampleProducts);
      expect(blueprint.creadoPorId).toBe('user-001');
      expect(blueprint.fechaCreacion).toEqual(fechaCreacion);
      expect(blueprint.fechaActualizacion).toEqual(fechaActualizacion);
    });
  });

  describe('validarProducto', () => {
    it('debería validar producto correcto', () => {
      const resultado = Blueprint.validarProducto({
        nombre: 'Producto válido',
        cantidad: 5,
        notas: 'Notas opcionales',
        categoriaId: 'cat-001'
      });

      expect(resultado.isSuccess()).toBe(true);
    });

    it('debería fallar con nombre vacío', () => {
      const resultado = Blueprint.validarProducto({
        nombre: '',
        cantidad: 1
      });

      expect(resultado.isSuccess()).toBe(false);
      expect(resultado.getError().message).toContain('El nombre del producto no puede estar vacío');
    });

    it('debería fallar con cantidad inválida', () => {
      const resultado = Blueprint.validarProducto({
        nombre: 'Producto',
        cantidad: 0
      });

      expect(resultado.isSuccess()).toBe(false);
      expect(resultado.getError().message).toContain('La cantidad debe ser mayor a 0');
    });

    it('debería fallar con notas muy largas', () => {
      const notasLargas = 'a'.repeat(201);
      const resultado = Blueprint.validarProducto({
        nombre: 'Producto',
        cantidad: 1,
        notas: notasLargas
      });

      expect(resultado.isSuccess()).toBe(false);
      expect(resultado.getError().message).toContain('Las notas no pueden exceder 200 caracteres');
    });
  });
});