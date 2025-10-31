import type { ICategoriaRepository } from '@application/ports/repositories/ICategoriaRepository';
import type { Categoria } from '@domain/entities/Categoria';
import type { Result } from '@shared/result';
import { success } from '@shared/result';
import { InvalidValueError, BusinessRuleViolationError } from '@domain/errors/DomainError';

export class InMemoryCategoriaRepository implements ICategoriaRepository {
  private readonly categorias = new Map<string, Categoria>();

  async save(categoria: Categoria): Promise<Result<Categoria, InvalidValueError | BusinessRuleViolationError>> {
    this.categorias.set(categoria.id, categoria);
    return success(categoria);
  }

  async update(categoria: Categoria): Promise<Result<Categoria, InvalidValueError | BusinessRuleViolationError>> {
    this.categorias.set(categoria.id, categoria);
    return success(categoria);
  }

  async findById(id: string): Promise<Result<Categoria | null, InvalidValueError>> {
    return success(this.categorias.get(id) ?? null);
  }

  async findByTienda(tiendaId: string | null, includeInactive = false): Promise<Result<Categoria[], InvalidValueError>> {
    const categorias = Array.from(this.categorias.values()).filter(categoria => {
      if (!includeInactive && !categoria.activa) {
        return false;
      }
      return categoria.tiendaId === tiendaId;
    });
    return success(categorias);
  }

  async findAll(includeInactive = false): Promise<Result<Categoria[], InvalidValueError>> {
    const categorias = Array.from(this.categorias.values()).filter(categoria =>
      includeInactive ? true : categoria.activa
    );
    return success(categorias);
  }

  async findByNombre(nombre: string, tiendaId?: string | null): Promise<Result<Categoria[], InvalidValueError>> {
    const categorias = Array.from(this.categorias.values()).filter(categoria => {
      if (tiendaId !== undefined && categoria.tiendaId !== tiendaId) {
        return false;
      }
      return categoria.nombre.toLowerCase() === nombre.toLowerCase();
    });
    return success(categorias);
  }

  async findByColor(color: string, tiendaId?: string | null): Promise<Result<Categoria[], InvalidValueError>> {
    const categorias = Array.from(this.categorias.values()).filter(categoria => {
      if (tiendaId !== undefined && categoria.tiendaId !== tiendaId) {
        return false;
      }
      return categoria.color === color;
    });
    return success(categorias);
  }

  async existsByNombreAndTienda(nombre: string, tiendaId: string | null, excludeId?: string): Promise<Result<boolean, InvalidValueError>> {
    const exists = Array.from(this.categorias.values()).some(categoria => {
      if (excludeId && categoria.id === excludeId) {
        return false;
      }
      return categoria.nombre.toLowerCase() === nombre.toLowerCase() && categoria.tiendaId === tiendaId;
    });
    return success(exists);
  }

  async delete(id: string): Promise<Result<boolean, InvalidValueError | BusinessRuleViolationError>> {
    const existed = this.categorias.delete(id);
    return success(existed);
  }

  async countByTienda(tiendaId: string | null): Promise<Result<number, InvalidValueError>> {
    const count = Array.from(this.categorias.values()).filter(categoria => categoria.tiendaId === tiendaId).length;
    return success(count);
  }

  async search(): Promise<Result<{ categorias: Categoria[]; total: number }, InvalidValueError>> {
    const categorias = Array.from(this.categorias.values());
    return success({ categorias, total: categorias.length });
  }

  async getMostUsed(): Promise<Result<Categoria[], InvalidValueError>> {
    return success([]);
  }

  async moveToTienda(categoriaId: string, _newTiendaId: string | null): Promise<Result<Categoria, InvalidValueError | BusinessRuleViolationError>> {
    return success(this.categorias.get(categoriaId) as Categoria);
  }

  async deactivateByTienda(tiendaId: string): Promise<Result<number, InvalidValueError>> {
    const count = Array.from(this.categorias.values()).filter(categoria => categoria.tiendaId === tiendaId && categoria.activa).length;
    return success(count);
  }

  async getStats(): Promise<Result<{ total: number; activas: number; inactivas: number; porColor: Record<string, number> }, InvalidValueError>> {
    const categorias = Array.from(this.categorias.values());
    const total = categorias.length;
    const activas = categorias.filter(categoria => categoria.activa).length;
    const inactivas = total - activas;
    const porColor: Record<string, number> = {};
    categorias.forEach(categoria => {
      const key = categoria.color ?? 'SIN_COLOR';
      porColor[key] = (porColor[key] ?? 0) + 1;
    });

    return success({
      total,
      activas,
      inactivas,
      porColor,
    });
  }
}
