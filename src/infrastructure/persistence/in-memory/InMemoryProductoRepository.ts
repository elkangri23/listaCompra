import type { IProductoRepository, ProductoFilters, PaginationOptions, PaginatedResult, ProductoResumen } from '@application/ports/repositories/IProductoRepository';
import { Producto } from '@domain/entities/Producto';
import type { Result } from '@shared/result';
import { success, failure } from '@shared/result';

export class InMemoryProductoRepository implements IProductoRepository {
  private readonly productos = new Map<string, Producto>();

  async save(producto: Producto): Promise<Result<Producto, Error>> {
    this.productos.set(producto.id, producto);
    return success(producto);
  }

  async findById(id: string): Promise<Result<Producto | null, Error>> {
    return success(this.productos.get(id) ?? null);
  }

  async findByIdAndList(id: string, listaId: string): Promise<Result<Producto | null, Error>> {
    const producto = this.productos.get(id);
    if (!producto || producto.listaId !== listaId) {
      return success(null);
    }
    return success(producto);
  }

  async findByList(
    listaId: string,
    filters?: ProductoFilters,
    pagination?: PaginationOptions
  ): Promise<Result<PaginatedResult<Producto>, Error>> {
    let items = Array.from(this.productos.values()).filter(producto => producto.listaId === listaId);

    if (filters?.comprado !== undefined) {
      items = items.filter(producto => producto.comprado === filters.comprado);
    }

    if (filters?.categoriaId) {
      items = items.filter(producto => producto.categoriaId === filters.categoriaId);
    }

    if (filters?.urgente !== undefined) {
      items = items.filter(producto => producto.urgente === filters.urgente);
    }

    if (filters?.busqueda) {
      const term = filters.busqueda.toLowerCase();
      items = items.filter(producto =>
        producto.nombre.toLowerCase().includes(term) ||
        (producto.descripcion ?? '').toLowerCase().includes(term)
      );
    }

    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? (items.length || 1);
    const total = items.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const start = (page - 1) * limit;
    const paginatedItems = items.slice(start, start + limit);

    return success({
      items: paginatedItems,
      total,
      page,
      limit,
      totalPages,
    });
  }

  async findByNameAndList(nombre: string, listaId: string): Promise<Result<Producto[], Error>> {
    const items = Array.from(this.productos.values()).filter(
      producto =>
        producto.listaId === listaId &&
        producto.nombre.toLowerCase().includes(nombre.toLowerCase())
    );
    return success(items);
  }

  async deleteById(id: string): Promise<Result<void, Error>> {
    const deleted = this.productos.delete(id);
    if (!deleted) {
      return failure(new Error('Producto no encontrado'));
    }
    return success(undefined);
  }

  async existsById(id: string): Promise<Result<boolean, Error>> {
    return success(this.productos.has(id));
  }

  async countByList(listaId: string): Promise<Result<number, Error>> {
    const count = Array.from(this.productos.values()).filter(producto => producto.listaId === listaId).length;
    return success(count);
  }

  async getResumenByList(listaId: string): Promise<Result<ProductoResumen, Error>> {
    const productos = Array.from(this.productos.values()).filter(producto => producto.listaId === listaId);
    const total = productos.length;
    const comprados = productos.filter(producto => producto.comprado).length;
    const resultado: ProductoResumen = {
      comprados,
      pendientes: total - comprados,
      urgentes: productos.filter(producto => producto.urgente).length,
      valorTotal: productos.reduce((acc, producto) => acc + (producto.precio ?? 0), 0),
    };
    return success(resultado);
  }

  async markAllAsPurchased(listaId: string, comprado: boolean): Promise<Result<number, Error>> {
    let updated = 0;
    for (const producto of this.productos.values()) {
      if (producto.listaId === listaId) {
        if (comprado && !producto.comprado) {
          producto.marcarComoComprado();
          updated += 1;
        }
        if (!comprado && producto.comprado) {
          producto.marcarComoNoComprado();
          updated += 1;
        }
      }
    }
    return success(updated);
  }

  async deleteAllByList(listaId: string): Promise<Result<number, Error>> {
    let deleted = 0;
    for (const [id, producto] of Array.from(this.productos.entries())) {
      if (producto.listaId === listaId) {
        this.productos.delete(id);
        deleted += 1;
      }
    }
    return success(deleted);
  }

  async findByCategory(categoriaId: string): Promise<Result<Producto[], Error>> {
    const items = Array.from(this.productos.values()).filter(producto => producto.categoriaId === categoriaId);
    return success(items);
  }

  async findUrgentByUser(userId: string): Promise<Result<Producto[], Error>> {
    const items = Array.from(this.productos.values()).filter(producto => producto.urgente && producto.creadoPorId === userId);
    return success(items);
  }

  async findTopPurchasedByUser(): Promise<Result<Producto[], Error>> {
    return success([]);
  }

  async findRecentByUser(): Promise<Result<Producto[], Error>> {
    return success([]);
  }
}
