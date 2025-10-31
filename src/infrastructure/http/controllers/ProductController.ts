/**
 * Controlador HTTP para la gestión de productos
 * Simplificado para funcionar con las firmas correctas de los casos de uso
 */

import { Response } from 'express';
import { AuthenticatedRequest } from '../types/express';
import { AddProduct } from '../../../application/use-cases/products/AddProduct';
import { UpdateProduct } from '../../../application/use-cases/products/UpdateProduct';
import { MarkProductAsPurchased } from '../../../application/use-cases/products/MarkProductAsPurchased';
import { DeleteProduct } from '../../../application/use-cases/products/DeleteProduct';
import { GetProducts } from '../../../application/use-cases/products/GetProducts';
import { 
  AddProductDto, 
  UpdateProductDto, 
  MarkAsPurchasedDto, 
  DeleteProductDto, 
  GetProductsDto 
} from '../../../application/dto/products';
import { ValidationError } from '../../../application/errors/ValidationError';
import { UnauthorizedError } from '../../../application/errors/UnauthorizedError';
import { NotFoundError } from '../../../application/errors/NotFoundError';

export class ProductController {
  constructor(
    private addProductUseCase: AddProduct,
    private updateProductUseCase: UpdateProduct,
    private markProductAsPurchasedUseCase: MarkProductAsPurchased,
    private deleteProductUseCase: DeleteProduct,
    private getProductsUseCase: GetProducts
  ) {}

  /**
   * POST /lists/:listaId/products
   */
  async addProductToList(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { listaId } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({ success: false, error: 'Usuario no autenticado' });
        return;
      }

      if (!listaId) {
        res.status(400).json({ success: false, error: 'ID de lista requerido' });
        return;
      }

      const dto: AddProductDto = {
        nombre: req.body.nombre,
        descripcion: req.body.descripcion,
        cantidad: req.body.cantidad,
        unidad: req.body.unidad,
        precio: req.body.precio,
        urgente: req.body.urgente,
        categoriaId: req.body.categoriaId,
        listaId
      };

      const result = await this.addProductUseCase.execute(dto, userId);

      if (result.isFailure) {
        this.handleError(result.error, res);
        return;
      }

      res.status(201).json({ success: true, data: result.value });
    } catch (error) {
      console.error('Error en addProductToList:', error);
      res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
  }

  /**
   * PUT /lists/:listaId/products/:productId
   */
  async updateProductInList(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { listaId, productId } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({ success: false, error: 'Usuario no autenticado' });
        return;
      }

      if (!listaId || !productId) {
        res.status(400).json({ success: false, error: 'ID de lista y producto requeridos' });
        return;
      }

      const dto: UpdateProductDto = {
        nombre: req.body.nombre,
        descripcion: req.body.descripcion,
        cantidad: req.body.cantidad,
        unidad: req.body.unidad,
        precio: req.body.precio,
        urgente: req.body.urgente,
        categoriaId: req.body.categoriaId
      };

      const result = await this.updateProductUseCase.execute(productId, dto, userId);

      if (result.isFailure) {
        this.handleError(result.error, res);
        return;
      }

      res.status(200).json({ success: true, data: result.value });
    } catch (error) {
      console.error('Error en updateProductInList:', error);
      res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
  }

  /**
   * PATCH /lists/:listaId/products/:productId/purchased
   */
  async markProductAsPurchased(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { listaId, productId } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({ success: false, error: 'Usuario no autenticado' });
        return;
      }

      if (!listaId || !productId) {
        res.status(400).json({ success: false, error: 'ID de lista y producto requeridos' });
        return;
      }

      const dto: MarkAsPurchasedDto = {
        comprado: req.body.comprado ?? true
      };

      const result = await this.markProductAsPurchasedUseCase.execute(productId, dto, userId);

      if (result.isFailure) {
        this.handleError(result.error, res);
        return;
      }

      res.status(200).json({ success: true, data: result.value });
    } catch (error) {
      console.error('Error en markProductAsPurchased:', error);
      res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
  }

  /**
   * DELETE /lists/:listaId/products/:productId
   */
  async deleteProductFromList(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { listaId, productId } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({ success: false, error: 'Usuario no autenticado' });
        return;
      }

      if (!listaId || !productId) {
        res.status(400).json({ success: false, error: 'ID de lista y producto requeridos' });
        return;
      }

      const dto: DeleteProductDto = {};

      const result = await this.deleteProductUseCase.execute(productId, dto, userId);

      if (result.isFailure) {
        this.handleError(result.error, res);
        return;
      }

      res.status(200).json({ success: true, message: 'Producto eliminado correctamente' });
    } catch (error) {
      console.error('Error en deleteProductFromList:', error);
      res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
  }

  /**
   * GET /lists/:listaId/products
   */
  async getProductsFromList(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { listaId } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({ success: false, error: 'Usuario no autenticado' });
        return;
      }

      if (!listaId) {
        res.status(400).json({ success: false, error: 'ID de lista requerido' });
        return;
      }

      const queryPage = req.query['page'] ? parseInt(req.query['page'] as string) : undefined;
      const queryLimit = req.query['limit'] ? parseInt(req.query['limit'] as string) : undefined;
      const queryComprado = req.query['comprado'] === 'true' ? true : req.query['comprado'] === 'false' ? false : undefined;
      const queryUrgente = req.query['urgente'] === 'true' ? true : req.query['urgente'] === 'false' ? false : undefined;
      const queryCategoriaId = req.query['categoriaId'] as string;
      const queryBusqueda = req.query['busqueda'] as string;

      const dto: GetProductsDto = {
        listaId,
        ...(queryComprado !== undefined && { comprado: queryComprado }),
        ...(queryUrgente !== undefined && { urgente: queryUrgente }),
        ...(queryCategoriaId && { categoriaId: queryCategoriaId }),
        ...(queryBusqueda && { busqueda: queryBusqueda }),
        ...(queryPage !== undefined && { page: queryPage }),
        ...(queryLimit !== undefined && { limit: queryLimit })
      };

      const result = await this.getProductsUseCase.execute(dto, userId);

      if (result.isFailure) {
        this.handleError(result.error, res);
        return;
      }

      res.status(200).json({ success: true, data: result.value });
    } catch (error) {
      console.error('Error en getProductsFromList:', error);
      res.status(500).json({ success: false, error: 'Error interno del servidor' });
    }
  }

  /**
   * Maneja errores comunes de forma centralizada
   */
  private handleError(error: Error, res: Response): void {
    if (error instanceof UnauthorizedError) {
      res.status(403).json({
        success: false,
        error: error.message
      });
    } else if (error instanceof ValidationError) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    } else if (error instanceof NotFoundError) {
      res.status(404).json({
        success: false,
        error: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor'
      });
    }
  }
}