import type {
  IListaRepository,
  ListaFilters,
  PaginationOptions,
  PaginatedResult,
  ListaSortOption
} from '@application/ports/repositories/IListaRepository';
import { Lista } from '@domain/entities/Lista';
import type { Result } from '@shared/result';
import { success, failure } from '@shared/result';

export class InMemoryListaRepository implements IListaRepository {
  private readonly listas = new Map<string, Lista>();

  async save(lista: Lista): Promise<Result<Lista, Error>> {
    this.listas.set(lista.id, lista);
    return success(lista);
  }

  async findById(id: string): Promise<Result<Lista | null, Error>> {
    return success(this.listas.get(id) ?? null);
  }

  async findByIdAndOwner(id: string, propietarioId: string): Promise<Result<Lista | null, Error>> {
    const lista = this.listas.get(id);
    if (!lista || lista.propietarioId !== propietarioId) {
      return success(null);
    }
    return success(lista);
  }

  async findByOwner(
    propietarioId: string,
    filters?: ListaFilters,
    pagination: PaginationOptions = { page: 1, limit: 10 },
    sort?: ListaSortOption[]
  ): Promise<Result<PaginatedResult<Lista>, Error>> {
    let items = Array.from(this.listas.values()).filter(lista => lista.propietarioId === propietarioId);

    if (filters?.activa !== undefined) {
      items = items.filter(lista => lista.activa === filters.activa);
    }

    if (filters?.tiendaId) {
      items = items.filter(lista => lista.tiendaId === filters.tiendaId);
    }

    if (filters?.busqueda) {
      const termino = filters.busqueda.toLowerCase();
      items = items.filter(lista => {
        const nombre = lista.nombre.toLowerCase();
        const descripcion = lista.descripcion?.toLowerCase() ?? '';
        return nombre.includes(termino) || descripcion.includes(termino);
      });
    }

    if (filters?.fechaCreacionDesde) {
      items = items.filter(lista => lista.fechaCreacion >= filters.fechaCreacionDesde!);
    }

    if (filters?.fechaCreacionHasta) {
      items = items.filter(lista => lista.fechaCreacion <= filters.fechaCreacionHasta!);
    }

    if (filters?.fechaActualizacionDesde) {
      items = items.filter(lista => lista.fechaActualizacion >= filters.fechaActualizacionDesde!);
    }

    if (filters?.fechaActualizacionHasta) {
      items = items.filter(lista => lista.fechaActualizacion <= filters.fechaActualizacionHasta!);
    }

    const sortCriteria = (sort && sort.length > 0)
      ? sort
      : [{ field: 'fechaActualizacion', direction: 'desc' as const }];

    items = [...items].sort((a, b) => {
      for (const criterio of sortCriteria) {
        let comparison = 0;

        switch (criterio.field) {
          case 'nombre': {
            const nombreA = a.nombre.toLowerCase();
            const nombreB = b.nombre.toLowerCase();
            if (nombreA < nombreB) comparison = -1;
            else if (nombreA > nombreB) comparison = 1;
            break;
          }
          case 'fechaCreacion': {
            const diff = a.fechaCreacion.getTime() - b.fechaCreacion.getTime();
            comparison = diff === 0 ? 0 : diff > 0 ? 1 : -1;
            break;
          }
          case 'fechaActualizacion': {
            const diff = a.fechaActualizacion.getTime() - b.fechaActualizacion.getTime();
            comparison = diff === 0 ? 0 : diff > 0 ? 1 : -1;
            break;
          }
          case 'activa': {
            comparison = Number(a.activa) - Number(b.activa);
            break;
          }
          default:
            comparison = 0;
            break;
        }

        if (comparison !== 0) {
          return criterio.direction === 'asc' ? comparison : -comparison;
        }
      }

      return 0;
    });

    const page = pagination.page ?? 1;
    const limit = pagination.limit ?? 10;
    const total = items.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const start = (page - 1) * limit;
    const paginatedItems = items.slice(start, start + limit);

    const result: PaginatedResult<Lista> = {
      items: paginatedItems,
      total,
      page,
      limit,
      totalPages,
    };

    return success(result);
  }

  async findByNameAndOwner(nombre: string, propietarioId: string): Promise<Result<Lista | null, Error>> {
    const lista = Array.from(this.listas.values()).find(
      item => item.propietarioId === propietarioId && item.nombre.toLowerCase() === nombre.toLowerCase()
    );
    return success(lista ?? null);
  }

  async deleteById(id: string): Promise<Result<void, Error>> {
    const lista = this.listas.get(id);
    if (!lista) {
      return failure(new Error('Lista no encontrada'));
    }
    lista.desactivar();
    this.listas.set(id, lista);
    return success(undefined);
  }

  async hardDelete(id: string): Promise<Result<boolean, Error>> {
    const deleted = this.listas.delete(id);
    return success(deleted);
  }

  async existsById(id: string): Promise<Result<boolean, Error>> {
    return success(this.listas.has(id));
  }

  async existsByNameAndOwner(nombre: string, propietarioId: string): Promise<Result<boolean, Error>> {
    const exists = Array.from(this.listas.values()).some(
      item => item.propietarioId === propietarioId && item.nombre.toLowerCase() === nombre.toLowerCase()
    );
    return success(exists);
  }

  async countByOwner(propietarioId: string): Promise<Result<number, Error>> {
    const count = Array.from(this.listas.values()).filter(item => item.propietarioId === propietarioId).length;
    return success(count);
  }

  async updateActiveStatus(id: string, activa: boolean): Promise<Result<void, Error>> {
    const lista = this.listas.get(id);
    if (!lista) {
      return failure(new Error('Lista no encontrada'));
    }
    if (activa) {
      lista.activar();
    } else {
      lista.desactivar();
    }
    this.listas.set(id, lista);
    return success(undefined);
  }
}
