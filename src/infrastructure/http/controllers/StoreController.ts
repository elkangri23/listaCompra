/**
 * Controlador HTTP para la gestión de tiendas
 * Maneja los endpoints REST para las operaciones CRUD de tiendas
 */

import type { Request, Response } from 'express';
import { InvalidValueError, BusinessRuleViolationError } from '@domain/errors/DomainError';
import type { CreateStore } from '@application/use-cases/stores/CreateStore';
import type { GetStores } from '@application/use-cases/stores/GetStores';
import type { UpdateStore } from '@application/use-cases/stores/UpdateStore';
import type { DeleteStore } from '@application/use-cases/stores/DeleteStore';
import type {
  CreateStoreDto,
  UpdateStoreDto,
  DeleteStoreDto,
  GetStoresDto
} from '@application/dto/stores';

export class StoreController {
  constructor(
    private readonly createStoreUseCase: CreateStore,
    private readonly getStoresUseCase: GetStores,
    private readonly updateStoreUseCase: UpdateStore,
    private readonly deleteStoreUseCase: DeleteStore
  ) {}

  /**
   * POST /api/stores
   * Crear una nueva tienda
   */
  async create(req: Request, res: Response): Promise<void> {
    try {
      const dto: CreateStoreDto = {
        nombre: req.body.nombre,
        direccion: req.body.direccion,
        telefono: req.body.telefono,
        sitioWeb: req.body.sitioWeb,
      };

      const result = await this.createStoreUseCase.execute(dto);

      if (result.isFailure) {
        this.handleError(res, result.error);
        return;
      }

      res.status(201).json({
        success: true,
        data: result.value,
        message: 'Tienda creada exitosamente',
      });
    } catch (error: unknown) {
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        message: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  }

  /**
   * GET /api/stores
   * Obtener todas las tiendas con filtros opcionales
   */
  async getAll(req: Request, res: Response): Promise<void> {
    try {
      const page = req.query['page'] ? parseInt(req.query['page'] as string) : undefined;
      const limit = req.query['limit'] ? parseInt(req.query['limit'] as string) : undefined;
      const tipo = req.query['tipo'] as string | undefined;
      const activas = req.query['activas'] as string | undefined;
      const search = req.query['search'] as string | undefined;

      const dto: GetStoresDto = {
        ...(page && { page }),
        ...(limit && { limit }),
        ...(tipo && { tipo }),
        ...(activas === 'true' && { activas: true }),
        ...(activas === 'false' && { activas: false }),
        ...(search && { search }),
      };

      const result = await this.getStoresUseCase.execute(dto);

      if (result.isFailure) {
        this.handleError(res, result.error);
        return;
      }

      res.status(200).json({
        success: true,
        data: result.value,
        message: 'Tiendas obtenidas exitosamente',
      });
    } catch (error: unknown) {
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        message: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  }

  /**
   * GET /api/stores/:id
   * Obtener una tienda por ID
   */
  async getById(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params['id'];
      if (!id) {
        res.status(400).json({
          success: false,
          error: 'ID de tienda requerido'
        });
        return;
      }

      const dto: GetStoresDto = { id };

      const result = await this.getStoresUseCase.execute(dto);

      if (result.isFailure) {
        this.handleError(res, result.error);
        return;
      }

      if (!result.value || (Array.isArray(result.value.tiendas) && result.value.tiendas.length === 0)) {
        res.status(404).json({
          success: false,
          error: 'Tienda no encontrada'
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: result.value.tiendas[0],
        message: 'Tienda obtenida exitosamente',
      });
    } catch (error: unknown) {
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        message: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  }

  /**
   * PUT /api/stores/:id
   * Actualizar una tienda existente
   */
  async update(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params['id'];
      if (!id) {
        res.status(400).json({
          success: false,
          error: 'ID de tienda requerido'
        });
        return;
      }

      const dto: UpdateStoreDto = {
        id,
        nombre: req.body.nombre,
        direccion: req.body.direccion,
        telefono: req.body.telefono,
        sitioWeb: req.body.sitioWeb,
        activa: req.body.activa,
      };

      const result = await this.updateStoreUseCase.execute(dto);

      if (result.isFailure) {
        this.handleError(res, result.error);
        return;
      }

      res.status(200).json({
        success: true,
        data: result.value,
        message: 'Tienda actualizada exitosamente',
      });
    } catch (error: unknown) {
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        message: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  }

  /**
   * DELETE /api/stores/:id
   * Eliminar una tienda
   */
  async delete(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params['id'];
      if (!id) {
        res.status(400).json({
          success: false,
          error: 'ID de tienda requerido'
        });
        return;
      }

      const dto: DeleteStoreDto = {
        id,
      };

      const result = await this.deleteStoreUseCase.execute(dto);

      if (result.isFailure) {
        this.handleError(res, result.error);
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Tienda eliminada exitosamente',
      });
    } catch (error: unknown) {
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        message: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  }

  /**
   * PATCH /api/stores/:id/toggle-status
   * Cambiar el estado activo/inactivo de una tienda
   */
  async toggleStatus(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params['id'];
      if (!id) {
        res.status(400).json({
          success: false,
          error: 'ID de tienda requerido'
        });
        return;
      }

      const dto: UpdateStoreDto = {
        id,
        activa: req.body.activa,
      };

      const result = await this.updateStoreUseCase.execute(dto);

      if (result.isFailure) {
        this.handleError(res, result.error);
        return;
      }

      res.status(200).json({
        success: true,
        data: result.value,
        message: 'Estado de tienda actualizado exitosamente',
      });
    } catch (error: unknown) {
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        message: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  }

  /**
   * GET /api/stores/:id/categories
   * Obtener categorías de una tienda específica
   */
  async getCategories(req: Request, res: Response): Promise<void> {
    try {
      const tiendaId = req.params['id'];
      if (!tiendaId) {
        res.status(400).json({
          success: false,
          error: 'ID de tienda requerido'
        });
        return;
      }

      // Redirigir a CategoryController con tiendaId como query param
      req.query['tiendaId'] = tiendaId;
      
      // Esto debería ser manejado por el router, aquí solo devolvemos un mensaje indicativo
      res.status(200).json({
        success: true,
        message: 'Usar endpoint /api/categories?tiendaId=' + tiendaId,
      });
    } catch (error: unknown) {
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        message: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  }

  /**
   * Maneja los errores de dominio y aplicación de forma centralizada
   */
  private handleError(res: Response, error: InvalidValueError | BusinessRuleViolationError): void {
    if (error instanceof InvalidValueError) {
      res.status(400).json({
        success: false,
        error: 'Datos inválidos',
        message: error.message,
        details: {
          field: error.field,
          value: error.value,
        },
      });
    } else if (error instanceof BusinessRuleViolationError) {
      res.status(409).json({
        success: false,
        error: 'Violación de regla de negocio',
        message: error.message,
        details: {
          rule: error.rule,
        },
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        message: 'Ha ocurrido un error inesperado',
      });
    }
  }
}