/**
 * Middleware de autorización por roles con validaciones de seguridad reforzadas
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
    emailVerificado?: boolean;
    activo?: boolean;
  };
}

/**
 * Middleware para validar que el usuario tenga uno de los roles requeridos
 * Incluye validaciones de seguridad mejoradas
 * @param allowedRoles Array de roles permitidos para acceder al endpoint
 * @returns Middleware function
 */
export const requireRole = (allowedRoles: RolUsuario[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    try {
      // VALIDACIÓN 1: Usuario autenticado
      if (!req.user) {
        logger.security('Intento de acceso sin autenticación a endpoint protegido', {
          path: req.path,
          method: req.method,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          timestamp: new Date().toISOString()
        });
        
        res.status(401).json({
          error: 'Token de autenticación requerido',
          code: 'AUTH_TOKEN_REQUIRED'
        });
        return;
      }

      // VALIDACIÓN 2: Datos del usuario completos
      if (!req.user.id || !req.user.email || !req.user.rol) {
        logger.security('Usuario con datos incompletos intentando acceder', {
          userId: req.user.id || 'undefined',
          email: req.user.email || 'undefined',
          rol: req.user.rol || 'undefined',
          path: req.path,
          method: req.method,
          ip: req.ip
        });
        
        res.status(401).json({
          error: 'Datos de usuario incompletos',
          code: 'INCOMPLETE_USER_DATA'
        });
        return;
      }

      // VALIDACIÓN 3: Usuario activo (si está disponible)
      if (req.user.activo === false) {
        logger.security('Usuario inactivo intentando acceder', {
          userId: req.user.id,
          email: req.user.email,
          path: req.path,
          method: req.method,
          ip: req.ip
        });
        
        res.status(403).json({
          error: 'Cuenta de usuario inactiva',
          code: 'INACTIVE_USER'
        });
        return;
      }

      // VALIDACIÓN 4: Rol válido y permitido
      if (!Object.values(RolUsuario).includes(req.user.rol)) {
        logger.security('Usuario con rol inválido', {
          userId: req.user.id,
          email: req.user.email,
          invalidRole: req.user.rol,
          path: req.path,
          method: req.method,
          ip: req.ip
        });
        
        res.status(403).json({
          error: 'Rol de usuario inválido',
          code: 'INVALID_USER_ROLE'
        });
        return;
      }

      // VALIDACIÓN 5: Rol suficiente para el endpoint
      if (!allowedRoles.includes(req.user.rol)) {
        logger.security('Intento de escalación de privilegios', {
          userId: req.user.id,
          userEmail: req.user.email,
          userRole: req.user.rol,
          requiredRoles: allowedRoles,
          path: req.path,
          method: req.method,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          timestamp: new Date().toISOString()
        });
        
        res.status(403).json({
          error: 'Rol insuficiente para acceder a este recurso',
          code: 'INSUFFICIENT_ROLE',
          requiredRoles: allowedRoles
        });
        return;
      }

      // Log del acceso autorizado para auditoría
      logger.security('Acceso autorizado a endpoint protegido', {
        userId: req.user.id,
        userEmail: req.user.email,
        userRole: req.user.rol,
        path: req.path,
        method: req.method,
        ip: req.ip,
        timestamp: new Date().toISOString()
      });

      next();
    } catch (error) {
      logger.error('Error crítico en middleware de autorización por rol', {
        error: error instanceof Error ? error.message : 'Error desconocido',
        stack: error instanceof Error ? error.stack : undefined,
        path: req.path,
        method: req.method,
        userId: req.user?.id,
        userEmail: req.user?.email,
        ip: req.ip,
        timestamp: new Date().toISOString()
      });
      
      res.status(500).json({
        error: 'Error interno del servidor',
        code: 'INTERNAL_SERVER_ERROR'
      });
    }
  };
};

/**
 * Middleware específico para validar rol de administrador con verificaciones adicionales
 */
export const requireAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  try {
    // Todas las validaciones del requireRole más validaciones específicas de admin
    const roleCheck = requireRole([RolUsuario.ADMIN]);
    
    // Ejecutar validaciones base primero
    roleCheck(req, res, (error?: any) => {
      if (error) {
        return; // Ya se manejó el error en requireRole
      }
      
      // Validaciones específicas de administrador
      if (!req.user) {
        logger.security('Error crítico: usuario undefined después de validación de rol', {
          path: req.path,
          method: req.method,
          ip: req.ip
        });
        
        res.status(500).json({
          error: 'Error interno del servidor',
          code: 'INTERNAL_SERVER_ERROR'
        });
        return;
      }

      // DOBLE VERIFICACIÓN: Confirmar que es REALMENTE administrador
      if (req.user.rol !== RolUsuario.ADMIN) {
        logger.security('CRÍTICO: Bypass de validación de rol admin detectado', {
          userId: req.user.id,
          userEmail: req.user.email,
          userRole: req.user.rol,
          path: req.path,
          method: req.method,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          timestamp: new Date().toISOString()
        });
        
        res.status(403).json({
          error: 'Acceso denegado - Requiere rol administrador',
          code: 'ADMIN_ROLE_REQUIRED'
        });
        return;
      }

      // Verificación adicional: Email verificado para operaciones críticas
      if (req.user.emailVerificado === false) {
        logger.security('Administrador con email no verificado intentando acceso', {
          userId: req.user.id,
          userEmail: req.user.email,
          path: req.path,
          method: req.method,
          ip: req.ip
        });
        
        res.status(403).json({
          error: 'Email no verificado - Requerido para operaciones administrativas',
          code: 'EMAIL_NOT_VERIFIED'
        });
        return;
      }

      // Log específico de acceso administrativo
      logger.security('Acceso administrativo autorizado', {
        adminId: req.user.id,
        adminEmail: req.user.email,
        path: req.path,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString()
      });

      next();
    });
  } catch (error) {
    logger.error('Error crítico en middleware requireAdmin', {
      error: error instanceof Error ? error.message : 'Error desconocido',
      stack: error instanceof Error ? error.stack : undefined,
      path: req.path,
      method: req.method,
      userId: req.user?.id,
      ip: req.ip,
      timestamp: new Date().toISOString()
    });
    
    res.status(500).json({
      error: 'Error interno del servidor',
      code: 'INTERNAL_SERVER_ERROR'
    });
  }
};

