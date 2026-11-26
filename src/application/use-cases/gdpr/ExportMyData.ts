/**
 * Caso de uso: Exportar mis datos (GDPR, item 15)
 * Devuelve todos los datos personales del usuario en un único JSON:
 * perfil, listas con sus productos, categorías, tiendas, plantillas,
 * colaboraciones en listas de otros e invitaciones.
 */

import type { Result } from '@shared/result';
import { success, failure } from '@shared/result';
import { NotFoundError } from '@application/errors';
import type { IUsuarioRepository } from '@application/ports/repositories/IUsuarioRepository';
import type { IListaRepository } from '@application/ports/repositories/IListaRepository';
import type { IProductoRepository } from '@application/ports/repositories/IProductoRepository';
import type { ICategoriaRepository } from '@application/ports/repositories/ICategoriaRepository';
import type { ITiendaRepository } from '@application/ports/repositories/ITiendaRepository';
import type { IBlueprintRepository } from '@application/ports/repositories/IBlueprintRepository';
import type { IPermisoRepository } from '@application/ports/repositories/IPermisoRepository';
import type { IInvitacionRepository } from '@application/ports/repositories/IInvitacionRepository';

export interface ExportMyDataDto {
  usuarioId: string;
}

export interface ExportMyDataResult {
  exportadoEn: string;
  usuario: {
    id: string;
    nombre: string;
    apellidos: string | null;
    email: string;
    rol: string;
    emailVerificado: boolean;
    terminosAceptadosEn: string | null;
    fechaCreacion: string;
  };
  listas: Array<Record<string, unknown> & { productos: Array<Record<string, unknown>> }>;
  categorias: Array<Record<string, unknown>>;
  tiendas: Array<Record<string, unknown>>;
  plantillas: Array<Record<string, unknown>>;
  colaboraciones: Array<Record<string, unknown>>;
  invitaciones: Array<Record<string, unknown>>;
}

export class ExportMyData {
  constructor(
    private readonly usuarioRepository: IUsuarioRepository,
    private readonly listaRepository: IListaRepository,
    private readonly productoRepository: IProductoRepository,
    private readonly categoriaRepository: ICategoriaRepository,
    private readonly tiendaRepository: ITiendaRepository,
    private readonly blueprintRepository: IBlueprintRepository,
    private readonly permisoRepository: IPermisoRepository,
    private readonly invitacionRepository: IInvitacionRepository
  ) {}

  async execute(dto: ExportMyDataDto): Promise<Result<ExportMyDataResult, NotFoundError | Error>> {
    if (!dto.usuarioId || dto.usuarioId.trim().length === 0) {
      return failure(new NotFoundError('Usuario', dto.usuarioId));
    }

    const usuarioResult = await this.usuarioRepository.findById(dto.usuarioId);
    if (usuarioResult.isFailure || !usuarioResult.value) {
      return failure(new NotFoundError('Usuario', dto.usuarioId));
    }
    const usuario = usuarioResult.value;

    const listasResult = await this.listaRepository.findByOwner(dto.usuarioId, undefined, {
      page: 1,
      limit: 1000,
    });
    if (listasResult.isFailure) {
      return failure(listasResult.error);
    }
    const listas = listasResult.value.items;

    const listasConProductos: ExportMyDataResult['listas'] = [];
    for (const lista of listas) {
      const productosResult = await this.productoRepository.findByList(lista.id, undefined, {
        page: 1,
        limit: 1000,
      });
      if (productosResult.isFailure) {
        return failure(productosResult.error);
      }
      listasConProductos.push({
        ...lista.toJSON(),
        productos: productosResult.value.items.map((producto) => producto.toJSON()),
      });
    }

    const categoriasResult = await this.categoriaRepository.findAll();
    if (categoriasResult.isFailure) {
      return failure(categoriasResult.error);
    }

    const tiendasResult = await this.tiendaRepository.findAll();
    if (tiendasResult.isFailure) {
      return failure(tiendasResult.error);
    }

    const blueprintsResult = await this.blueprintRepository.findByUsuarioId(dto.usuarioId, {
      page: 1,
      limit: 1000,
    });
    if (blueprintsResult.isFailure) {
      return failure(blueprintsResult.error);
    }

    const permisos = await this.permisoRepository.findByUsuarioId(dto.usuarioId);

    const invitacionesPorId = new Map<string, Record<string, unknown>>();
    for (const lista of listas) {
      const invitaciones = await this.invitacionRepository.findByListaId(lista.id);
      for (const invitacion of invitaciones) {
        invitacionesPorId.set(invitacion.id, this.invitacionToJSON(invitacion));
      }
    }
    const pendientes = await this.invitacionRepository.findPendingByEmail(usuario.email.value);
    for (const invitacion of pendientes) {
      invitacionesPorId.set(invitacion.id, this.invitacionToJSON(invitacion));
    }

    return success({
      exportadoEn: new Date().toISOString(),
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        apellidos: usuario.apellidos,
        email: usuario.email.value,
        rol: usuario.rol,
        emailVerificado: usuario.emailVerificado,
        terminosAceptadosEn: usuario.terminosAceptadosEn?.toISOString() ?? null,
        fechaCreacion: usuario.fechaCreacion.toISOString(),
      },
      listas: listasConProductos,
      categorias: categoriasResult.value.map((categoria) => ({
        id: categoria.id,
        nombre: categoria.nombre,
        descripcion: categoria.descripcion,
        color: categoria.color,
        icono: categoria.icono,
        activa: categoria.activa,
        tiendaId: categoria.tiendaId,
        fechaCreacion: categoria.fechaCreacion.toISOString(),
      })),
      tiendas: tiendasResult.value.map((tienda) => ({
        id: tienda.id,
        nombre: tienda.nombre,
        direccion: tienda.direccion,
        telefono: tienda.telefono,
        sitioWeb: tienda.sitioWeb,
        activa: tienda.activa,
        fechaCreacion: tienda.fechaCreacion.toISOString(),
      })),
      plantillas: blueprintsResult.value.items.map((blueprint) => ({
        id: blueprint.id,
        nombre: blueprint.nombre,
        descripcion: blueprint.descripcion,
        publico: blueprint.publico,
        productos: blueprint.productos,
        creadoPorId: blueprint.creadoPorId,
        fechaCreacion: blueprint.fechaCreacion.toISOString(),
      })),
      colaboraciones: permisos.map((permiso) => ({
        listaId: permiso.listaId,
        tipoPermiso: permiso.tipoPermiso.toString(),
        creadoEn: permiso.creadoEn.toISOString(),
      })),
      invitaciones: [...invitacionesPorId.values()],
    });
  }

  private invitacionToJSON(invitacion: {
    id: string;
    listaId: string;
    tipoPermiso: { toString(): string };
    emailInvitado: string | null;
    activa: boolean;
    creadaEn: Date;
    expiraEn: Date;
  }): Record<string, unknown> {
    return {
      id: invitacion.id,
      listaId: invitacion.listaId,
      tipoPermiso: invitacion.tipoPermiso.toString(),
      emailInvitado: invitacion.emailInvitado,
      activa: invitacion.activa,
      creadaEn: invitacion.creadaEn.toISOString(),
      expiraEn: invitacion.expiraEn.toISOString(),
    };
  }
}
