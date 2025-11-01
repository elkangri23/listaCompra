import type { Request, Response } from 'express';
import { GetAuditHistoryForList } from '@application/use-cases/audit/GetAuditHistoryForList';
import { GetAuditHistoryForProduct } from '@application/use-cases/audit/GetAuditHistoryForProduct';
import { GetGlobalAuditHistory } from '@application/use-cases/audit/GetGlobalAuditHistory';
import { ValidationError } from '@application/errors/ValidationError';

type ChangeType = 'CREATE' | 'UPDATE' | 'DELETE';

interface ParsedQueryParams {
  page?: number;
  pageSize?: number;
  changeType?: ChangeType;
  changedByUserId?: string;
  startDate?: Date;
  endDate?: Date;
}

export class AuditController {
  constructor(
    private readonly getAuditHistoryForList: GetAuditHistoryForList,
    private readonly getAuditHistoryForProduct: GetAuditHistoryForProduct,
    private readonly getGlobalAuditHistory: GetGlobalAuditHistory
  ) {}

  private parseNumber(value: unknown): number | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? undefined : parsed;
  }

  private parseDate(value: unknown): Date | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }

  private parseChangeType(value: unknown): ChangeType | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    if (value === 'CREATE' || value === 'UPDATE' || value === 'DELETE') {
      return value;
    }

    return undefined;
  }

  private parseQueryParams(req: Request): ParsedQueryParams {
    const page = this.parseNumber(req.query['page']);
    const pageSize = this.parseNumber(req.query['pageSize']);
    const changeType = this.parseChangeType(req.query['changeType']);
    const changedByUserId =
      typeof req.query['changedByUserId'] === 'string' ? req.query['changedByUserId'] : undefined;
    const startDate = this.parseDate(req.query['startDate']);
    const endDate = this.parseDate(req.query['endDate']);

    return {
      ...(page !== undefined && { page }),
      ...(pageSize !== undefined && { pageSize }),
      ...(changeType && { changeType }),
      ...(changedByUserId && { changedByUserId }),
      ...(startDate && { startDate }),
      ...(endDate && { endDate }),
    };
  }

  /**
   * GET /api/v1/audit/lists/:listId
   * Obtiene el historial de auditoria para una lista especifica.
   */
  async getListAuditHistory(req: Request, res: Response): Promise<Response> {
    const listId = req.params['listId'];

    if (!listId) {
      return res.status(400).json({
        status: 'error',
        message: 'El identificador de la lista es requerido',
      });
    }

    const queryParams = this.parseQueryParams(req);
    const result = await this.getAuditHistoryForList.execute({
      listId,
      ...queryParams,
    });

    if (result.isFailure) {
      if (result.error instanceof ValidationError) {
        return res.status(400).json({
          status: 'error',
          message: result.error.message,
          errors: result.error.toJSON(),
        });
      }

      return res.status(500).json({
        status: 'error',
        message: result.error.message,
      });
    }

    return res.status(200).json({
      status: 'success',
      data: result.value,
    });
  }

  /**
   * GET /api/v1/audit/products/:productId
   * Obtiene el historial de auditoria para un producto especifico.
   */
  async getProductAuditHistory(req: Request, res: Response): Promise<Response> {
    const productId = req.params['productId'];

    if (!productId) {
      return res.status(400).json({
        status: 'error',
        message: 'El identificador del producto es requerido',
      });
    }

    const queryParams = this.parseQueryParams(req);
    const result = await this.getAuditHistoryForProduct.execute({
      productId,
      ...queryParams,
    });

    if (result.isFailure) {
      if (result.error instanceof ValidationError) {
        return res.status(400).json({
          status: 'error',
          message: result.error.message,
          errors: result.error.toJSON(),
        });
      }

      return res.status(500).json({
        status: 'error',
        message: result.error.message,
      });
    }

    return res.status(200).json({
      status: 'success',
      data: result.value,
    });
  }

  /**
   * GET /api/v1/admin/audit
   * Obtiene el historial de auditoria global (solo para administradores).
   */
  async getGlobalAuditHistoryRoute(req: Request, res: Response): Promise<Response> {
    const queryParams = this.parseQueryParams(req);
    const entityType =
      typeof req.query['entityType'] === 'string' ? req.query['entityType'].trim() : undefined;
    const entityId = typeof req.query['entityId'] === 'string' ? req.query['entityId'].trim() : undefined;

    const result = await this.getGlobalAuditHistory.execute({
      ...(queryParams.page !== undefined && { page: queryParams.page }),
      ...(queryParams.pageSize !== undefined && { pageSize: queryParams.pageSize }),
      ...(queryParams.changeType && { changeType: queryParams.changeType }),
      ...(queryParams.changedByUserId && { changedByUserId: queryParams.changedByUserId }),
      ...(queryParams.startDate && { startDate: queryParams.startDate }),
      ...(queryParams.endDate && { endDate: queryParams.endDate }),
      ...(entityType && { entityType }),
      ...(entityId && { entityId }),
    });

    if (result.isFailure) {
      if (result.error instanceof ValidationError) {
        return res.status(400).json({
          status: 'error',
          message: result.error.message,
          errors: result.error.toJSON(),
        });
      }

      return res.status(500).json({
        status: 'error',
        message: result.error.message,
      });
    }

    return res.status(200).json({
      status: 'success',
      data: result.value,
    });
  }
}