/**
 * Middleware para validar múltiples roles (administrador o usuario específico) con seguridad reforzada
 */
export const requireAdminOrOwner = (getOwnerId: (req: AuthenticatedRequest) => string) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    try {
      // VALIDACIÓN 1: Autenticación básica
      if (!req.user || !req.user.id || !req.user.email || !req.user.rol) {
        logger.security('Acceso sin autenticación válida en requireAdminOrOwner', {
          path: req.path,
          method: req.method,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          timestamp: new Date().toISOString()
        });
        
        res.status(401).json({
          error: 'Token de autenticación requerido',
          code: 'AUTH_TOKEN_REQUIRED'
        });
        return;
      }

      // VALIDACIÓN 2: Usuario activo
      if (req.user.activo === false) {
        logger.security('Usuario inactivo intentando acceso en requireAdminOrOwner', {
          userId: req.user.id,
          email: req.user.email,
          path: req.path,
          method: req.method,
          ip: req.ip
        });
        
        res.status(403).json({
          error: 'Cuenta de usuario inactiva',
          code: 'INACTIVE_USER'
        });
        return;
      }

      // VALIDACIÓN 3: Rol válido
      if (!Object.values(RolUsuario).includes(req.user.rol)) {
        logger.security('Rol inválido en requireAdminOrOwner', {
          userId: req.user.id,
          invalidRole: req.user.rol,
          path: req.path,
          method: req.method,
          ip: req.ip
        });
        
        res.status(403).json({
          error: 'Rol de usuario inválido',
          code: 'INVALID_USER_ROLE'
        });
        return;
      }

      // OPCIÓN A: Si es admin, permitir acceso (con validación robusta)
      if (req.user.rol === RolUsuario.ADMIN) {
        // Doble verificación para administradores
        if (req.user.emailVerificado === false) {
          logger.security('Admin con email no verificado intentando acceso privilegiado', {
            adminId: req.user.id,
            adminEmail: req.user.email,
            path: req.path,
            method: req.method,
            ip: req.ip
          });
          
          res.status(403).json({
            error: 'Email no verificado - Requerido para operaciones administrativas',
            code: 'EMAIL_NOT_VERIFIED'
          });
          return;
        }

        logger.security('Acceso administrativo autorizado en requireAdminOrOwner', {
          adminId: req.user.id,
          adminEmail: req.user.email,
          path: req.path,
          method: req.method,
          ip: req.ip,
          timestamp: new Date().toISOString()
        });
        return next();
      }

      // OPCIÓN B: Si no es admin, verificar que sea el propietario del recurso
      let ownerId: string;
      try {
        ownerId = getOwnerId(req);
      } catch (error) {
        logger.security('Error extrayendo ID del propietario', {
          userId: req.user.id,
          error: error instanceof Error ? error.message : String(error),
          path: req.path,
          method: req.method,
          ip: req.ip
        });
        
        res.status(400).json({
          error: 'Error validando propietario del recurso',
          code: 'OWNER_VALIDATION_ERROR'
        });
        return;
      }

      // Validación estricta del ID del propietario
      if (!ownerId || typeof ownerId !== 'string' || ownerId.trim() === '') {
        logger.security('ID de propietario inválido o vacío', {
          userId: req.user.id,
          ownerId: ownerId,
          path: req.path,
          method: req.method,
          ip: req.ip
        });
        
        res.status(400).json({
          error: 'ID del propietario del recurso inválido',
          code: 'INVALID_OWNER_ID'
        });
        return;
      }

      // Verificación de propietario con validación estricta
      if (req.user.id === ownerId.trim()) {
        logger.security('Acceso de propietario autorizado', {
          userId: req.user.id,
          userEmail: req.user.email,
          resourceOwnerId: ownerId,
          path: req.path,
          method: req.method,
          ip: req.ip,
          timestamp: new Date().toISOString()
        });
        return next();
      }

      // ACCESO DENEGADO - Log de intento de acceso no autorizado
      logger.security('ACCESO DENEGADO: Usuario no es admin ni propietario', {
        userId: req.user.id,
        userEmail: req.user.email,
        userRole: req.user.rol,
        resourceOwnerId: ownerId,
        path: req.path,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString()
      });

      res.status(403).json({
        error: 'Acceso denegado: debe ser administrador o propietario del recurso',
        code: 'ACCESS_DENIED'
      });
    } catch (error) {
      logger.error('Error crítico en middleware requireAdminOrOwner', {
        error: error instanceof Error ? error.message : 'Error desconocido',
        stack: error instanceof Error ? error.stack : undefined,
        path: req.path,
        method: req.method,
        userId: req.user?.id,
        userEmail: req.user?.email,
        ip: req.ip,
        timestamp: new Date().toISOString()
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