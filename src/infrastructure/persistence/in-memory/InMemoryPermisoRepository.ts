import type { IPermisoRepository } from '@application/ports/repositories/IPermisoRepository';
import type { Permiso } from '@domain/entities/Permiso';

export class InMemoryPermisoRepository implements IPermisoRepository {
  private readonly permisos = new Map<string, Permiso>();

  async save(permiso: Permiso): Promise<void> {
    this.permisos.set(permiso.id, permiso);
  }

  async findById(id: string): Promise<Permiso | null> {
    return this.permisos.get(id) ?? null;
  }

  async findByUsuarioId(usuarioId: string): Promise<Permiso[]> {
    return Array.from(this.permisos.values()).filter(permiso => permiso.usuarioId === usuarioId);
  }

  async findByListaId(listaId: string): Promise<Permiso[]> {
    return Array.from(this.permisos.values()).filter(permiso => permiso.listaId === listaId);
  }

  async findByUsuarioAndLista(usuarioId: string, listaId: string): Promise<Permiso[]> {
    return Array.from(this.permisos.values()).filter(
      permiso => permiso.usuarioId === usuarioId && permiso.listaId === listaId
    );
  }

  async findUniqueByUsuarioAndLista(usuarioId: string, listaId: string): Promise<Permiso | null> {
    return (
      Array.from(this.permisos.values()).find(
        permiso => permiso.usuarioId === usuarioId && permiso.listaId === listaId
      ) ?? null
    );
  }

  async update(permiso: Permiso): Promise<void> {
    this.permisos.set(permiso.id, permiso);
  }

  async delete(id: string): Promise<void> {
    this.permisos.delete(id);
  }

  async deleteByUsuarioAndLista(usuarioId: string, listaId: string): Promise<void> {
    for (const [id, permiso] of Array.from(this.permisos.entries())) {
      if (permiso.usuarioId === usuarioId && permiso.listaId === listaId) {
        this.permisos.delete(id);
      }
    }
  }

  async deleteByListaId(listaId: string): Promise<void> {
    for (const [id, permiso] of Array.from(this.permisos.entries())) {
      if (permiso.listaId === listaId) {
        this.permisos.delete(id);
      }
    }
  }

  async hasPermission(usuarioId: string, listaId: string): Promise<boolean> {
    return Array.from(this.permisos.values()).some(
      permiso => permiso.usuarioId === usuarioId && permiso.listaId === listaId
    );
  }

  async hasPermissionType(usuarioId: string, listaId: string, tipoPermiso: string): Promise<boolean> {
    return Array.from(this.permisos.values()).some(
      permiso =>
        permiso.usuarioId === usuarioId &&
        permiso.listaId === listaId &&
        permiso.tipoPermiso.value.toUpperCase() === tipoPermiso.toUpperCase()
    );
  }
}
