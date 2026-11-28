/**
 * Controlador para funcionalidades de administrador
 * Maneja endpoints relacionados con impersonación y administración de usuarios
 */

import type { Request, Response } from 'express';
import type { ImpersonateUser } from '@application/use-cases/admin/ImpersonateUser';
import type { EndImpersonation } from '@application/use-cases/admin/EndImpersonation';
import type { GetAdminUsers } from '@application/use-cases/admin/GetAdminUsers';
import type { UpdateUserStatus } from '@application/use-cases/admin/UpdateUserStatus';
import type { UpdateUserStatusDto } from '@application/dto/admin/AdminUserDto';
import { Logger } from '@infrastructure/observability/logger/Logger';
import type {
  ImpersonateUserDto,
  ImpersonationResponseDto
} from '@application/dto/admin/ImpersonateUserDto';
import type {
  EndImpersonationDto,
  EndImpersonationResponseDto
} from '@application/dto/admin/EndImpersonationDto';
import type { IAuditRepository } from '@application/ports/repositories/IAuditRepository';
import type { AuditEntry } from '@domain/entities/AuditEntry';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    nombre: string;
    rol: string;
  };
}

const logger = new Logger('AdminController');

/**
 * Lee un entero de un query param; devuelve el valor por defecto si no es
 * un entero válido. El caso de uso normaliza página (>= 1) y límite (1..100).
 */
