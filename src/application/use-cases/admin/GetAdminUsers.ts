/**
 * Caso de uso: Listar usuarios para el panel de administración
 * Devuelve los usuarios paginados, con búsqueda opcional por nombre o
 * correo y conteos reales de listas creadas y productos agregados.
 */

import type { Result } from '@shared/result';
import { success, failure } from '@shared/result';
import type { PaginationParams } from '@shared/types';
import type { Usuario } from '@domain/entities/Usuario';
import type { IUsuarioRepository } from '@application/ports/repositories/IUsuarioRepository';
import type { IListaRepository } from '@application/ports/repositories/IListaRepository';
import type { IProductoRepository } from '@application/ports/repositories/IProductoRepository';
import { Logger } from '@infrastructure/observability/logger/Logger';
import type {
  AdminUserDto,
  GetAdminUsersQueryDto,
  GetAdminUsersResponseDto
} from '@application/dto/admin/AdminUserDto';

const logger = new Logger('GetAdminUsers');

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

function normalizePage(page?: number): number {
  if (!page || !Number.isFinite(page) || page < 1) {
    return DEFAULT_PAGE;
  }
  return Math.floor(page);
}

function normalizeLimit(limit?: number): number {
  if (!limit || !Number.isFinite(limit) || limit < 1) {
    return DEFAULT_LIMIT;
  }
  return Math.min(Math.floor(limit), MAX_LIMIT);
}

export function toAdminUserDto(
  usuario: Usuario,
  listasCreadas: number,
  productosAgregados: number
): AdminUserDto {
  return {
    id: usuario.id,
    nombre: usuario.nombreCompleto,
    email: usuario.email.value,
    rol: usuario.rol,
    activo: usuario.activo,
    emailVerificado: usuario.emailVerificado,
    fechaCreacion: usuario.fechaCreacion,
    fechaActualizacion: usuario.fechaActualizacion,
    listasCreadas,
    productosAgregados
  };
}

export class GetAdminUsers {
  constructor(
    private readonly usuarioRepository: IUsuarioRepository,
    private readonly listaRepository: IListaRepository,
    private readonly productoRepository: IProductoRepository
  ) {}

  async execute(
    query: GetAdminUsersQueryDto
  ): Promise<Result<GetAdminUsersResponseDto, Error>> {
    try {
      const page = normalizePage(query.page);
      const limit = normalizeLimit(query.limit);
      const params: PaginationParams = { page, limit };

      const term = query.q?.trim();
      const result = term
        ? await this.usuarioRepository.search(term, params)
        : await this.usuarioRepository.findAll(params);

      if (result.isFailure) {
        logger.error('Error al listar usuarios para administración', {
          error: result.error.message,
          term: term ?? null,
          page,
          limit
        });
        return failure(result.error);
      }

      const { data: usuarios, total, totalPages } = result.value;

      const dtos = await Promise.all(
        usuarios.map(async (usuario) => {
          const [listasResult, productosResult] = await Promise.all([
            this.listaRepository.countByOwner(usuario.id),
            this.productoRepository.countByCreator(usuario.id)
          ]);

          if (listasResult.isFailure) {
            throw listasResult.error;
          }
          if (productosResult.isFailure) {
            throw productosResult.error;
          }

          return toAdminUserDto(
            usuario,
            listasResult.value,
            productosResult.value
          );
        })
      );

      return success({
        usuarios: dtos,
        total,
        page: result.value.page,
        limit: result.value.limit,
        totalPages
      });
    } catch (error) {
      logger.error('Error inesperado al listar usuarios para administración', {
        error: error instanceof Error ? error.message : String(error)
      });
      return failure(
        error instanceof Error
          ? error
          : new Error('Error interno al listar usuarios')
      );
    }
  }
}
