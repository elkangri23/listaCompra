/**
 * Controlador HTTP para operaciones con listas
 */

import type { Request, Response } from 'express';
import { CreateList } from '@application/use-cases/lists/CreateList';
import { GetUserLists } from '@application/use-cases/lists/GetUserLists';
import { UpdateList } from '@application/use-cases/lists/UpdateList';
import { DeleteList } from '@application/use-cases/lists/DeleteList';
import { GetListById } from '@application/use-cases/lists/GetListById';
import type { CreateListDto } from '@application/dto/lists/CreateListDto';
import type { UpdateListDto } from '@application/dto/lists/UpdateListDto';
import type { DeleteListDto } from '@application/dto/lists/DeleteListDto';
import type { GetUserListsDto, ListaSortOption } from '@application/dto/lists/GetUserListsDto';
import { ValidationError } from '@application/errors/ValidationError';
import { NotFoundError } from '@application/errors/NotFoundError';
import { UnauthorizedError } from '@application/errors/UnauthorizedError';
import { RealTimeGateway } from '@infrastructure/realtime/RealTimeGateway';

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    userId?: string;
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
    private readonly deleteList: DeleteList,
    private readonly getListById: GetListById,
    private readonly realTimeGateway: RealTimeGateway
  ) {}

  private getUserId(req: AuthenticatedRequest): string | undefined {
    return req.user?.id ?? req.user?.userId;
  }

  /**
   * POST /lists - Crear nueva lista
   */
  async create(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = this.getUserId(req);
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

      this.realTimeGateway.publish({
        listId: result.value.id,
        type: 'LIST_CREATED',
        payload: result.value,
        actorId: userId,
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
      const userId = this.getUserId(req);
      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Usuario no autenticado',
          code: 'UNAUTHORIZED'
        });
        return;
      }

      const activaParam = req.query['activa'];
      const tiendaIdParam = req.query['tiendaId'];
      const busquedaParam = (req.query['busqueda'] ?? req.query['search'] ?? req.query['q']) as string | undefined;
      const fechaCreacionDesdeParam = (req.query['fechaCreacionDesde'] ?? req.query['fechaDesde']) as string | undefined;
      const fechaCreacionHastaParam = (req.query['fechaCreacionHasta'] ?? req.query['fechaHasta']) as string | undefined;
      const fechaActualizacionDesdeParam = (req.query['fechaActualizacionDesde'] ?? req.query['actualizadaDesde']) as string | undefined;
      const fechaActualizacionHastaParam = (req.query['fechaActualizacionHasta'] ?? req.query['actualizadaHasta']) as string | undefined;
      const sortParam = (req.query['sort'] ?? req.query['orden']) as string | string[] | undefined;
      const sortOptions = this.parseSortParam(sortParam);

      const dto: GetUserListsDto = {
        page: parseInt(req.query['page'] as string, 10) || 1,
        limit: parseInt(req.query['limit'] as string, 10) || 10,
      };

      if (typeof activaParam === 'string') {
        dto.activa = activaParam === 'true';
      }

      if (typeof tiendaIdParam === 'string') {
        const tiendaId = tiendaIdParam.trim();
        if (tiendaId.length > 0) {
          dto.tiendaId = tiendaId;
        }
      }

      if (busquedaParam) {
        const busqueda = busquedaParam.trim();
        if (busqueda.length > 0) {
          dto.busqueda = busqueda;
        }
      }

      if (fechaCreacionDesdeParam) {
        dto.fechaCreacionDesde = fechaCreacionDesdeParam;
      }

      if (fechaCreacionHastaParam) {
        dto.fechaCreacionHasta = fechaCreacionHastaParam;
      }

      if (fechaActualizacionDesdeParam) {
        dto.fechaActualizacionDesde = fechaActualizacionDesdeParam;
      }

      if (fechaActualizacionHastaParam) {
        dto.fechaActualizacionHasta = fechaActualizacionHastaParam;
      }

      if (sortOptions) {
        dto.sort = sortOptions;
      }

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
      const userId = this.getUserId(req);
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

      this.realTimeGateway.publish({
        listId: result.value.id,
        type: 'LIST_UPDATED',
        payload: result.value,
        actorId: userId,
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
      const userId = this.getUserId(req);
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

      this.realTimeGateway.publish({
        listId: result.value.id,
        type: 'LIST_DELETED',
        payload: result.value,
        actorId: userId,
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
      const userId = this.getUserId(req);
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

      const result = await this.getListById.execute({ id: listaId }, userId);

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

  private parseSortParam(sortParam: string | string[] | undefined): ListaSortOption[] | undefined {
    if (!sortParam) {
      return undefined;
    }

    const rawValues = Array.isArray(sortParam) ? sortParam : sortParam.split(',');
    const sortOptions: ListaSortOption[] = [];

    for (const rawValue of rawValues) {
      const trimmed = rawValue.trim();
      if (!trimmed) {
        continue;
      }

      const [fieldRaw, directionRaw] = trimmed.split(':').map(part => part.trim());
      if (!fieldRaw) {
        continue;
      }

      const directionValue = directionRaw?.toLowerCase() === 'desc' ? 'desc' : 'asc';

      sortOptions.push({
        field: fieldRaw as ListaSortOption['field'],
        direction: directionValue,
      });
    }

    return sortOptions.length > 0 ? sortOptions : undefined;
  }

  /**
   * GET /lists/:id/stream - Suscribir a eventos SSE de una lista
   */
  async stream(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = this.getUserId(req);
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

      const result = await this.getListById.execute({ id: listaId }, userId);

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

      this.realTimeGateway.subscribe(listaId, userId, res);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        code: 'INTERNAL_ERROR'
      });
    }
  }
}