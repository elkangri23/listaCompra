/**
 * Implementación del repositorio de productos usando Prisma
 */

import { PrismaClient } from '@prisma/client';
import type { Result } from '@shared/result';
import { success, failure } from '@shared/result';
import { Producto } from '@domain/entities/Producto';
import { 
  IProductoRepository, 
  ProductoFilters, 
  PaginationOptions, 
  PaginatedResult, 
  ProductoResumen 
} from '@application/ports/repositories/IProductoRepository';
import { ProductoMapper } from '../mappers/ProductoMapper';

export class PrismaProductoRepository implements IProductoRepository {
  constructor(private prisma: PrismaClient) {}

  async save(producto: Producto): Promise<Result<Producto, Error>> {
    try {
      const data = ProductoMapper.toPersistence(producto);
      
      const exists = await this.prisma.producto.findUnique({
        where: { id: producto.id }
      });

      const savedData = exists
        ? await this.prisma.producto.update({
            where: { id: producto.id },
            data
          })
        : await this.prisma.producto.create({
            data
          });

      const productoResult = ProductoMapper.toDomain(savedData);
      if (productoResult.isFailure) {
        return failure(new Error(`Error al mapear producto: ${productoResult.error.message}`));
      }

      return success(productoResult.value);
    } catch (error) {
      return failure(new Error(`Error al guardar producto: ${error}`));
    }
  }

  async findById(id: string): Promise<Result<Producto | null, Error>> {
    try {
      const data = await this.prisma.producto.findUnique({
        where: { id }
      });

      if (!data) {
        return success(null);
      }

      const productoResult = ProductoMapper.toDomain(data);
      if (productoResult.isFailure) {
        return failure(new Error(`Error al mapear producto: ${productoResult.error.message}`));
      }

      return success(productoResult.value);
    } catch (error) {
      return failure(new Error(`Error al buscar producto por ID: ${error}`));
    }
  }

  async findByIdAndList(id: string, listaId: string): Promise<Result<Producto | null, Error>> {
    try {
      const data = await this.prisma.producto.findFirst({
        where: { 
          id,
          listaId
        }
      });

      if (!data) {
        return success(null);
      }

      const productoResult = ProductoMapper.toDomain(data);
      if (productoResult.isFailure) {
        return failure(new Error(`Error al mapear producto: ${productoResult.error.message}`));
      }

      return success(productoResult.value);
    } catch (error) {
      return failure(new Error(`Error al buscar producto por ID y lista: ${error}`));
    }
  }

  async findByList(
    listaId: string,
    filters?: ProductoFilters,
    pagination?: PaginationOptions
  ): Promise<Result<PaginatedResult<Producto>, Error>> {
    try {
      const where: any = { listaId };

      if (filters) {
        if (filters.comprado !== undefined) {
          where.comprado = filters.comprado;
        }
        if (filters.urgente !== undefined) {
          where.urgente = filters.urgente;
        }
        if (filters.categoriaId) {
          where.categoriaId = filters.categoriaId;
        }
        if (filters.busqueda) {
          where.OR = [
            { nombre: { contains: filters.busqueda, mode: 'insensitive' } },
            { descripcion: { contains: filters.busqueda, mode: 'insensitive' } }
          ];
        }
      }

      const skip = pagination ? (pagination.page - 1) * pagination.limit : 0;
      const take = pagination?.limit;

      const [productos, total] = await Promise.all([
        this.prisma.producto.findMany({
          where,
          orderBy: { fechaCreacion: 'desc' },
          skip,
          ...(take && { take })
        }),
        this.prisma.producto.count({ where })
      ]);

      const productosResult = ProductoMapper.toDomainArray(productos);
      if (productosResult.isFailure) {
        return failure(new Error(`Error al mapear productos: ${productosResult.error.message}`));
      }

      const totalPages = pagination ? Math.ceil(total / pagination.limit) : 1;

      return success({
        items: productosResult.value,
        total,
        page: pagination?.page || 1,
        limit: pagination?.limit || total,
        totalPages
      });
    } catch (error) {
      return failure(new Error(`Error al buscar productos por lista: ${error}`));
    }
  }

