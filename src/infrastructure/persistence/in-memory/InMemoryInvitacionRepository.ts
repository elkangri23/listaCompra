import type { IInvitacionRepository } from '@application/ports/repositories/IInvitacionRepository';
import type { Invitacion } from '@domain/entities/Invitacion';

export class InMemoryInvitacionRepository implements IInvitacionRepository {
  private readonly invitaciones = new Map<string, Invitacion>();

  async save(invitacion: Invitacion): Promise<void> {
    this.invitaciones.set(invitacion.id, invitacion);
  }

  async findById(id: string): Promise<Invitacion | null> {
    return this.invitaciones.get(id) ?? null;
  }

  async findByHash(hash: string): Promise<Invitacion | null> {
    for (const invitacion of this.invitaciones.values()) {
      if (invitacion.hash.value === hash) {
        return invitacion;
      }
    }
    return null;
  }

  async findByListaId(listaId: string): Promise<Invitacion[]> {
    return Array.from(this.invitaciones.values()).filter(invitacion => invitacion.listaId === listaId);
  }

  async findActiveByListaId(listaId: string): Promise<Invitacion[]> {
    return Array.from(this.invitaciones.values()).filter(invitacion => invitacion.listaId === listaId && invitacion.esValida());
  }

  async getAllActiveHashes(): Promise<string[]> {
    return Array.from(this.invitaciones.values())
      .filter(invitacion => invitacion.esValida())
      .map(invitacion => invitacion.hash.value);
  }

  async delete(id: string): Promise<void> {
    this.invitaciones.delete(id);
  }

  async update(invitacion: Invitacion): Promise<void> {
    this.invitaciones.set(invitacion.id, invitacion);
  }

  async findExpired(): Promise<Invitacion[]> {
    return Array.from(this.invitaciones.values()).filter(invitacion => invitacion.haExpirado());
  }

  async deactivateExpired(): Promise<number> {
    let count = 0;
    for (const [id, invitacion] of this.invitaciones.entries()) {
      if (invitacion.haExpirado() && invitacion.activa) {
        const result = invitacion.desactivar();
        if (result.isSuccess) {
          this.invitaciones.set(id, result.value);
          count += 1;
        }
      }
    }
    return count;
  }
}
