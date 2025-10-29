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

      // Implementación básica que simula datos de auditoría con algunos registros de muestra
      // En una implementación completa, esto vendría de una base de datos de auditoría
      const mockAuditLogs = this.generateMockAuditData(
        adminUserId,
        { startDate, endDate, adminId, targetUserId },
        parseInt(limit as string, 10),
        parseInt(offset as string, 10)
      );

      const response = {
        success: true,
        message: 'Logs de auditoría de impersonaciones obtenidos exitosamente',
        data: {
          impersonations: mockAuditLogs.records,
          pagination: {
            total: mockAuditLogs.total,
            limit: parseInt(limit as string, 10),
            offset: parseInt(offset as string, 10),
            hasMore: mockAuditLogs.total > (parseInt(offset as string, 10) + parseInt(limit as string, 10))
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
            source: 'admin_audit_endpoint',
            note: 'Esta es una implementación básica. En producción se conectaría a un sistema de auditoría completo.'
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
   * Genera datos de auditoría de muestra para demostración
   * En una implementación real, esto vendría de una base de datos especializada
   */
  private generateMockAuditData(
    requestingAdminId: string,
    filters: any,
    limit: number,
    offset: number
  ) {
    const currentTime = new Date();
    const oneHourAgo = new Date(currentTime.getTime() - 60 * 60 * 1000);
    const oneWeekAgo = new Date(currentTime.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Simulamos algunos registros de auditoría
    const allRecords = [
      {
        id: 'audit_001',
        type: 'IMPERSONATION_STARTED',
        timestamp: oneHourAgo.toISOString(),
        adminId: 'admin_123',
        adminEmail: 'admin@example.com',
        targetUserId: 'user_456',
        targetUserEmail: 'usuario@example.com',
        reason: 'Soporte técnico - problemas con listas',
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        sessionId: 'session_001',
        duration: '15m',
        status: 'COMPLETED'
      },
      {
        id: 'audit_002',
        type: 'IMPERSONATION_ENDED',
        timestamp: new Date(oneHourAgo.getTime() + 15 * 60 * 1000).toISOString(),
        adminId: 'admin_123',
        adminEmail: 'admin@example.com',
        targetUserId: 'user_456',
        targetUserEmail: 'usuario@example.com',
        reason: 'Problema resuelto',
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        sessionId: 'session_001',
        duration: '15m',
        status: 'COMPLETED'
      },
      {
        id: 'audit_003',
        type: 'IMPERSONATION_STARTED',
        timestamp: oneWeekAgo.toISOString(),
        adminId: requestingAdminId,
        adminEmail: 'current_admin@example.com',
        targetUserId: 'user_789',
        targetUserEmail: 'otro_usuario@example.com',
        reason: 'Investigación de bug reportado',
        ipAddress: '10.0.0.50',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        sessionId: 'session_002',
        duration: '30m',
        status: 'COMPLETED'
      }
    ];

    // Aplicar filtros básicos
    let filteredRecords = allRecords;

    if (filters.adminId) {
      filteredRecords = filteredRecords.filter(r => r.adminId === filters.adminId);
    }

    if (filters.targetUserId) {
      filteredRecords = filteredRecords.filter(r => r.targetUserId === filters.targetUserId);
    }

    if (filters.startDate) {
      const start = new Date(filters.startDate as string);
      filteredRecords = filteredRecords.filter(r => new Date(r.timestamp) >= start);
    }

    if (filters.endDate) {
      const end = new Date(filters.endDate as string);
      filteredRecords = filteredRecords.filter(r => new Date(r.timestamp) <= end);
    }

    // Aplicar paginación
    const total = filteredRecords.length;
    const paginatedRecords = filteredRecords
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(offset, offset + limit);

    return {
      records: paginatedRecords,
      total
    };
  }

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