  async findByNameAndList(nombre: string, listaId: string): Promise<Result<Producto[], Error>> {
    try {
      const data = await this.prisma.producto.findMany({
        where: {
          listaId,
          nombre: {
            contains: nombre,
            mode: 'insensitive'
          }
        },
        orderBy: { fechaCreacion: 'desc' }
      });

      const productosResult = ProductoMapper.toDomainArray(data);
      if (productosResult.isFailure) {
        return failure(new Error(`Error al mapear productos: ${productosResult.error.message}`));
      }

      return success(productosResult.value);
    } catch (error) {
      return failure(new Error(`Error al buscar productos por nombre: ${error}`));
    }
  }

  async deleteById(id: string): Promise<Result<void, Error>> {
    try {
      await this.prisma.producto.delete({
        where: { id }
      });
      return success(undefined);
    } catch (error) {
      return failure(new Error(`Error al eliminar producto: ${error}`));
    }
  }

  async existsById(id: string): Promise<Result<boolean, Error>> {
    try {
      const producto = await this.prisma.producto.findUnique({
        where: { id },
        select: { id: true }
      });
      return success(producto !== null);
    } catch (error) {
      return failure(new Error(`Error al verificar existencia del producto: ${error}`));
    }
  }

  async countByList(listaId: string): Promise<Result<number, Error>> {
    try {
      const count = await this.prisma.producto.count({
        where: { listaId }
      });
      return success(count);
    } catch (error) {
      return failure(new Error(`Error al contar productos de la lista: ${error}`));
    }
  }

  async getResumenByList(listaId: string): Promise<Result<ProductoResumen, Error>> {
    try {
      const [comprados, urgentes, valorTotal] = await Promise.all([
        this.prisma.producto.count({
          where: { listaId, comprado: true }
        }),
        this.prisma.producto.count({
          where: { listaId, urgente: true, comprado: false }
        }),
        this.prisma.producto.aggregate({
          where: { listaId, comprado: true },
          _sum: { precio: true }
        })
      ]);

      const total = await this.countByList(listaId);
      if (total.isFailure) {
        return failure(total.error);
      }

      const pendientes = total.value - comprados;

      return success({
        comprados,
        pendientes,
        urgentes,
        valorTotal: Number(valorTotal._sum.precio) || 0
      });
    } catch (error) {
      return failure(new Error(`Error al obtener resumen de productos: ${error}`));
    }
  }

  async markAllAsPurchased(listaId: string, comprado: boolean): Promise<Result<number, Error>> {
    try {
      const result = await this.prisma.producto.updateMany({
        where: { listaId },
        data: { 
          comprado,
          fechaCompra: comprado ? new Date() : null
        }
      });
      return success(result.count);
    } catch (error) {
      return failure(new Error(`Error al marcar productos como comprados: ${error}`));
    }
  }

  async findByCategory(categoriaId: string): Promise<Result<Producto[], Error>> {
    try {
      const data = await this.prisma.producto.findMany({
        where: { categoriaId },
        orderBy: [
          { comprado: 'asc' },
          { urgente: 'desc' },
          { fechaCreacion: 'desc' }
        ]
      });

      const productosResult = ProductoMapper.toDomainArray(data);
      if (productosResult.isFailure) {
        return failure(new Error(`Error al mapear productos: ${productosResult.error.message}`));
      }

      return success(productosResult.value);
    } catch (error) {
      return failure(new Error(`Error al buscar productos por categoría: ${error}`));
    }
  }

  async findUrgentByUser(userId: string): Promise<Result<Producto[], Error>> {
    try {
      const data = await this.prisma.producto.findMany({
        where: {
          urgente: true,
          comprado: false,
          lista: {
            OR: [
              { propietarioId: userId },
              { permisos: { some: { usuarioId: userId } } }
            ]
          }
        },
        orderBy: { fechaCreacion: 'desc' }
      });

      const productosResult = ProductoMapper.toDomainArray(data);
      if (productosResult.isFailure) {
        return failure(new Error(`Error al mapear productos: ${productosResult.error.message}`));
      }

      return success(productosResult.value);
    } catch (error) {
      return failure(new Error(`Error al buscar productos urgentes del usuario: ${error}`));
    }
  }

  async deleteAllByList(listaId: string): Promise<Result<number, Error>> {
    try {
      const result = await this.prisma.producto.deleteMany({
        where: { listaId }
      });
      return success(result.count);
    } catch (error) {
      return failure(new Error(`Error al eliminar productos de la lista: ${error}`));
    }
  }
}