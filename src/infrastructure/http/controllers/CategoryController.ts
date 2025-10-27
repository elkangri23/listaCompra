/**
 * Controlador HTTP para la gestión de categorías
 * Maneja los endpoints REST para las operaciones CRUD de categorías
 */

import type { Request, Response } from 'express';
import { InvalidValueError, BusinessRuleViolationError } from '@domain/errors/DomainError';
import type { CreateCategory } from '@application/use-cases/categories/CreateCategory';
import type { GetCategoriesByStore } from '@application/use-cases/categories/GetCategoriesByStore';
import type { UpdateCategory } from '@application/use-cases/categories/UpdateCategory';
import type { DeleteCategory } from '@application/use-cases/categories/DeleteCategory';
import type {
  CreateCategoryDto,
  UpdateCategoryDto,
  DeleteCategoryDto,
  GetCategoriesByStoreDto
} from '@application/dto/categories';

export class CategoryController {
  constructor(
    private readonly createCategoryUseCase: CreateCategory,
    private readonly getCategoriesByStoreUseCase: GetCategoriesByStore,
    private readonly updateCategoryUseCase: UpdateCategory,
    private readonly deleteCategoryUseCase: DeleteCategory
  ) {}

  /**
   * POST /api/categories
   * Crear una nueva categoría
   */
  async create(req: Request, res: Response): Promise<void> {
    try {
      const dto: CreateCategoryDto = {
        nombre: req.body.nombre,
        descripcion: req.body.descripcion,
        color: req.body.color,
        icono: req.body.icono,
        tiendaId: req.body.tiendaId,
      };

      const result = await this.createCategoryUseCase.execute(dto);

      if (result.isFailure) {
        this.handleError(res, result.error);
        return;
      }

      res.status(201).json({
        success: true,
        message: 'Categoría creada exitosamente',
        data: result.value,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: error instanceof Error ? error.message : 'Error desconocido',
      });
    }
  }

  /**
   * GET /api/categories
   * Obtener categorías por tienda o categorías generales
   */
  public async getByStore(req: Request, res: Response): Promise<void> {
    try {
      const tiendaId = req.query['tiendaId'] as string | undefined;
      const activas = req.query['activas'] as string | undefined;
      const includeInactive = req.query['includeInactive'] === 'true';

      const dto: GetCategoriesByStoreDto = {
        ...(tiendaId && { tiendaId }),
        ...(activas === 'true' && { activas: true }),
        ...(activas === 'false' && { activas: false }),
        includeInactive,
      };

      const result = await this.getCategoriesByStoreUseCase.execute(dto);

      if (result.isFailure) {
        this.handleError(res, result.error);
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Categorías obtenidas exitosamente',
        data: result.value,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: error instanceof Error ? error.message : 'Error desconocido',
      });
    }
  }

  /**
   * PUT /api/categories/:id
   * Actualizar una categoría existente
   */
  async update(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params['id'];
      if (!id) {
        res.status(400).json({
          success: false,
          error: 'ID de categoría requerido'
        });
        return;
      }

      const dto: UpdateCategoryDto = {
        id,
        nombre: req.body.nombre,
        descripcion: req.body.descripcion,
        color: req.body.color,
        icono: req.body.icono,
        activa: req.body.activa,
        tiendaId: req.body.tiendaId,
      };

      const result = await this.updateCategoryUseCase.execute(dto);

      if (result.isFailure) {
        this.handleError(res, result.error);
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Categoría actualizada exitosamente',
        data: result.value,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: error instanceof Error ? error.message : 'Error desconocido',
      });
    }
  }

  /**
   * DELETE /api/categories/:id
   * Eliminar una categoría
   */
  async delete(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params['id'];
      if (!id) {
        res.status(400).json({
          success: false,
          error: 'ID de categoría requerido'
        });
        return;
      }

      const dto: DeleteCategoryDto = {
        id,
      };

      const result = await this.deleteCategoryUseCase.execute(dto);

      if (result.isFailure) {
        this.handleError(res, result.error);
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Categoría eliminada exitosamente',
        data: { deleted: result.value },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: error instanceof Error ? error.message : 'Error desconocido',
      });
    }
  }

  /**
   * PATCH /api/categories/:id/toggle-status
   * Cambiar el estado activo/inactivo de una categoría
   */
  async toggleStatus(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params['id'];
      if (!id) {
        res.status(400).json({
          success: false,
          error: 'ID de categoría requerido'
        });
        return;
      }

      const dto: UpdateCategoryDto = {
        id,
        activa: req.body.activa,
      };

      const result = await this.updateCategoryUseCase.execute(dto);

      if (result.isFailure) {
        this.handleError(res, result.error);
        return;
      }

      const status = result.value.activa ? 'activada' : 'desactivada';
      res.status(200).json({
        success: true,
        message: `Categoría ${status} exitosamente`,
        data: result.value,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: error instanceof Error ? error.message : 'Error desconocido',
      });
    }
  }

  /**
   * PUT /api/categories/:id/move-to-store
   * Mover una categoría a otra tienda
   */
  async moveToStore(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params['id'];
      if (!id) {
        res.status(400).json({
          success: false,
          error: 'ID de categoría requerido'
        });
        return;
      }

      const dto: UpdateCategoryDto = {
        id,
        tiendaId: req.body.tiendaId,
      };

      const result = await this.updateCategoryUseCase.execute(dto);

      if (result.isFailure) {
        this.handleError(res, result.error);
        return;
      }

      const destination = req.body.tiendaId ? 'tienda especificada' : 'categorías generales';
      res.status(200).json({
        success: true,
        message: `Categoría movida a ${destination} exitosamente`,
        data: result.value,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error interno del servidor',
        error: error instanceof Error ? error.message : 'Error desconocido',
      });
    }
  }

  /**
   * Maneja los errores de dominio y aplicación mapeándolos a códigos HTTP apropiados
   */
  private handleError(res: Response, error: InvalidValueError | BusinessRuleViolationError): void {
    if (error instanceof InvalidValueError) {
      res.status(400).json({
        success: false,
        message: 'Datos inválidos',
        error: {
          type: 'VALIDATION_ERROR',
          message: error.message,
          field: error.field,
          value: error.value,
        },
      });
      return;
    }

    if (error instanceof BusinessRuleViolationError) {
      let statusCode = 409; // Conflict por defecto

      // Mapear códigos específicos de reglas de negocio
      switch (error.rule) {
        case 'CATEGORIA_DUPLICADA':
          statusCode = 409; // Conflict
          break;
        case 'TIENDA_INACTIVA':
          statusCode = 422; // Unprocessable Entity
          break;
        case 'CATEGORIA_CON_PRODUCTOS':
          statusCode = 422; // Unprocessable Entity
          break;
        default:
          statusCode = 400; // Bad Request por defecto
      }

      res.status(statusCode).json({
        success: false,
        message: 'Regla de negocio violada',
        error: {
          type: 'BUSINESS_RULE_VIOLATION',
          message: error.message,
          rule: error.rule,
        },
      });
      return;
    }

    // Error genérico
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
      error: {
        type: 'INTERNAL_ERROR',
        message: 'Error desconocido',
      },
    });
  }
}