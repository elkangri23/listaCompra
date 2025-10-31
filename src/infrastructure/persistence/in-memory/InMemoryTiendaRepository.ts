import type { ITiendaRepository } from '@application/ports/repositories/ITiendaRepository';
import type { Tienda } from '@domain/entities/Tienda';
import type { Categoria } from '@domain/entities/Categoria';
import type { Result } from '@shared/result';
import { success } from '@shared/result';
import { InvalidValueError, BusinessRuleViolationError } from '@domain/errors/DomainError';

export class InMemoryTiendaRepository implements ITiendaRepository {
  private readonly tiendas = new Map<string, Tienda>();

  async save(tienda: Tienda): Promise<Result<Tienda, InvalidValueError | BusinessRuleViolationError>> {
    this.tiendas.set(tienda.id, tienda);
    return success(tienda);
  }

  async update(tienda: Tienda): Promise<Result<Tienda, InvalidValueError | BusinessRuleViolationError>> {
    this.tiendas.set(tienda.id, tienda);
    return success(tienda);
  }

  async findById(id: string): Promise<Result<Tienda | null, InvalidValueError>> {
    return success(this.tiendas.get(id) ?? null);
  }

  async findByNombre(nombre: string): Promise<Result<Tienda | null, InvalidValueError>> {
    const tienda = Array.from(this.tiendas.values()).find(item => item.nombre.toLowerCase() === nombre.toLowerCase()) ?? null;
    return success(tienda);
  }

  async findAll(includeInactive = false): Promise<Result<Tienda[], InvalidValueError>> {
    const tiendas = Array.from(this.tiendas.values()).filter(tienda => includeInactive ? true : tienda.activa);
    return success(tiendas);
  }

  async existsByNombre(nombre: string, excludeId?: string): Promise<Result<boolean, InvalidValueError>> {
    const exists = Array.from(this.tiendas.values()).some(tienda => {
      if (excludeId && tienda.id === excludeId) {
        return false;
      }
      return tienda.nombre.toLowerCase() === nombre.toLowerCase();
    });
    return success(exists);
  }

  async delete(id: string): Promise<Result<boolean, InvalidValueError | BusinessRuleViolationError>> {
    const existed = this.tiendas.delete(id);
    return success(existed);
  }

  async search(): Promise<Result<{ tiendas: Tienda[]; total: number }, InvalidValueError>> {
    const tiendas = Array.from(this.tiendas.values());
    return success({ tiendas, total: tiendas.length });
  }

  async findByIdWithCategories(id: string): Promise<Result<{ tienda: Tienda; categorias: Categoria[] } | null, InvalidValueError>> {
    const tienda = this.tiendas.get(id);
    return success(tienda ? { tienda, categorias: [] } : null);
  }

  async findAllWithCategories(): Promise<Result<Array<{ tienda: Tienda; categorias: Categoria[] }>, InvalidValueError>> {
    const data = Array.from(this.tiendas.values()).map(tienda => ({ tienda, categorias: [] }));
    return success(data);
  }

  async countCategorias(): Promise<Result<number, InvalidValueError>> {
    return success(0);
  }

  async hasCategories(): Promise<Result<boolean, InvalidValueError>> {
    return success(false);
  }

  async getStats(): Promise<Result<{ totalCategorias: number; categoriasActivas: number; categoriasInactivas: number; fechaUltimaCategoria?: Date }, InvalidValueError>> {
    return success({
      totalCategorias: 0,
      categoriasActivas: 0,
      categoriasInactivas: 0,
    });
  }

  async getAllStats(): Promise<Result<Array<{ tienda: Tienda; totalCategorias: number; categoriasActivas: number; categoriasInactivas: number; fechaUltimaCategoria?: Date }>, InvalidValueError>> {
    const data = Array.from(this.tiendas.values()).map(tienda => ({
      tienda,
      totalCategorias: 0,
      categoriasActivas: 0,
      categoriasInactivas: 0,
    }));
    return success(data);
  }

  async getMostUsed(): Promise<Result<Array<{ tienda: Tienda; totalCategorias: number }>, InvalidValueError>> {
    return success([]);
  }

  async deactivateWithCategories(tiendaId: string): Promise<Result<{ tienda: Tienda; categoriasDesactivadas: number }, InvalidValueError | BusinessRuleViolationError>> {
    const tienda = this.tiendas.get(tiendaId);
    if (!tienda) {
      return success(null as unknown as { tienda: Tienda; categoriasDesactivadas: number });
    }
    return success({ tienda, categoriasDesactivadas: 0 });
  }

  async activate(tiendaId: string): Promise<Result<Tienda, InvalidValueError | BusinessRuleViolationError>> {
    const tienda = this.tiendas.get(tiendaId);
    return success(tienda as Tienda);
  }
}