function parseQueryInt(value: unknown, defaultValue: number): number {
  if (typeof value !== 'string') {
    return defaultValue;
  }
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

export class AdminController {
  constructor(
    private readonly impersonateUserUseCase: ImpersonateUser,
    private readonly endImpersonationUseCase: EndImpersonation,
    private readonly auditRepository?: IAuditRepository,
    private readonly getAdminUsersUseCase?: GetAdminUsers,
    private readonly updateUserStatusUseCase?: UpdateUserStatus
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
   * Obtiene el historial de impersonaciones con filtros básicos
   */
  getImpersonationAuditLog = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const adminUserId = req.user?.id || '';
      const { startDate, endDate, adminId, targetUserId, limit = '50', offset = '0' } = req.query;
      
      logger.info('Solicitud de logs de auditoría de impersonaciones', {
        adminUserId,
        filters: { startDate, endDate, adminId, targetUserId, limit, offset }
      });

      const limitNum = Math.max(1, Math.min(parseInt(limit as string, 10) || 50, 200));
      const offsetNum = Math.max(0, parseInt(offset as string, 10) || 0);

      // Consulta real a la tabla audit_entries (entradas de tipo IMPERSONACION)
      if (!this.auditRepository) {
        res.status(503).json({
          success: false,
          error: 'Servicio de auditoría no disponible',
          code: 'AUDIT_SERVICE_UNAVAILABLE'
        });
        return;
      }

      const query = {
        entityType: 'IMPERSONACION' as const,
        ...(adminId ? { changedByUserId: adminId as string } : {}),
        ...(targetUserId ? { entityId: targetUserId as string } : {}),
        ...(startDate ? { startDate: new Date(startDate as string) } : {}),
        ...(endDate ? { endDate: new Date(endDate as string) } : {}),
        page: Math.floor(offsetNum / limitNum) + 1,
        pageSize: limitNum
      };

      const [entriesResult, countResult] = await Promise.all([
        this.auditRepository.find(query),
        this.auditRepository.count(query)
      ]);

      if (entriesResult.isFailure || countResult.isFailure) {
        logger.error('Error consultando auditoría de impersonaciones', {
          entriesError: entriesResult.isFailure ? String(entriesResult.error) : null,
          countError: countResult.isFailure ? String(countResult.error) : null
        });
        res.status(500).json({
          success: false,
          error: 'Error interno del servidor al obtener logs de auditoría',
          code: 'AUDIT_FETCH_ERROR'
        });
        return;
      }

      const entries = entriesResult.value as AuditEntry[];
      const total = countResult.value as number;

      const records = entries.map((entry: AuditEntry) => ({
        id: entry.id,
        type: entry.newValue?.['type'] ?? 'IMPERSONATION_STARTED',
        timestamp: entry.timestamp.toISOString(),
        adminId: entry.changedByUserId ?? null,
        adminEmail: entry.newValue?.['adminEmail'] ?? null,
        targetUserId: entry.entityId,
        targetUserEmail: entry.newValue?.['targetUserEmail'] ?? null,
        reason: entry.newValue?.['reason'] ?? null,
        ipAddress: entry.newValue?.['ipAddress'] ?? null,
        userAgent: entry.newValue?.['userAgent'] ?? null,
        sessionId: entry.newValue?.['sessionId'] ?? null,
        duration: entry.newValue?.['duration'] ?? null,
        status: entry.newValue?.['status'] ?? null
      }));

      const response = {
        success: true,
        message: 'Logs de auditoría de impersonaciones obtenidos exitosamente',
        data: {
          impersonations: records,
          pagination: {
            total,
            limit: limitNum,
            offset: offsetNum,
            hasMore: total > (offsetNum + limitNum)
          },
          filters: {
            startDate: startDate || null,
            endDate: endDate || null,
            adminId: adminId || null,
            targetUserId: targetUserId || null
          },
          metadata: {
            generatedAt: new Date().toISOString(),
            requestedBy: adminUserId,
            source: 'audit_entries'
          }
        }
      };

      res.status(200).json(response);

    } catch (error) {
      logger.error('Error al obtener logs de auditoría', {
        error: error instanceof Error ? error.message : 'Error desconocido',
        stack: error instanceof Error ? error.stack : undefined,
        adminUserId: req.user?.id || 'unknown'
      });

      res.status(500).json({
        error: 'Error interno del servidor al obtener logs de auditoría',
        code: 'AUDIT_FETCH_ERROR'
      });
    }
  };

  /**
   * GET /admin/users
   * Lista usuarios con búsqueda y paginación, con conteos de listas
   * creadas y productos agregados
   */
  getAdminUsers = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const adminUserId = req.user?.id;

      if (!adminUserId) {
        res.status(401).json({
          error: 'Usuario no autenticado',
          code: 'NOT_AUTHENTICATED'
        });
        return;
      }

      if (!this.getAdminUsersUseCase) {
        res.status(503).json({
          success: false,
          error: 'Servicio de listado de usuarios no disponible',
          code: 'ADMIN_USERS_SERVICE_UNAVAILABLE'
        });
        return;
      }

      const rawQ = req.query['q'];
      const q = typeof rawQ === 'string' && rawQ.trim() !== ''
        ? rawQ.trim()
        : undefined;
      const page = parseQueryInt(req.query['page'], 1);
      const limit = parseQueryInt(req.query['limit'], 20);

      logger.info('Solicitud de listado de usuarios (admin)', {
        adminUserId,
        q: q ?? null,
        page,
        limit
      });

      const result = await this.getAdminUsersUseCase.execute({ q, page, limit });

      if (!result.isSuccess) {
        logger.error('Error al listar usuarios (admin)', {
          error: result.error.message,
          adminUserId
        });
        res.status(500).json({
          error: 'Error interno del servidor al listar usuarios',
          code: 'ADMIN_USERS_FETCH_ERROR'
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: result.value
      });

    } catch (error) {
      logger.error('Error inesperado al listar usuarios (admin)', {
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
   * PATCH /admin/users/:id/status
   * Activa o desactiva la cuenta de un usuario
   */
  updateUserStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const adminUserId = req.user?.id;

      if (!adminUserId) {
        res.status(401).json({
          error: 'Usuario no autenticado',
          code: 'NOT_AUTHENTICATED'
        });
        return;
      }

      if (!this.updateUserStatusUseCase) {
        res.status(503).json({
          success: false,
          error: 'Servicio de gestión de usuarios no disponible',
          code: 'ADMIN_USERS_SERVICE_UNAVAILABLE'
        });
        return;
      }

      const userId = req.params['id'];
      if (!userId) {
        res.status(400).json({
          error: 'ID de usuario requerido',
          code: 'VALIDATION_ERROR'
        });
        return;
      }
      const dto: UpdateUserStatusDto = req.body;

      logger.info('Solicitud de cambio de estado de usuario (admin)', {
        adminUserId,
        userId,
        activo: dto.activo
      });

      const result = await this.updateUserStatusUseCase.execute(
        adminUserId,
        userId,
        dto.activo
      );

      if (!result.isSuccess) {
        const statusCode = this.getErrorStatusCode(result.error);
        logger.warn('Fallo en cambio de estado de usuario', {
          adminUserId,
          userId,
          error: result.error.message,
          errorType: result.error.constructor.name
        });

        res.status(statusCode).json({
          error: result.error.message,
          code: result.error.constructor.name.replace('Error', '').toUpperCase()
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: result.value.activo
          ? 'Usuario activado correctamente'
          : 'Usuario desactivado correctamente',
        data: {
          usuario: result.value
        }
      });

    } catch (error) {
      logger.error('Error inesperado al actualizar el estado del usuario', {
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
   * Mapea tipos de error a códigos de estado HTTP
   */
  private getErrorStatusCode(error: Error): number {
    switch (error.constructor.name) {
    case 'ValidationError':
    case 'BusinessRuleViolationError':
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