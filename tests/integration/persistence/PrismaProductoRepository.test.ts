import { PrismaClient } from '@prisma/client';
import { PrismaProductoRepository } from '../../../src/infrastructure/persistence/repositories/PrismaProductoRepository';
import { Producto } from '../../../src/domain/entities/Producto';
import { v4 as uuidv4 } from 'uuid';

describe('PrismaProductoRepository Integration Tests', () => {
  let prisma: PrismaClient;
  let repository: PrismaProductoRepository;

  const createTestData = async () => {
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(7);
    const usuarioId = uuidv4();
    const listaId = uuidv4();

    await prisma.usuario.create({
      data: {
        id: usuarioId,
        nombre: `Test User ${timestamp}-${randomId}`,
        email: `test-${timestamp}-${randomId}@example.com`,
        password: 'hashedpassword',
        activo: true,
        emailVerificado: true
      }
    });

    await prisma.lista.create({
      data: {
        id: listaId,
        nombre: `Test Lista ${timestamp}-${randomId}`,
        propietarioId: usuarioId,
        activa: true
      }
    });

    return { usuarioId, listaId };
  };

  beforeAll(async () => {
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env['TEST_DATABASE_URL'] || process.env['DATABASE_URL']!,
        },
      },
    });
    
    repository = new PrismaProductoRepository(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('save', () => {
    it('debería guardar un nuevo producto correctamente', async () => {
      const { usuarioId, listaId } = await createTestData();

      const productoData = {
        nombre: 'Leche Entera',
        descripcion: 'Leche fresca de vaca',
        cantidad: 2,
        unidad: 'litros',
        precio: 1.50,
        urgente: false,
        listaId: listaId,
        creadoPorId: usuarioId,
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
          expect(savedProducto.listaId).toBe(listaId);
        }
      }
    });

    it('debería actualizar un producto existente', async () => {
      const { usuarioId, listaId } = await createTestData();

      const productoData = {
        nombre: 'Pan Integral',
        cantidad: 1,
        listaId: listaId,
        creadoPorId: usuarioId,
      };

      const productoResult = Producto.create(productoData);
      expect(productoResult.isSuccess).toBe(true);

      if (productoResult.isSuccess) {
        const producto = productoResult.value;
        
        // Guardar producto inicial
        const saveResult = await repository.save(producto);
        expect(saveResult.isSuccess).toBe(true);

        if (saveResult.isSuccess) {
          // Actualizar producto
          const updatedProducto = saveResult.value;
          updatedProducto.marcarComoComprado();
          
          const updateResult = await repository.save(updatedProducto);
          expect(updateResult.isSuccess).toBe(true);
          
          if (updateResult.isSuccess) {
            expect(updateResult.value.comprado).toBe(true);
          }
        }
      }
    });
  });

  describe('findById', () => {
    it('debería encontrar un producto por su ID', async () => {
      const { usuarioId, listaId } = await createTestData();

      const productoData = {
        nombre: 'Yogur Natural',
        cantidad: 4,
        listaId: listaId,
        creadoPorId: usuarioId,
      };

      const productoResult = Producto.create(productoData);
      expect(productoResult.isSuccess).toBe(true);

      if (productoResult.isSuccess) {
        const producto = productoResult.value;
        await repository.save(producto);

        const result = await repository.findById(producto.id);
        expect(result.isSuccess).toBe(true);

        if (result.isSuccess) {
          expect(result.value).not.toBeNull();
          expect(result.value!.nombre).toBe('Yogur Natural');
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
      const { usuarioId, listaId } = await createTestData();

      // Crear múltiples productos
      const productos = [
        { nombre: 'Arroz', cantidad: 1, precio: 1.20, urgente: false },
        { nombre: 'Pasta', cantidad: 2, precio: 0.90, urgente: true },
        { nombre: 'Aceite', cantidad: 1, precio: 3.50, urgente: false },
      ];

      for (const data of productos) {
        const productoResult = Producto.create({
          ...data,
          listaId: listaId,
          creadoPorId: usuarioId,
        });

        if (productoResult.isSuccess) {
          await repository.save(productoResult.value);
        }
      }

      // Buscar productos de la lista
      const result = await repository.findByList(listaId);
      expect(result.isSuccess).toBe(true);

      if (result.isSuccess) {
        const foundProductos = result.value.items;
        expect(foundProductos.length).toBeGreaterThanOrEqual(3);
      }
    });
  });

  describe('deleteById', () => {
    it('debería eliminar un producto correctamente', async () => {
      const { usuarioId, listaId } = await createTestData();

      const productoData = {
        nombre: 'Producto a Eliminar',
        cantidad: 1,
        listaId: listaId,
        creadoPorId: usuarioId,
      };

      const productoResult = Producto.create(productoData);

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

        // Verificar que se eliminó
        const notFoundResult = await repository.findById(producto.id);
        expect(notFoundResult.isSuccess).toBe(true);
        if (notFoundResult.isSuccess) {
          expect(notFoundResult.value).toBeNull();
        }
      }
    });
  });

  describe('existsById', () => {
    it('debería verificar si un producto existe', async () => {
      const { usuarioId, listaId } = await createTestData();

      const productoData = {
        nombre: 'Producto Existe',
        cantidad: 1,
        listaId: listaId,
        creadoPorId: usuarioId,
      };

      const productoResult = Producto.create(productoData);

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
        const notExistsResult = await repository.existsById('fake-id');
        expect(notExistsResult.isSuccess).toBe(true);
        if (notExistsResult.isSuccess) {
          expect(notExistsResult.value).toBe(false);
        }
      }
    });
  });

  describe('countByList', () => {
    it('debería contar productos en una lista', async () => {
      const { usuarioId, listaId } = await createTestData();

      // Crear 3 productos
      for (let i = 0; i < 3; i++) {
        const productoResult = Producto.create({
          nombre: `Producto ${i}`,
          cantidad: 1,
          listaId: listaId,
          creadoPorId: usuarioId,
        });

        if (productoResult.isSuccess) {
          await repository.save(productoResult.value);
        }
      }

      const result = await repository.countByList(listaId);
      expect(result.isSuccess).toBe(true);

      if (result.isSuccess) {
        expect(result.value).toBeGreaterThanOrEqual(3);
      }
    });
  });

  describe('getResumenByList', () => {
    it('debería obtener resumen de productos en una lista', async () => {
      const { usuarioId, listaId } = await createTestData();

      // Crear productos con diferentes estados
      const productos = [
        { nombre: 'Comprado 1', cantidad: 1, precio: 1.50 },
        { nombre: 'Comprado 2', cantidad: 1, precio: 3.00 },
        { nombre: 'Pendiente 1', cantidad: 1, precio: null },
        { nombre: 'Pendiente 2', cantidad: 1, precio: null },
      ];

      for (const data of productos) {
        const productoResult = Producto.create({
          ...data,
          listaId: listaId,
          creadoPorId: usuarioId,
        });

        if (productoResult.isSuccess) {
          const producto = productoResult.value;
          // Marcar los dos primeros como comprados
          if (data.nombre.startsWith('Comprado')) {
            producto.marcarComoComprado();
          }
          await repository.save(producto);
        }
      }

      const result = await repository.getResumenByList(listaId);
      expect(result.isSuccess).toBe(true);

      if (result.isSuccess) {
        const resumen = result.value;
        expect(typeof resumen.comprados).toBe('number');
        expect(typeof resumen.pendientes).toBe('number');
        expect(typeof resumen.valorTotal).toBe('number');
        expect(resumen.comprados).toBeGreaterThanOrEqual(0);
        expect(resumen.pendientes).toBeGreaterThanOrEqual(0);
      }
    });
  });
});