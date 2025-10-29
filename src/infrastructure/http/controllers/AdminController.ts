/**
 * Controlador para funcionalidades de administrador
 * Maneja endpoints relacionados con impersonación y administración de usuarios
 */

import { Request, Response } from 'express';
import { ImpersonateUser } from '@application/use-cases/admin/ImpersonateUser';
import { EndImpersonation } from '@application/use-cases/admin/EndImpersonation';
import { Logger } from '@infrastructure/observability/logger/Logger';
import {
  ImpersonateUserDto,
  ImpersonationResponseDto
} from '@application/dto/admin/ImpersonateUserDto';
import {
  EndImpersonationDto,
  EndImpersonationResponseDto
} from '@application/dto/admin/EndImpersonationDto';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    nombre: string;
    rol: string;
  };
}

const logger = new Logger('AdminController');

export class AdminController {
  constructor(
    private readonly impersonateUserUseCase: ImpersonateUser,
    private readonly endImpersonationUseCase: EndImpersonation
  ) {}

  /**
   * POST /admin/impersonate
   * Inicia una sesión de impersonación de usuario
   */
  impersonateUser = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const adminUserId = req.user?.id;
      
      if (!adminUserId) {
        res.status(401).json({
          error: 'Usuario no autenticado',
          code: 'NOT_AUTHENTICATED'
        });
        return;
      }
      const dto: ImpersonateUserDto = req.body;
      const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';

      logger.info('Solicitud de impersonación recibida', {
        adminUserId,
        targetUserId: dto.targetUserId,
        targetUserEmail: dto.targetUserEmail,
        reason: dto.reason,
        ipAddress,
        userAgent
      });

      const result = await this.impersonateUserUseCase.execute(
        adminUserId,
        dto,
        ipAddress,
        userAgent
      );

      if (!result.isSuccess) {
        const statusCode = this.getErrorStatusCode(result.error);
        logger.warn('Fallo en impersonación', {
          adminUserId,
          error: result.error.message,
          errorType: result.error.constructor.name
        });

        res.status(statusCode).json({
          error: result.error.message,
          code: result.error.constructor.name.replace('Error', '').toUpperCase()
        });
        return;
      }

      const response: ImpersonationResponseDto = result.value;

      res.status(200).json({
        success: true,
        message: 'Impersonación iniciada exitosamente',
        data: response
      });

    } catch (error) {
      logger.error('Error inesperado en impersonación', {
        error: error instanceof Error ? error.message : 'Error desconocido',
        stack: error instanceof Error ? error.stack : undefined,
        adminUserId: req.user?.id
      });

      res.status(500).json({
        error: 'Error interno del servidor',
        code: 'INTERNAL_SERVER_ERROR'
      });
    }
  };

  /**
   * DELETE /admin/impersonate
   * Finaliza la sesión de impersonación actual
   */
  endImpersonation = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        res.status(401).json({
          error: 'Token de autorización requerido',
          code: 'AUTHORIZATION_REQUIRED'
        });
        return;
      }

      // Extraer token del header
      const token = authHeader.replace('Bearer ', '');
      const dto: EndImpersonationDto = req.body || {};
      const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';

      logger.info('Solicitud de finalización de impersonación recibida', {
        sessionId: dto.sessionId,
        reason: dto.reason,
        ipAddress,
        userAgent
      });

      const result = await this.endImpersonationUseCase.execute(
        token,
        dto,
        ipAddress,
        userAgent
      );

      if (!result.isSuccess) {
        const statusCode = this.getErrorStatusCode(result.error);
        logger.warn('Fallo al finalizar impersonación', {
          error: result.error.message,
          errorType: result.error.constructor.name
        });

        res.status(statusCode).json({
          error: result.error.message,
          code: result.error.constructor.name.replace('Error', '').toUpperCase()
        });
        return;
      }

      const response: EndImpersonationResponseDto = result.value;

      res.status(200).json({
        success: true,
        message: response.message,
        data: response
      });

    } catch (error) {
      logger.error('Error inesperado al finalizar impersonación', {
        error: error instanceof Error ? error.message : 'Error desconocido',
        stack: error instanceof Error ? error.stack : undefined
      });

      res.status(500).json({
        error: 'Error interno del servidor',
        code: 'INTERNAL_SERVER_ERROR'
      });
    }
  };

  /**
   * GET /admin/impersonate/status
   * Obtiene el estado de la sesión de impersonación actual (si existe)
   */
  getImpersonationStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        res.status(401).json({
          error: 'Token de autorización requerido',
          code: 'AUTHORIZATION_REQUIRED'
        });
        return;
      }

      // Extraer y verificar token
      // const token = authHeader.replace('Bearer ', '');
      
      // Nota: Este endpoint requeriría extender ITokenService para decodificar sin verificar
      // Por simplicidad, retornamos información básica basada en el usuario actual
      
      // Si el endpoint es accedido con un token de impersonación, 
      // el middleware ya habrá procesado la información
      const isImpersonating = req.headers['x-impersonation-active'] === 'true';
      
      res.status(200).json({
        success: true,
        data: {
          isImpersonating,
          currentUser: {
            id: req.user?.id || '',
            email: req.user?.email || '',
            nombre: req.user?.nombre || '',
            rol: req.user?.rol || ''
          },
          adminUser: isImpersonating ? {
            // Esta información vendría del token decodificado
            id: req.headers['x-admin-id'],
            email: req.headers['x-admin-email']
          } : null
        }
      });

    } catch (error) {
      logger.error('Error al obtener estado de impersonación', {
        error: error instanceof Error ? error.message : 'Error desconocido',
        stack: error instanceof Error ? error.stack : undefined
      });

      res.status(500).json({
        error: 'Error interno del servidor',
        code: 'INTERNAL_SERVER_ERROR'
      });
    }
  };

  /**
   * GET /admin/audit/impersonations
   * Obtiene el historial de impersonaciones (funcionalidad futura)
   */
  getImpersonationAuditLog = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      // Esta funcionalidad requeriría implementar un repositorio de auditoría
      // Por ahora retornamos un placeholder
      
      logger.info('Solicitud de logs de auditoría de impersonaciones', {
        adminUserId: req.user?.id || '',
        query: req.query
      });

      res.status(200).json({
        success: true,
        message: 'Funcionalidad de auditoría en desarrollo',
        data: {
          impersonations: [],
          total: 0,
          note: 'Los logs de auditoría se almacenan en los logs del sistema por el momento'
        }
      });

    } catch (error) {
      logger.error('Error al obtener logs de auditoría', {
        error: error instanceof Error ? error.message : 'Error desconocido',
        stack: error instanceof Error ? error.stack : undefined
      });

      res.status(500).json({
        error: 'Error interno del servidor',
        code: 'INTERNAL_SERVER_ERROR'
      });
    }
  };

  /**
   * Mapea tipos de error a códigos de estado HTTP
   */
  private getErrorStatusCode(error: Error): number {
    switch (error.constructor.name) {
      case 'ValidationError':
        return 400;
      case 'UnauthorizedError':
        return 401;
      case 'NotFoundError':
        return 404;
      default:
        return 500;
    }
  }
}