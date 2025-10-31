/**
 * Middleware para controles de privacidad de Blueprints
 * Implementa validaciones adicionales de acceso y privacidad
 */

import { Request, Response, NextFunction } from 'express';
import type { IBlueprintRepository } from '@application/ports/repositories/IBlueprintRepository';
import { Logger } from '@infrastructure/observability/logger/Logger';

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    role: string;
  };
}

interface BlueprintPrivacyRequest extends AuthenticatedRequest {
  blueprint?: {
    id: string;
    creadoPorId: string;
    publico: boolean;
  };
}

export class BlueprintPrivacyMiddleware {
  constructor(
    private readonly blueprintRepository: IBlueprintRepository,
    private readonly logger: Logger
  ) {}

  /**
   * Middleware para verificar acceso a blueprint específico
   */
  checkBlueprintAccess = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as BlueprintPrivacyRequest;
      const userId = authReq.user?.id;
      const { id: blueprintId } = req.params;

      if (!userId) {
        res.status(401).json({ 
          error: 'Usuario no autenticado',
          code: 'UNAUTHORIZED'
        });
        return;
      }

      if (!blueprintId) {
        res.status(400).json({ 
          error: 'ID de blueprint requerido',
          code: 'MISSING_BLUEPRINT_ID'
        });
        return;
      }

      // Buscar blueprint
      const blueprintResult = await this.blueprintRepository.findById(blueprintId);
      
      if (!blueprintResult.isSuccess) {
        this.logger.warn(`Intento de acceso a blueprint inexistente: ${blueprintId}`, {
          userId,
          blueprintId,
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });
        
        res.status(404).json({ 
          error: 'Blueprint no encontrado',
          code: 'BLUEPRINT_NOT_FOUND'
        });
        return;
      }

      const blueprint = blueprintResult.getValue();

      // Verificar permisos de acceso
      const hasAccess = this.checkUserAccess(blueprint, userId, authReq.user.role);
      
      if (!hasAccess) {
        this.logger.warn(`Intento de acceso no autorizado a blueprint privado`, {
          userId,
          blueprintId,
          blueprintOwnerId: blueprint?.creadoPorId,
          isPublic: blueprint?.publico,
          userRole: authReq.user.role,
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });

        res.status(403).json({ 
          error: 'No tienes permisos para acceder a este blueprint',
          code: 'ACCESS_DENIED'
        });
        return;
      }

      // Adjuntar blueprint al request para uso posterior
      authReq.blueprint = {
        id: blueprint!.id,
        creadoPorId: blueprint!.creadoPorId,
        publico: blueprint!.publico
      };

      this.logger.info(`Acceso autorizado a blueprint`, {
        userId,
        blueprintId,
        isOwner: blueprint!.creadoPorId === userId,
        isPublic: blueprint!.publico
      });

      next();
    } catch (error) {
      this.logger.error('Error en middleware de privacidad de blueprint', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        userId: (req as AuthenticatedRequest).user?.id,
        blueprintId: req.params['id']
      });

      res.status(500).json({ 
        error: 'Error interno del servidor',
        code: 'INTERNAL_ERROR'
      });
    }
  };

  /**
   * Middleware para verificar permisos de escritura en blueprint
   */
  checkBlueprintWriteAccess = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Primero verificar acceso general
    await this.checkBlueprintAccess(req, res, () => {
      const authReq = req as BlueprintPrivacyRequest;
      const userId = authReq.user?.id;
      const blueprint = authReq.blueprint;

      if (!blueprint) {
        res.status(500).json({ 
          error: 'Error de configuración de middleware',
          code: 'MIDDLEWARE_ERROR'
        });
        return;
      }

      // Solo el propietario puede modificar
      if (blueprint.creadoPorId !== userId && authReq.user.role !== 'ADMIN') {
        this.logger.warn(`Intento de modificación no autorizada de blueprint`, {
          userId,
          blueprintId: blueprint.id,
          blueprintOwnerId: blueprint.creadoPorId,
          userRole: authReq.user.role,
          ip: req.ip
        });

        res.status(403).json({ 
          error: 'Solo el propietario puede modificar este blueprint',
          code: 'WRITE_ACCESS_DENIED'
        });
        return;
      }

      next();
    });
  };

  /**
   * Middleware para filtrar blueprints públicos
   */
  enforcePublicOnlyAccess = (req: Request, _res: Response, next: NextFunction): void => {
    // Agregar filtro de solo públicos a la query
    (req.query as any).publicOnly = 'true';
    next();
  };

  /**
   * Middleware para logging de accesos sensibles
   */
  logSensitiveAccess = (operation: string) => {
    return (req: Request, _res: Response, next: NextFunction): void => {
      const authReq = req as AuthenticatedRequest;
      
      this.logger.info(`Operación sensible en blueprint: ${operation}`, {
        operation,
        userId: authReq.user?.id,
        userRole: authReq.user?.role,
        blueprintId: req.params['id'],
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString()
      });

      next();
    };
  };

  /**
   * Verifica si un usuario tiene acceso a un blueprint
   */
  private checkUserAccess(blueprint: any, userId: string, userRole: string): boolean {
    // Administradores tienen acceso total
    if (userRole === 'ADMIN') {
      return true;
    }

    // Propietario tiene acceso total
    if (blueprint.creadoPorId === userId) {
      return true;
    }

    // Para otros usuarios, solo blueprints públicos
    return blueprint.publico;
  }

  /**
   * Obtiene estadísticas de accesos a blueprints
   */
  async getAccessStats(): Promise<{
    totalAccesses: number;
    unauthorizedAttempts: number;
    publicAccesses: number;
    privateAccesses: number;
  }> {
    // En una implementación real, esto vendría de métricas almacenadas
    return {
      totalAccesses: 0,
      unauthorizedAttempts: 0,
      publicAccesses: 0,
      privateAccesses: 0
    };
  }
}

/**
 * Factory para crear el middleware de privacidad
 */
export const createBlueprintPrivacyMiddleware = (
  blueprintRepository: IBlueprintRepository,
  logger: Logger
): BlueprintPrivacyMiddleware => {
  return new BlueprintPrivacyMiddleware(blueprintRepository, logger);
};