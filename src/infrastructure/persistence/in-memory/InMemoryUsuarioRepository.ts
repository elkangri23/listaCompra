import type { IUsuarioRepository } from '@application/ports/repositories/IUsuarioRepository';
import type { Usuario } from '@domain/entities/Usuario';
import type { Email } from '@domain/value-objects/Email';
import type { Result } from '@shared/result';
import { success, failure } from '@shared/result';
import type { UUID, PaginationParams, PaginationResult } from '@shared/types';

export class InMemoryUsuarioRepository implements IUsuarioRepository {
  private readonly usuarios = new Map<UUID, Usuario>();

  async save(usuario: Usuario): Promise<Result<Usuario, Error>> {
    this.usuarios.set(usuario.id, usuario);
    return success(usuario);
  }

  async update(usuario: Usuario): Promise<Result<Usuario, Error>> {
    if (!this.usuarios.has(usuario.id)) {
      return failure(new Error('Usuario no encontrado'));
    }
    this.usuarios.set(usuario.id, usuario);
    return success(usuario);
  }

  async findById(id: UUID): Promise<Result<Usuario | null, Error>> {
    return success(this.usuarios.get(id) ?? null);
  }

  async findByEmail(email: Email): Promise<Result<Usuario | null, Error>> {
    for (const usuario of this.usuarios.values()) {
      if (usuario.email.equals(email)) {
        return success(usuario);
      }
    }
    return success(null);
  }

  async existsByEmail(email: Email): Promise<Result<boolean, Error>> {
    const exists = Array.from(this.usuarios.values()).some(usuario => usuario.email.equals(email));
    return success(exists);
  }

  async findAll(params: PaginationParams): Promise<Result<PaginationResult<Usuario>, Error>> {
    const data = Array.from(this.usuarios.values());
    const start = (params.page - 1) * params.limit;
    const items = data.slice(start, start + params.limit);
    const result: PaginationResult<Usuario> = {
      data: items,
      total: data.length,
      page: params.page,
      limit: params.limit,
      totalPages: Math.max(1, Math.ceil(data.length / params.limit)),
      hasNext: start + params.limit < data.length,
      hasPrevious: params.page > 1,
    };
    return success(result);
  }

  async findActive(params: PaginationParams): Promise<Result<PaginationResult<Usuario>, Error>> {
    const activos = Array.from(this.usuarios.values()).filter(usuario => usuario.activo);
    const start = (params.page - 1) * params.limit;
    const items = activos.slice(start, start + params.limit);
    const result: PaginationResult<Usuario> = {
      data: items,
      total: activos.length,
      page: params.page,
      limit: params.limit,
      totalPages: Math.max(1, Math.ceil(activos.length / params.limit)),
      hasNext: start + params.limit < activos.length,
      hasPrevious: params.page > 1,
    };
    return success(result);
  }

  async findByRole(role: string, params: PaginationParams): Promise<Result<PaginationResult<Usuario>, Error>> {
    const filtered = Array.from(this.usuarios.values()).filter(usuario => usuario.rol === role);
    const start = (params.page - 1) * params.limit;
    const items = filtered.slice(start, start + params.limit);
    const result: PaginationResult<Usuario> = {
      data: items,
      total: filtered.length,
      page: params.page,
      limit: params.limit,
      totalPages: Math.max(1, Math.ceil(filtered.length / params.limit)),
      hasNext: start + params.limit < filtered.length,
      hasPrevious: params.page > 1,
    };
    return success(result);
  }

  async deleteById(id: UUID): Promise<Result<boolean, Error>> {
    const existed = this.usuarios.delete(id);
    return success(existed);
  }

  async delete(id: UUID): Promise<Result<void, Error>> {
    const usuario = this.usuarios.get(id);
    if (usuario) {
      const result = usuario.desactivar();
      if (result.isFailure) {
        return failure(result.error);
      }
      this.usuarios.set(id, usuario);
    }
    return success(undefined);
  }

  async hardDelete(id: UUID): Promise<Result<void, Error>> {
    this.usuarios.delete(id);
    return success(undefined);
  }

  async count(): Promise<Result<number, Error>> {
    return success(this.usuarios.size);
  }

  async countActive(): Promise<Result<number, Error>> {
    const activos = Array.from(this.usuarios.values()).filter(usuario => usuario.activo).length;
    return success(activos);
  }

  async search(term: string, params: PaginationParams): Promise<Result<PaginationResult<Usuario>, Error>> {
    const normalized = term.toLowerCase();
    const items = Array.from(this.usuarios.values()).filter(usuario =>
      usuario.email.value.includes(normalized) ||
      usuario.nombre.toLowerCase().includes(normalized) ||
      (usuario.apellidos?.toLowerCase().includes(normalized) ?? false)
    );

    const start = (params.page - 1) * params.limit;
    const sliced = items.slice(start, start + params.limit);

    const result: PaginationResult<Usuario> = {
      data: sliced,
      total: items.length,
      page: params.page,
      limit: params.limit,
      totalPages: Math.max(1, Math.ceil(items.length / params.limit)),
      hasNext: start + params.limit < items.length,
      hasPrevious: params.page > 1,
    };

    return success(result);
  }
}
