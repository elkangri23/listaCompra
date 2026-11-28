/**
 * DTOs para la gestión de usuarios del panel de administración
 * (Fase 2: listado de usuarios y cambio de estado activo/inactivo)
 */

import type { UUID } from '@shared/types';

/**
 * Resumen de un usuario para el panel de administración
 * (sin conteos; lo devuelve el cambio de estado)
 */
export interface AdminUserSummaryDto {
  /** ID del usuario */
  id: UUID;
  /** Nombre completo (nombre + apellidos) */
  nombre: string;
  /** Email del usuario */
  email: string;
  /** Rol (USUARIO | ADMIN) */
  rol: string;
  /** Si la cuenta está activa */
  activo: boolean;
  /** Si el email está verificado */
  emailVerificado: boolean;
  /** Fecha de creación de la cuenta */
  fechaCreacion: Date;
  /** Fecha de última actualización */
  fechaActualizacion: Date;
}

/**
 * Usuario del listado de administración, con conteos reales de actividad
 */
export interface AdminUserDto extends AdminUserSummaryDto {
  /** Nº de listas creadas por el usuario */
  listasCreadas: number;
  /** Nº de productos agregados por el usuario (creadoPorId) */
  productosAgregados: number;
}

/**
 * Parámetros de consulta del listado de usuarios
 */
export interface GetAdminUsersQueryDto {
  /** Búsqueda por nombre, apellidos o email (opcional) */
  q?: string | undefined;
  /** Nº de página (default 1) */
  page?: number | undefined;
  /** Elementos por página (default 20) */
  limit?: number | undefined;
}

/**
 * Respuesta paginada del listado de usuarios
 */
export interface GetAdminUsersResponseDto {
  usuarios: AdminUserDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Cuerpo para activar/desactivar un usuario
 */
export interface UpdateUserStatusDto {
  /** Nuevo estado de la cuenta */
  activo: boolean;
}
