/**
 * Controlador HTTP para operaciones con listas
 */

import type { Request, Response } from 'express';
import { CreateList } from '@application/use-cases/lists/CreateList';
import { GetUserLists } from '@application/use-cases/lists/GetUserLists';
import { UpdateList } from '@application/use-cases/lists/UpdateList';
import { DeleteList } from '@application/use-cases/lists/DeleteList';
import type { CreateListDto } from '@application/dto/lists/CreateListDto';
import type { UpdateListDto } from '@application/dto/lists/UpdateListDto';
import type { DeleteListDto } from '@application/dto/lists/DeleteListDto';
import type { GetUserListsDto } from '@application/dto/lists/GetUserListsDto';
import { ValidationError } from '@application/errors/ValidationError';
import { NotFoundError } from '@application/errors/NotFoundError';
import { UnauthorizedError } from '@application/errors/UnauthorizedError';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    nombre: string;
    rol: string;
  };
}

export class ListController {
  constructor(
    private readonly createList: CreateList,
    private readonly getUserListsUseCase: GetUserLists,
    private readonly updateList: UpdateList,
    private readonly deleteList: DeleteList
  ) {}

  /**
   * POST /lists - Crear nueva lista
   */
  async create(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Usuario no autenticado',
          code: 'UNAUTHORIZED'
        });
        return;
      }

      const dto: CreateListDto = req.body;
      
      const result = await this.createList.execute(dto, userId);
      
      if (result.isFailure) {
        if (result.error instanceof ValidationError) {
          res.status(400).json({
            success: false,
            error: result.error.message,
            field: result.error.field,
            code: 'VALIDATION_ERROR'
          });
          return;
        }

        res.status(500).json({
          success: false,
          error: 'Error interno del servidor',
          code: 'INTERNAL_ERROR'
        });
        return;
      }

      res.status(201).json({
        success: true,
        data: result.value
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * GET /lists - Obtener listas del usuario
   */
  async getUserLists(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Usuario no autenticado',
          code: 'UNAUTHORIZED'
        });
        return;
      }

      const activaParam = req.query['activa'] as string;
      const dto: GetUserListsDto = {
        page: parseInt(req.query['page'] as string) || 1,
        limit: parseInt(req.query['limit'] as string) || 10,
        ...(activaParam && { activa: activaParam === 'true' }),
        ...(req.query['tiendaId'] && { tiendaId: req.query['tiendaId'] as string }),
      };

      const result = await this.getUserListsUseCase.execute(dto, userId);
      
      if (result.isFailure) {
        if (result.error instanceof ValidationError) {
          res.status(400).json({
            success: false,
            error: result.error.message,
            field: result.error.field,
            code: 'VALIDATION_ERROR'
          });
          return;
        }

        res.status(500).json({
          success: false,
          error: 'Error interno del servidor',
          code: 'INTERNAL_ERROR'
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: result.value
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * PUT /lists/:id - Actualizar lista
   */
  async update(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Usuario no autenticado',
          code: 'UNAUTHORIZED'
        });
        return;
      }

      const listaId = req.params['id'];
      if (!listaId) {
        res.status(400).json({
          success: false,
          error: 'ID de lista requerido',
          code: 'VALIDATION_ERROR'
        });
        return;
      }

      const dto: UpdateListDto = req.body;
      
      const result = await this.updateList.execute(listaId, dto, userId);
      
      if (result.isFailure) {
        if (result.error instanceof ValidationError) {
          res.status(400).json({
            success: false,
            error: result.error.message,
            field: result.error.field,
            code: 'VALIDATION_ERROR'
          });
          return;
        }

        if (result.error instanceof NotFoundError) {
          res.status(404).json({
            success: false,
            error: result.error.message,
            code: 'NOT_FOUND'
          });
          return;
        }

        if (result.error instanceof UnauthorizedError) {
          res.status(403).json({
            success: false,
            error: result.error.message,
            code: 'FORBIDDEN'
          });
          return;
        }

        res.status(500).json({
          success: false,
          error: 'Error interno del servidor',
          code: 'INTERNAL_ERROR'
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: result.value
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * DELETE /lists/:id - Eliminar lista
   */
  async delete(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Usuario no autenticado',
          code: 'UNAUTHORIZED'
        });
        return;
      }

      const listaId = req.params['id'];
      if (!listaId) {
        res.status(400).json({
          success: false,
          error: 'ID de lista requerido',
          code: 'VALIDATION_ERROR'
        });
        return;
      }

      const dto: DeleteListDto = {
        permanente: req.query['permanente'] === 'true'
      };
      
      const result = await this.deleteList.execute(listaId, dto, userId);
      
      if (result.isFailure) {
        if (result.error instanceof ValidationError) {
          res.status(400).json({
            success: false,
            error: result.error.message,
            field: result.error.field,
            code: 'VALIDATION_ERROR'
          });
          return;
        }

        if (result.error instanceof NotFoundError) {
          res.status(404).json({
            success: false,
            error: result.error.message,
            code: 'NOT_FOUND'
          });
          return;
        }

        if (result.error instanceof UnauthorizedError) {
          res.status(403).json({
            success: false,
            error: result.error.message,
            code: 'FORBIDDEN'
          });
          return;
        }

        res.status(500).json({
          success: false,
          error: 'Error interno del servidor',
          code: 'INTERNAL_ERROR'
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: result.value
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  /**
   * GET /lists/:id - Obtener lista por ID
   */
  async getById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Usuario no autenticado',
          code: 'UNAUTHORIZED'
        });
        return;
      }

      const listaId = req.params['id'];
      if (!listaId) {
        res.status(400).json({
          success: false,
          error: 'ID de lista requerido',
          code: 'VALIDATION_ERROR'
        });
        return;
      }

      // TODO: Implementar caso de uso GetListById
      // Por ahora devolvemos un placeholder
      res.status(501).json({
        success: false,
        error: 'Funcionalidad no implementada aún',
        code: 'NOT_IMPLEMENTED'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        code: 'INTERNAL_ERROR'
      });
    }
  }
}