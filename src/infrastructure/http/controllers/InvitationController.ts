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

export class InvitationController {
  constructor(
    private readonly shareListUseCase: ShareList,
    private readonly accessSharedListUseCase: AccessSharedList,
    private readonly managePermissionsUseCase: ManagePermissions,
    private readonly cancelInvitationUseCase: CancelInvitation
  ) {}

  /**
   * POST /api/lists/:listaId/share
   * Compartir una lista creando una invitación
   */
  async shareList(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { listaId } = req.params;
      const { tipoPermiso, diasExpiracion } = req.body;
      const usuarioComparteId = req.user?.userId; // Asumiendo middleware de autenticación

      if (!listaId) {
        res.status(400).json({
          error: 'ID de lista es requerido',
          code: 'VALIDATION_ERROR'
        });
        return;
      }

      if (!usuarioComparteId) {
        res.status(401).json({
          error: 'Usuario no autenticado',
          code: 'UNAUTHORIZED'
        });
        return;
      }

      const result = await this.shareListUseCase.execute({
        listaId,
        usuarioComparteId,
        tipoPermiso,
        diasExpiracion
      });

      if (result.isFailure) {
        this.handleError(result.error, res);
        return;
      }

      res.status(201).json({
        message: 'Lista compartida exitosamente',
        data: result.value
      });
    } catch (error) {
      console.error('Error en shareList:', error);
      res.status(500).json({
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
          error: 'Hash de invitación es requerido',
          code: 'VALIDATION_ERROR'
        });
        return;
      }

      if (!usuarioId) {
        res.status(401).json({
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
        message: 'Acceso a lista compartida exitoso',
        data: result.value
      });
    } catch (error) {
      console.error('Error en accessSharedList:', error);
      res.status(500).json({
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
      const { nuevoTipoPermiso } = req.body;
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

      res.status(200).json({
        message: 'Permisos actualizados exitosamente',
        data: result.value
      });
    } catch (error) {
      console.error('Error en changePermissions:', error);
      res.status(500).json({
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
        message: 'Permisos eliminados exitosamente',
        data: result.value
      });
    } catch (error) {
      console.error('Error en removePermissions:', error);
      res.status(500).json({
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
        message: 'Invitación cancelada exitosamente',
        data: result.value
      });
    } catch (error) {
      console.error('Error en cancelInvitation:', error);
      res.status(500).json({
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

      if (!usuarioId) {
        res.status(401).json({
          error: 'Usuario no autenticado',
          code: 'UNAUTHORIZED'
        });
        return;
      }

      // TODO: Implementar caso de uso para obtener invitaciones
      // Por ahora retornamos un placeholder
      res.status(200).json({
        message: 'Invitaciones obtenidas exitosamente',
        data: {
          listaId,
          invitaciones: []
        }
      });
    } catch (error) {
      console.error('Error en getListInvitations:', error);
      res.status(500).json({
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

      if (!usuarioId) {
        res.status(401).json({
          error: 'Usuario no autenticado',
          code: 'UNAUTHORIZED'
        });
        return;
      }

      // TODO: Implementar caso de uso para obtener permisos
      // Por ahora retornamos un placeholder
      res.status(200).json({
        message: 'Permisos obtenidos exitosamente',
        data: {
          listaId,
          permisos: []
        }
      });
    } catch (error) {
      console.error('Error en getListPermissions:', error);
      res.status(500).json({
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
        error: error.message,
        code: error.code,
        field: error.field,
        value: error.value
      });
    } else if (error instanceof NotFoundError) {
      res.status(404).json({
        error: error.message,
        code: error.code,
        resource: error.resource,
        identifier: error.identifier
      });
    } else if (error instanceof UnauthorizedError) {
      res.status(403).json({
        error: error.message,
        code: error.code
      });
    } else {
      res.status(500).json({
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
            error: `${key} es requerido`,
            code: 'VALIDATION_ERROR'
          }
        };
      }
    }

    return null;
  }
}