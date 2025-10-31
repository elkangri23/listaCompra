/**
 * Middleware de validación usando Zod
 */

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

export interface ValidationSchema {
  body?: z.ZodSchema;
  params?: z.ZodSchema;
  query?: z.ZodSchema;
}

export function validationMiddleware(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Validar el objeto completo (req)
      const validationResult = schema.safeParse(req);

      if (!validationResult.success) {
        const errors = validationResult.error.errors.map(error => ({
          field: error.path.join('.'),
          message: error.message,
          code: error.code
        }));

        res.status(400).json({
          success: false,
          error: 'VALIDATION_ERROR',
          message: 'Los datos proporcionados no son válidos',
          details: errors,
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Si la validación es exitosa, continuar
      next();
    } catch (error) {
      console.error('Error en validationMiddleware:', error);
      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'Error interno del servidor',
        timestamp: new Date().toISOString()
      });
    }
  };
}