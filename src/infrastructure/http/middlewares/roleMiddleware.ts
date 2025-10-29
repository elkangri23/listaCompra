/**
 * Middleware de autorización por roles
 * Valida que el usuario tenga el rol requerido para acceder a endpoints protegidos
 */

import { Request, Response, NextFunction } from 'express';
import { RolUsuario } from '@domain/entities/Usuario';
import { Logger } from '@infrastructure/observability/logger/Logger';

const logger = new Logger('RoleMiddleware');

export interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
    rol: RolUsuario;
    nombre?: string;
  };
}

/**
 * Middleware para validar que el usuario tenga uno de los roles requeridos
 * @param allowedRoles Array de roles permitidos para acceder al endpoint
 * @returns Middleware function
 */
export const requireRole = (allowedRoles: RolUsuario[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    try {
      // Verificar que el usuario esté autenticado
      if (!req.user) {
        logger.warn('Intento de acceso sin autenticación a endpoint protegido por rol', {
          path: req.path,
          method: req.method,
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });
        
        res.status(401).json({
          error: 'Token de autenticación requerido',
          code: 'AUTH_TOKEN_REQUIRED'
        });
        return;
      }

      // Verificar que el usuario tenga uno de los roles permitidos
      if (!allowedRoles.includes(req.user.rol)) {
        logger.warn('Intento de acceso no autorizado por rol insuficiente', {
          userId: req.user.id,
          userEmail: req.user.email,
          userRole: req.user.rol,
          requiredRoles: allowedRoles,
          path: req.path,
          method: req.method,
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });
        
        res.status(403).json({
          error: 'Rol insuficiente para acceder a este recurso',
          code: 'INSUFFICIENT_ROLE',
          requiredRoles: allowedRoles
        });
        return;
      }

      // Log del acceso autorizado para auditoría
      logger.info('Acceso autorizado a endpoint protegido por rol', {
        userId: req.user.id,
        userEmail: req.user.email,
        userRole: req.user.rol,
        path: req.path,
        method: req.method,
        ip: req.ip
      });

      next();
    } catch (error) {
      logger.error('Error en middleware de autorización por rol', {
        error: error instanceof Error ? error.message : 'Error desconocido',
        stack: error instanceof Error ? error.stack : undefined,
        path: req.path,
        method: req.method,
        userId: req.user?.id
      });
      
      res.status(500).json({
        error: 'Error interno del servidor',
        code: 'INTERNAL_SERVER_ERROR'
      });
    }
  };
};

/**
 * Middleware específico para validar rol de administrador
 */
export const requireAdmin = requireRole([RolUsuario.ADMIN]);

/**
 * Middleware para validar múltiples roles (administrador o usuario específico)
 */
export const requireAdminOrOwner = (getOwnerId: (req: AuthenticatedRequest) => string) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    try {
      // Verificar autenticación
      if (!req.user) {
        res.status(401).json({
          error: 'Token de autenticación requerido',
          code: 'AUTH_TOKEN_REQUIRED'
        });
        return;
      }

      // Si es admin, permitir acceso
      if (req.user.rol === RolUsuario.ADMIN) {
        logger.info('Acceso de administrador autorizado', {
          userId: req.user.id,
          path: req.path,
          method: req.method
        });
        return next();
      }

      // Si no es admin, verificar que sea el propietario del recurso
      const ownerId = getOwnerId(req);
      if (req.user.id === ownerId) {
        logger.info('Acceso de propietario autorizado', {
          userId: req.user.id,
          resourceOwnerId: ownerId,
          path: req.path,
          method: req.method
        });
        return next();
      }

      // Acceso denegado
      logger.warn('Acceso denegado: no es admin ni propietario del recurso', {
        userId: req.user.id,
        userRole: req.user.rol,
        resourceOwnerId: ownerId,
        path: req.path,
        method: req.method
      });

      res.status(403).json({
        error: 'Acceso denegado: debe ser administrador o propietario del recurso',
        code: 'ACCESS_DENIED'
      });
    } catch (error) {
      logger.error('Error en middleware requireAdminOrOwner', {
        error: error instanceof Error ? error.message : 'Error desconocido',
        stack: error instanceof Error ? error.stack : undefined,
        path: req.path,
        method: req.method,
        userId: req.user?.id
      });
      
      res.status(500).json({
        error: 'Error interno del servidor',
        code: 'INTERNAL_SERVER_ERROR'
      });
    }
  };
};

/**
 * Helper para extraer el ID del propietario de los parámetros de la request
 */
export const extractOwnerIdFromParams = (paramName: string = 'userId') => {
  return (req: AuthenticatedRequest): string => {
    return req.params[paramName] || '';
  };
};

/**
 * Helper para extraer el ID del propietario del cuerpo de la request
 */
export const extractOwnerIdFromBody = (fieldName: string = 'userId') => {
  return (req: AuthenticatedRequest): string => {
    return req.body[fieldName] || '';
  };
};