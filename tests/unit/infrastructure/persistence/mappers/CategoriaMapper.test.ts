import { describe, test, expect } from '@jest/globals';
import { CategoriaMapper } from '../../../../../src/infrastructure/persistence/mappers/CategoriaMapper';
import { Categoria } from '../../../../../src/domain/entities/Categoria';

describe('CategoriaMapper', () => {
  describe('toDomain', () => {
    test('should convert Prisma model to domain entity', () => {
      // Arrange
      const prismaCategoria = {
        id: 'categoria-123',
        nombre: 'Frutas',
        descripcion: 'Categoría para frutas frescas',
        color: '#FF0000',
        icono: 'fruit-icon',
        activa: true,
        tiendaId: 'tienda-456',
        fechaCreacion: new Date('2024-01-01'),
        fechaActualizacion: new Date('2024-01-02')
      };

      // Act
      const domainCategoria = CategoriaMapper.toDomain(prismaCategoria);

      // Assert
      expect(domainCategoria).toBeInstanceOf(Categoria);
      expect(domainCategoria.id).toBe('categoria-123');
      expect(domainCategoria.nombre).toBe('Frutas');
      expect(domainCategoria.descripcion).toBe('Categoría para frutas frescas');
      expect(domainCategoria.color).toBe('#FF0000');
      expect(domainCategoria.icono).toBe('fruit-icon');
      expect(domainCategoria.activa).toBe(true);
      expect(domainCategoria.tiendaId).toBe('tienda-456');
      expect(domainCategoria.fechaCreacion).toEqual(new Date('2024-01-01'));
      expect(domainCategoria.fechaActualizacion).toEqual(new Date('2024-01-02'));
    });

    test('should handle null optional fields', () => {
      // Arrange
      const prismaCategoria = {
        id: 'categoria-123',
        nombre: 'Frutas',
        descripcion: null,
        color: null,
        icono: null,
        activa: true,
        tiendaId: null,
        fechaCreacion: new Date('2024-01-01'),
        fechaActualizacion: new Date('2024-01-02')
      };

      // Act
      const domainCategoria = CategoriaMapper.toDomain(prismaCategoria);

      // Assert
      expect(domainCategoria.descripcion).toBeNull();
      expect(domainCategoria.color).toBeNull();
      expect(domainCategoria.icono).toBeNull();
      expect(domainCategoria.tiendaId).toBeNull();
    });
  });

  describe('toPrismaCreate', () => {
    test('should convert domain entity to Prisma create data', () => {
      // Arrange
      const categoriaResult = Categoria.create({
        nombre: 'Frutas',
        descripcion: 'Categoría para frutas',
        color: '#FF0000'
      });
      expect(categoriaResult.isSuccess).toBe(true);
      if (!categoriaResult.isSuccess) return;
      
      const categoria = categoriaResult.value;

      // Act
      const createData = CategoriaMapper.toPrismaCreate(categoria);

      // Assert
      expect(createData.nombre).toBe('Frutas');
      expect(createData.descripcion).toBe('Categoría para frutas');
      expect(createData.color).toBe('#FF0000');
      expect(createData.activa).toBe(true);
      expect(createData.tiendaId).toBeNull();
    });
  });

  describe('toPrismaUpdate', () => {
    test('should convert domain entity to Prisma update data', () => {
      // Arrange
      const categoriaResult = Categoria.create({
        nombre: 'Frutas Originales'
      });
      expect(categoriaResult.isSuccess).toBe(true);
      if (!categoriaResult.isSuccess) return;
      
      const categoria = categoriaResult.value;
      categoria.updateNombre('Frutas Actualizadas');

      // Act
      const updateData = CategoriaMapper.toPrismaUpdate(categoria);

      // Assert
      expect(updateData.nombre).toBe('Frutas Actualizadas');
      expect(updateData.fechaActualizacion).toEqual(categoria.fechaActualizacion);
    });
  });
});