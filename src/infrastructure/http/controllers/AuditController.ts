import { Request, Response } from 'express';
import { GetAuditHistoryForList } from '../../../application/use-cases/audit/GetAuditHistoryForList';
import { GetAuditHistoryForProduct } from '../../../application/use-cases/audit/GetAuditHistoryForProduct';
import { GetGlobalAuditHistory } from '../../../application/use-cases/audit/GetGlobalAuditHistory';
import { ValidationError } from '../../../application/errors/ValidationError';

export class AuditController {
  constructor(
    private readonly getAuditHistoryForList: GetAuditHistoryForList,
    private readonly getAuditHistoryForProduct: GetAuditHistoryForProduct,
    private readonly getGlobalAuditHistory: GetGlobalAuditHistory
  ) {}

  private parseQueryParams(req: Request) {
    const page = req.query.page ? parseInt(req.query.page as string) : undefined;
    const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string) : undefined;
    const changeType = req.query.changeType as 'CREATE' | 'UPDATE' | 'DELETE' | undefined;
    const changedByUserId = req.query.changedByUserId as string | undefined;
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
    return { page, pageSize, changeType, changedByUserId, startDate, endDate };
  }

  /**
   * GET /api/v1/audit/lists/:listId
   * Obtiene el historial de auditoría para una lista específica.
   */
  async getListAuditHistory(req: Request, res: Response): Promise<Response> {
    const { listId } = req.params;
    const { page, pageSize, changeType, changedByUserId, startDate, endDate } = this.parseQueryParams(req);

    const result = await this.getAuditHistoryForList.execute({
      listId,
      page,
      pageSize,
      changeType,
      changedByUserId,
      startDate,
      endDate,
    });

    if (result.isFailure) {
      if (result.error instanceof ValidationError) {
        return res.status(400).json({ status: 'error', message: result.error.message, errors: result.error.toJSON() });
      }
      return res.status(500).json({ status: 'error', message: result.error.message });
    }

    return res.status(200).json({ status: 'success', data: result.value });
  }

  /**
   * GET /api/v1/audit/products/:productId
   * Obtiene el historial de auditoría para un producto específico.
   */
  async getProductAuditHistory(req: Request, res: Response): Promise<Response> {
    const { productId } = req.params;
    const { page, pageSize, changeType, changedByUserId, startDate, endDate } = this.parseQueryParams(req);

    const result = await this.getAuditHistoryForProduct.execute({
      productId,
      page,
      pageSize,
      changeType,
      changedByUserId,
      startDate,
      endDate,
    });

    if (result.isFailure) {
      if (result.error instanceof ValidationError) {
        return res.status(400).json({ status: 'error', message: result.error.message, errors: result.error.toJSON() });
      }
      return res.status(500).json({ status: 'error', message: result.error.message });
    }

    return res.status(200).json({ status: 'success', data: result.value });
  }

  /**
   * GET /api/v1/admin/audit
   * Obtiene el historial de auditoría global (solo para administradores).
   */
  async getGlobalAuditHistory(req: Request, res: Response): Promise<Response> {
    const { page, pageSize, changeType, changedByUserId, startDate, endDate } = this.parseQueryParams(req);
    const entityType = req.query.entityType as string | undefined;
    const entityId = req.query.entityId as string | undefined;

    const result = await this.getGlobalAuditHistory.execute({
      page,
      pageSize,
      entityType,
      entityId,
      changeType,
      changedByUserId,
      startDate,
      endDate,
    });

    if (result.isFailure) {
      if (result.error instanceof ValidationError) {
        return res.status(400).json({ status: 'error', message: result.error.message, errors: result.error.toJSON() });
      }
      return res.status(500).json({ status: 'error', message: result.error.message });
    }

    return res.status(200).json({ status: 'success', data: result.value });
  }
}
