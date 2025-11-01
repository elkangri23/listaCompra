/**
 * Controlador HTTP para la gestión de invitaciones
 * Maneja las peticiones HTTP para compartir listas, acceder a listas compartidas y gestionar permisos
 */

import { Response } from 'express';
import { AuthenticatedRequest } from '../types/express';
import { ShareList } from '@application/use-cases/invitations/ShareList';
import { AccessSharedList } from '@application/use-cases/invitations/AccessSharedList';
import { ManagePermissions } from '@application/use-cases/invitations/ManagePermissions';
import { CancelInvitation } from '@application/use-cases/invitations/CancelInvitation';
import { ValidationError, NotFoundError, UnauthorizedError } from '@application/errors';
import type { IInvitacionRepository } from '@application/ports/repositories/IInvitacionRepository';
import type { IPermisoRepository } from '@application/ports/repositories/IPermisoRepository';

export class InvitationController {
  constructor(
    private readonly shareListUseCase: ShareList,
    private readonly accessSharedListUseCase: AccessSharedList,
    private readonly managePermissionsUseCase: ManagePermissions,
    private readonly cancelInvitationUseCase: CancelInvitation,
    private readonly invitacionRepository: IInvitacionRepository,
    private readonly permisoRepository: IPermisoRepository
  ) {}

