import { PrismaClient } from '@prisma/client';
import { PrismaProductoRepository } from '../../../src/infrastructure/persistence/repositories/PrismaProductoRepository';
import { Producto } from '../../../src/domain/entities/Producto';

describe('PrismaProductoRepository Integration Tests', () => {
  let prisma: PrismaClient;
  let repository: PrismaProductoRepository;
  let testUsuarioId: string;
  let testListaId: string;

  beforeAll(async () => {
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env['TEST_DATABASE_URL'] || process.env['DATABASE_URL']!,
        },
      },
    });
    
    repository = new PrismaProductoRepository(prisma);

    // Crear usuario de prueba
    const usuario = await prisma.usuario.create({
      data: {
        email: `test-${Date.now()}@test.com`,
        nombre: 'Test User',
        password: 'hashedPassword123',
        fechaCreacion: new Date(),
        fechaActualizacion: new Date(),
      },
    });
    testUsuarioId = usuario.id;

    // Crear lista de prueba
    const lista = await prisma.lista.create({
      data: {
        nombre: 'Lista de Test',
        descripcion: 'Lista para testing',
        propietarioId: testUsuarioId,
        fechaCreacion: new Date(),
        fechaActualizacion: new Date(),
      },
    });
    testListaId = lista.id;
  });

  afterAll(async () => {
    // Limpiar datos de test
    await prisma.producto.deleteMany({
      where: { listaId: testListaId },
    });
    await prisma.lista.delete({
      where: { id: testListaId },
    });
    await prisma.usuario.delete({
      where: { id: testUsuarioId },
    });
    
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Limpiar productos antes de cada test
    await prisma.producto.deleteMany({
      where: { listaId: testListaId },
    });
  });

  describe('save', () => {
    it('debería guardar un nuevo producto correctamente', async () => {
      const productoData = {
        nombre: 'Leche Entera',
        descripcion: 'Leche fresca de vaca',
        cantidad: 2,
        unidad: 'litros',
        precio: 1.50,
        urgente: false,
        listaId: testListaId,
        creadoPorId: testUsuarioId,
      };

      const productoResult = Producto.create(productoData);
      expect(productoResult.isSuccess).toBe(true);

      if (productoResult.isSuccess) {
        const producto = productoResult.value;
        const result = await repository.save(producto);

        expect(result.isSuccess).toBe(true);
        if (result.isSuccess) {
          const savedProducto = result.value;
          expect(savedProducto.nombre).toBe('Leche Entera');
          expect(savedProducto.cantidad).toBe(2);
          expect(savedProducto.precio).toBe(1.50);
          expect(savedProducto.listaId).toBe(testListaId);
        }
      }
    });

    it('debería actualizar un producto existente', async () => {
      // Crear producto inicial
      const productoData = {
        nombre: 'Pan Integral',
        cantidad: 1,
        precio: 2.00,
        urgente: false,
        listaId: testListaId,
        creadoPorId: testUsuarioId,
      };

      const productoResult = Producto.create(productoData);
      expect(productoResult.isSuccess).toBe(true);

      if (productoResult.isSuccess) {
        const producto = productoResult.value;
        await repository.save(producto);

        // Actualizar el producto
        producto.actualizarNombre('Pan Integral Artesanal');
        producto.actualizarCantidad(2);

        const updateResult = await repository.save(producto);
        expect(updateResult.isSuccess).toBe(true);

        if (updateResult.isSuccess) {
          const updatedProducto = updateResult.value;
          expect(updatedProducto.nombre).toBe('Pan Integral Artesanal');
          expect(updatedProducto.cantidad).toBe(2);
        }
      }
    });
  });

  describe('findById', () => {
    it('debería encontrar un producto por su ID', async () => {
      // Crear producto
      const productoData = {
        nombre: 'Yogur Natural',
        cantidad: 4,
        precio: 0.80,
        urgente: true,
        listaId: testListaId,
        creadoPorId: testUsuarioId,
      };

      const productoResult = Producto.create(productoData);
      expect(productoResult.isSuccess).toBe(true);

      if (productoResult.isSuccess) {
        const producto = productoResult.value;
        await repository.save(producto);

        // Buscar por ID
        const foundResult = await repository.findById(producto.id);
        expect(foundResult.isSuccess).toBe(true);

        if (foundResult.isSuccess) {
          const foundProducto = foundResult.value;
          expect(foundProducto).toBeDefined();
          expect(foundProducto!.nombre).toBe('Yogur Natural');
          expect(foundProducto!.urgente).toBe(true);
        }
      }
    });

    it('debería retornar null si el producto no existe', async () => {
      const result = await repository.findById('non-existent-id');
      expect(result.isSuccess).toBe(true);
      if (result.isSuccess) {
        expect(result.value).toBeNull();
      }
    });
  });

  describe('findByList', () => {
    it('debería encontrar todos los productos de una lista', async () => {
      // Crear múltiples productos
      const productos = [
        { nombre: 'Arroz', cantidad: 1, precio: 1.20, urgente: false },
        { nombre: 'Pasta', cantidad: 2, precio: 0.90, urgente: true },
        { nombre: 'Aceite', cantidad: 1, precio: 3.50, urgente: false },
      ];

      for (const data of productos) {
        const productoResult = Producto.create({
          ...data,
          listaId: testListaId,
          creadoPorId: testUsuarioId,
        });

        if (productoResult.isSuccess) {
          await repository.save(productoResult.value);
        }
      }

      // Buscar productos de la lista
      const result = await repository.findByList(testListaId);
      expect(result.isSuccess).toBe(true);

      if (result.isSuccess) {
        const foundProductos = result.value.items;
        expect(foundProductos).toHaveLength(3);
        
        const nombres = foundProductos.map((p: any) => p.nombre).sort();
        expect(nombres).toEqual(['Aceite', 'Arroz', 'Pasta']);
      }
    });

    it('debería retornar array vacío si la lista no tiene productos', async () => {
      const result = await repository.findByList(testListaId);
      expect(result.isSuccess).toBe(true);
      if (result.isSuccess) {
        expect(result.value.items).toEqual([]);
      }
    });
  });

  describe('deleteById', () => {
    it('debería eliminar un producto correctamente', async () => {
      // Crear producto
      const productoData = {
        nombre: 'Producto a Eliminar',
        cantidad: 1,
        precio: 5.00,
        urgente: false,
        listaId: testListaId,
        creadoPorId: testUsuarioId,
      };

      const productoResult = Producto.create(productoData);
      expect(productoResult.isSuccess).toBe(true);

      if (productoResult.isSuccess) {
        const producto = productoResult.value;
        await repository.save(producto);

        // Verificar que existe
        const foundResult = await repository.findById(producto.id);
        expect(foundResult.isSuccess).toBe(true);
        if (foundResult.isSuccess) {
          expect(foundResult.value).not.toBeNull();
        }

        // Eliminar
        const deleteResult = await repository.deleteById(producto.id);
        expect(deleteResult.isSuccess).toBe(true);

        // Verificar que ya no existe
        const notFoundResult = await repository.findById(producto.id);
        expect(notFoundResult.isSuccess).toBe(true);
        if (notFoundResult.isSuccess) {
          expect(notFoundResult.value).toBeNull();
        }
      }
    });

    it('debería manejar correctamente la eliminación de producto inexistente', async () => {
      const result = await repository.deleteById('non-existent-id');
      // Esto debería fallar porque Prisma lanza error cuando no encuentra el registro
      expect(result.isFailure).toBe(true);
    });
  });

  describe('existsById', () => {
    it('debería verificar si un producto existe', async () => {
      // Crear producto
      const productoData = {
        nombre: 'Huevos',
        cantidad: 12,
        precio: 2.50,
        urgente: false,
        listaId: testListaId,
        creadoPorId: testUsuarioId,
      };

      const productoResult = Producto.create(productoData);
      expect(productoResult.isSuccess).toBe(true);

      if (productoResult.isSuccess) {
        const producto = productoResult.value;
        await repository.save(producto);

        // Verificar existencia
        const existsResult = await repository.existsById(producto.id);
        expect(existsResult.isSuccess).toBe(true);
        if (existsResult.isSuccess) {
          expect(existsResult.value).toBe(true);
        }

        // Verificar no existencia
        const notExistsResult = await repository.existsById('other-product-id');
        expect(notExistsResult.isSuccess).toBe(true);
        if (notExistsResult.isSuccess) {
          expect(notExistsResult.value).toBe(false);
        }
      }
    });
  });

  describe('countByList', () => {
    it('debería contar productos en una lista', async () => {
      // Crear productos
      const productos = ['Producto 1', 'Producto 2', 'Producto 3'];

      for (const nombre of productos) {
        const productoResult = Producto.create({
          nombre,
          cantidad: 1,
          precio: 1.00,
          urgente: false,
          listaId: testListaId,
          creadoPorId: testUsuarioId,
        });

        if (productoResult.isSuccess) {
          await repository.save(productoResult.value);
        }
      }

      // Contar productos
      const result = await repository.countByList(testListaId);
      expect(result.isSuccess).toBe(true);

      if (result.isSuccess) {
        expect(result.value).toBe(3);
      }
    });

    it('debería retornar 0 si la lista no tiene productos', async () => {
      const result = await repository.countByList(testListaId);
      expect(result.isSuccess).toBe(true);
      if (result.isSuccess) {
        expect(result.value).toBe(0);
      }
    });
  });

  describe('getResumenByList', () => {
    it('debería obtener resumen de productos en una lista', async () => {
      // Crear productos con diferentes estados
      const productos = [
        { nombre: 'Comprado 1', comprado: true, precio: 1.50 },
        { nombre: 'No Comprado', comprado: false, precio: 2.00 },
        { nombre: 'Comprado 2', comprado: true, precio: 3.00 },
        { nombre: 'Sin Precio', comprado: false, precio: null },
      ];

      for (const data of productos) {
        const productoResult = Producto.create({
          nombre: data.nombre,
          cantidad: 1,
          precio: data.precio,
          urgente: false,
          listaId: testListaId,
          creadoPorId: testUsuarioId,
        });

        if (productoResult.isSuccess) {
          const producto = productoResult.value;
          if (data.comprado) {
            producto.marcarComoComprado();
          }
          await repository.save(producto);
        }
      }

      // Obtener resumen
      const result = await repository.getResumenByList(testListaId);
      expect(result.isSuccess).toBe(true);

      if (result.isSuccess) {
        const resumen = result.value;
        expect(resumen.comprados).toBe(2);
        expect(resumen.pendientes).toBe(2);
        expect(resumen.valorTotal).toBe(4.50); // Solo productos comprados: 1.50 + 3.00
      }
    });
  });
});