  /**
   * POST /api/lists/:listaId/share
   * Compartir una lista creando una invitación
   */
  async shareList(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { listaId } = req.params;
      const { tipoPermiso, diasExpiracion, duracionHoras } = req.body;
      const usuarioComparteId = req.user?.userId; // Asumiendo middleware de autenticación

      if (!listaId) {
        res.status(400).json({
          success: false,
          error: 'ID de lista es requerido',
          code: 'VALIDATION_ERROR'
        });
        return;
      }

      if (!usuarioComparteId) {
        res.status(401).json({
          success: false,
          error: 'Usuario no autenticado',
          code: 'UNAUTHORIZED'
        });
        return;
      }

      const expirationDays = diasExpiracion ?? (
        duracionHoras !== undefined ? Math.max(1, Math.ceil(Number(duracionHoras) / 24)) : undefined
      );

      const result = await this.shareListUseCase.execute({
        listaId,
        usuarioComparteId,
        tipoPermiso,
        diasExpiracion: expirationDays
      });

      if (result.isFailure) {
        this.handleError(result.error, res);
        return;
      }

      res.status(201).json({
        success: true,
        message: 'Lista compartida exitosamente',
        data: result.value
      });
    } catch (error) {
      console.error('Error en shareList:', error);
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * GET /api/invitations/:hash
   * Acceder a una lista compartida mediante hash de invitación
   */
  async accessSharedList(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { hash } = req.params;
      const usuarioId = req.user?.userId;

      if (!hash) {
        res.status(400).json({
          success: false,
          error: 'Hash de invitación es requerido',
          code: 'VALIDATION_ERROR'
        });
        return;
      }

      if (!usuarioId) {
        res.status(401).json({
          success: false,
          error: 'Usuario no autenticado',
          code: 'UNAUTHORIZED'
        });
        return;
      }

      const result = await this.accessSharedListUseCase.execute({
        hash,
        usuarioId
      });

      if (result.isFailure) {
        this.handleError(result.error, res);
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Acceso a lista compartida exitoso',
        data: result.value
      });
    } catch (error) {
      console.error('Error en accessSharedList:', error);
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * PUT /api/lists/:listaId/permissions/:targetUsuarioId
   * Cambiar permisos de un usuario sobre una lista
   */
  async changePermissions(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { listaId, targetUsuarioId } = req.params;
      const nuevoTipoPermiso = req.body['nuevoTipoPermiso'] ?? req.body['tipoPermiso'];
      const adminUsuarioId = req.user?.userId;

      const validationError = this.validateParams({ listaId, targetUsuarioId }, adminUsuarioId);
      if (validationError) {
        res.status(validationError.status).json(validationError.body);
        return;
      }

      const result = await this.managePermissionsUseCase.execute({
        listaId: listaId!,
        adminUsuarioId: adminUsuarioId!,
        targetUsuarioId: targetUsuarioId!,
        accion: 'cambiar',
        nuevoTipoPermiso
      });

      if (result.isFailure) {
        this.handleError(result.error, res);
        return;
      }

      const permisoActualizado = result.value.permiso
        ? {
            ...result.value.permiso,
            creadoEn: result.value.permiso.creadoEn instanceof Date
              ? result.value.permiso.creadoEn.toISOString()
              : result.value.permiso.creadoEn,
            mensaje: result.value.mensaje
          }
        : { mensaje: result.value.mensaje };

      res.status(200).json({
        success: true,
        message: 'Permisos actualizados exitosamente',
        data: permisoActualizado
      });
    } catch (error) {
      console.error('Error en changePermissions:', error);
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * DELETE /api/lists/:listaId/permissions/:targetUsuarioId
   * Eliminar permisos de un usuario sobre una lista
   */
  async removePermissions(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { listaId, targetUsuarioId } = req.params;
      const adminUsuarioId = req.user?.userId;

      const validationError = this.validateParams({ listaId, targetUsuarioId }, adminUsuarioId);
      if (validationError) {
        res.status(validationError.status).json(validationError.body);
        return;
      }

      const result = await this.managePermissionsUseCase.execute({
        listaId: listaId!,
        adminUsuarioId: adminUsuarioId!,
        targetUsuarioId: targetUsuarioId!,
        accion: 'eliminar'
      });

      if (result.isFailure) {
        this.handleError(result.error, res);
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Permisos eliminados exitosamente',
        data: result.value
      });
    } catch (error) {
      console.error('Error en removePermissions:', error);
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * DELETE /api/invitations/:invitacionId
   * Cancelar una invitación
   */
  async cancelInvitation(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { invitacionId } = req.params;
      const adminUsuarioId = req.user?.userId;

      const validationError = this.validateParams({ invitacionId }, adminUsuarioId);
      if (validationError) {
        res.status(validationError.status).json(validationError.body);
        return;
      }

      const result = await this.cancelInvitationUseCase.execute({
        invitacionId: invitacionId!,
        adminUsuarioId: adminUsuarioId!
      });

      if (result.isFailure) {
        this.handleError(result.error, res);
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Invitación cancelada exitosamente',
        data: result.value
      });
    } catch (error) {
      console.error('Error en cancelInvitation:', error);
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * GET /api/lists/:listaId/invitations
   * Obtener todas las invitaciones de una lista (solo para administradores)
   */
  async getListInvitations(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { listaId } = req.params;
      const usuarioId = req.user?.userId;

      if (!listaId) {
        res.status(400).json({
          success: false,
          error: 'ID de lista es requerido',
          code: 'VALIDATION_ERROR'
        });
        return;
      }

      if (!usuarioId) {
        res.status(401).json({
          success: false,
          error: 'Usuario no autenticado',
          code: 'UNAUTHORIZED'
        });
        return;
      }

      const invitaciones = await this.invitacionRepository.findActiveByListaId(listaId);
      const data = invitaciones.map(invitacion => ({
        id: invitacion.id,
        listaId: invitacion.listaId,
        hash: invitacion.hash.value,
        tipoPermiso: invitacion.tipoPermiso.value,
        creadaEn: invitacion.creadaEn.toISOString(),
        expiraEn: invitacion.expiraEn.toISOString(),
        activa: invitacion.activa,
      }));

      res.status(200).json({
        success: true,
        message: 'Invitaciones obtenidas exitosamente',
        data
      });
    } catch (error) {
      console.error('Error en getListInvitations:', error);
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * GET /api/lists/:listaId/permissions
   * Obtener todos los permisos de una lista (solo para administradores)
   */
  async getListPermissions(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { listaId } = req.params;
      const usuarioId = req.user?.userId;

      if (!listaId) {
        res.status(400).json({
          success: false,
          error: 'ID de lista es requerido',
          code: 'VALIDATION_ERROR'
        });
        return;
      }

      if (!usuarioId) {
        res.status(401).json({
          success: false,
          error: 'Usuario no autenticado',
          code: 'UNAUTHORIZED'
        });
        return;
      }

      const permisos = await this.permisoRepository.findByListaId(listaId);
      const data = permisos.map(permiso => ({
        id: permiso.id,
        usuarioId: permiso.usuarioId,
        listaId: permiso.listaId,
        tipoPermiso: permiso.tipoPermiso.value,
        creadoEn: permiso.creadoEn.toISOString(),
      }));

      res.status(200).json({
        success: true,
        message: 'Permisos obtenidos exitosamente',
        data
      });
    } catch (error) {
      console.error('Error en getListPermissions:', error);
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * Maneja los errores de los casos de uso y envía la respuesta HTTP apropiada
   */
  private handleError(error: ValidationError | NotFoundError | UnauthorizedError, res: Response): void {
    if (error instanceof ValidationError) {
      res.status(400).json({
        success: false,
        error: error.message,
        code: error.code,
        field: error.field,
        value: error.value
      });
    } else if (error instanceof NotFoundError) {
      res.status(404).json({
        success: false,
        error: error.message,
        code: error.code,
        resource: error.resource,
        identifier: error.identifier
      });
    } else if (error instanceof UnauthorizedError) {
      res.status(403).json({
        success: false,
        error: error.message,
        code: error.code
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * Valida parámetros requeridos y autenticación
   */
  private validateParams(
    params: Record<string, string | undefined>, 
    userId?: string
  ): { status: number; body: any } | null {
    // Validar autenticación
    if (!userId) {
      return {
        status: 401,
        body: {
          success: false,
          error: 'Usuario no autenticado',
          code: 'UNAUTHORIZED'
        }
      };
    }

    // Validar parámetros requeridos
    for (const [key, value] of Object.entries(params)) {
      if (!value) {
        return {
          status: 400,
          body: {
            success: false,
            error: `${key} es requerido`,
            code: 'VALIDATION_ERROR'
          }
        };
      }
    }

    return null;
  }
}