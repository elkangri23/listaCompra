import { Request, Response } from 'express';
import { CreateBlueprint } from '@application/use-cases/blueprints/CreateBlueprint';
import type { CreateListFromBlueprint } from '@application/use-cases/blueprints/CreateListFromBlueprint';
import type { IBlueprintRepository } from '@application/ports/repositories/IBlueprintRepository';
import { ValidationError } from '@application/errors/ValidationError';
import { NotFoundError } from '@application/errors/NotFoundError';
import { UnauthorizedError } from '@application/errors/UnauthorizedError';

// Interface para requests autenticados
interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
    rol: string;
  };
}

export class BlueprintController {
  constructor(
    private readonly createBlueprintUseCase: CreateBlueprint,
    private readonly createListFromBlueprintUseCase: CreateListFromBlueprint,
    private readonly blueprintRepository: IBlueprintRepository
  ) {}

  /**
   * Crear un nuevo blueprint
   * POST /api/blueprints
   */
  async crear(req: Request, res: Response): Promise<void> {
    try {
      const authReq = req as AuthenticatedRequest; const userId = authReq.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Usuario no autenticado' });
        return;
      }

      // Validación simple
      if (!req.body.nombre || !req.body.productos) {
        res.status(400).json({ error: 'Datos inválidos' });
        return;
      }

      const dto = {
        nombre: req.body.nombre,
        descripcion: req.body.descripcion,
        productos: req.body.productos.map((p: any) => ({
          nombre: p.nombre,
          descripcion: p.notas,
          cantidad: p.cantidad,
          categoriaId: p.categoriaId,
          urgente: false
        }))
      };

      const result = await this.createBlueprintUseCase.execute(dto, userId);

      if (!result.isSuccess) {
        const error = result.getError();
        if (error instanceof ValidationError) {
          res.status(400).json({ error: error.message });
          return;
        }
        res.status(500).json({ error: 'Error interno del servidor' });
        return;
      }

      const response = result.getValue();
      res.status(201).json(response);
    } catch (error) {
      console.error('Error creando blueprint:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  /**
   * Obtener blueprints del usuario
   * GET /api/blueprints
   */
  async obtenerPorUsuario(req: Request, res: Response): Promise<void> {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Usuario no autenticado' });
        return;
      }

      const result = await this.blueprintRepository.findByUsuarioId(userId);

      if (!result.isSuccess) {
        res.status(500).json({ error: 'Error obteniendo blueprints' });
        return;
      }

      const paginatedResult = result.getValue();
      const blueprints = paginatedResult.items.map(blueprint => ({
        id: blueprint.id,
        nombre: blueprint.nombre,
        descripcion: blueprint.descripcion,
        publico: blueprint.publico,
        productosCount: blueprint.productos.length,
        fechaCreacion: blueprint.fechaCreacion,
        fechaActualizacion: blueprint.fechaActualizacion,
        creadoPorId: blueprint.creadoPorId
      }));

      res.json({ 
        blueprints
      });
    } catch (error) {
      console.error('Error obteniendo blueprints:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  /**
   * Obtener blueprints públicos
   * GET /api/blueprints/publicos
   */
  async obtenerPublicos(req: Request, res: Response): Promise<void> {
    try {
      const pagina = parseInt(req.query['pagina'] as string) || 1;
      const limite = Math.min(parseInt(req.query['limite'] as string) || 10, 50);

      const result = await this.blueprintRepository.findAll(
        { page: pagina, limit: limite },
        { activo: true }
      );

      if (!result.isSuccess) {
        res.status(500).json({ error: 'Error obteniendo blueprints públicos' });
        return;
      }

      const paginatedResult = result.getValue();
      const blueprints = paginatedResult.items.map(blueprint => ({
        id: blueprint.id,
        nombre: blueprint.nombre,
        descripcion: blueprint.descripcion,
        publico: blueprint.publico,
        productosCount: blueprint.productos.length,
        fechaCreacion: blueprint.fechaCreacion,
        fechaActualizacion: blueprint.fechaActualizacion,
        creadoPorId: blueprint.creadoPorId
      }));

      res.json({ 
        blueprints, 
        pagina: paginatedResult.page, 
        limite: paginatedResult.limit,
        total: paginatedResult.total,
        totalPages: paginatedResult.totalPages
      });
    } catch (error) {
      console.error('Error obteniendo blueprints públicos:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  /**
   * Obtener blueprint por ID
   * GET /api/blueprints/:id
   */
  async obtenerPorId(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params; if (!id) { res.status(400).json({ error: "ID requerido" }); return; }
      const authReq = req as AuthenticatedRequest; const userId = authReq.user?.id;

      const result = await this.blueprintRepository.findById(id);

      if (!result.isSuccess) {
        res.status(500).json({ error: 'Error obteniendo blueprint' });
        return;
      }

      const blueprint = result.getValue();
      if (!blueprint) {
        res.status(404).json({ error: 'Blueprint no encontrado' });
        return;
      }

      // Verificar permisos: debe ser público o del usuario
      if (!blueprint.publico && blueprint.creadoPorId !== userId) {
        res.status(403).json({ error: 'No tienes permisos para ver este blueprint' });
        return;
      }

      res.json({
        id: blueprint.id,
        nombre: blueprint.nombre,
        descripcion: blueprint.descripcion,
        publico: blueprint.publico,
        productos: blueprint.productos,
        fechaCreacion: blueprint.fechaCreacion,
        fechaActualizacion: blueprint.fechaActualizacion,
        creadoPorId: blueprint.creadoPorId
      });
    } catch (error) {
      console.error('Error obteniendo blueprint:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  /**
   * Buscar blueprints
   * GET /api/blueprints/buscar
   */
  async buscar(req: Request, res: Response): Promise<void> {
    try {
      const termino = req.query['q'] as string;
      if (!termino || termino.trim().length < 2) {
        res.status(400).json({ error: 'El término de búsqueda debe tener al menos 2 caracteres' });
        return;
      }

      const authReq = req as AuthenticatedRequest; const userId = authReq.user?.id;
      const pagina = parseInt(req.query['pagina'] as string) || 1;
      const limite = Math.min(parseInt(req.query['limite'] as string) || 10, 50);

      const result = await this.blueprintRepository.findByNombre(
        termino.trim(), 
        userId || '', 
        { page: pagina, limit: limite }
      );

      if (!result.isSuccess) {
        res.status(500).json({ error: 'Error realizando búsqueda' });
        return;
      }

      const paginatedResult = result.getValue();
      const blueprints = paginatedResult.items.map(blueprint => ({
        id: blueprint.id,
        nombre: blueprint.nombre,
        descripcion: blueprint.descripcion,
        publico: blueprint.publico,
        productosCount: blueprint.productos.length,
        fechaCreacion: blueprint.fechaCreacion,
        fechaActualizacion: blueprint.fechaActualizacion,
        creadoPorId: blueprint.creadoPorId
      }));

      res.json({ 
        blueprints, 
        termino, 
        pagina: paginatedResult.page, 
        limite: paginatedResult.limit,
        total: paginatedResult.total,
        totalPages: paginatedResult.totalPages
      });
    } catch (error) {
      console.error('Error en búsqueda:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  /**
   * Crear lista desde blueprint
   * POST /api/blueprints/:id/crear-lista
   */
  async crearListaDesdeBlueprint(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params; if (!id) { res.status(400).json({ error: "ID requerido" }); return; }
      const authReq = req as AuthenticatedRequest; const userId = authReq.user?.id;

      if (!userId) {
        res.status(401).json({ error: 'Usuario no autenticado' });
        return;
      }

      // Validación simple
      if (!req.body.nombreLista) {
        res.status(400).json({ error: 'Datos inválidos' });
        return;
      }

      const dto = {
        blueprintId: id,
        nombreLista: req.body.nombreLista,
        descripcionLista: req.body.descripcionLista,
        tiendaId: req.body.tiendaId
      };

      const result = await this.createListFromBlueprintUseCase.execute(dto, userId);

      if (!result.isSuccess) {
        const error = result.getError();
        if (error instanceof NotFoundError) {
          res.status(404).json({ error: error.message });
          return;
        }
        if (error instanceof UnauthorizedError) {
          res.status(403).json({ error: error.message });
          return;
        }
        if (error instanceof ValidationError) {
          res.status(400).json({ error: error.message });
          return;
        }
        res.status(500).json({ error: 'Error interno del servidor' });
        return;
      }

      const response = result.getValue();
      res.status(201).json(response);
    } catch (error) {
      console.error('Error creando lista desde blueprint:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  /**
   * Actualizar blueprint
   * PUT /api/blueprints/:id
   */
  async actualizar(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params; if (!id) { res.status(400).json({ error: "ID requerido" }); return; }
      const authReq = req as AuthenticatedRequest; const userId = authReq.user?.id;

      if (!userId) {
        res.status(401).json({ error: 'Usuario no autenticado' });
        return;
      }

      // Validación simple
      if (!req.body.nombre || !req.body.productos) {
        res.status(400).json({ error: 'Datos inválidos' });
        return;
      }

      // Verificar que existe y pertenece al usuario
      const existingResult = await this.blueprintRepository.findById(id);
      if (!existingResult.isSuccess) {
        res.status(500).json({ error: 'Error verificando blueprint' });
        return;
      }

      const existing = existingResult.getValue();
      if (!existing) {
        res.status(404).json({ error: 'Blueprint no encontrado' });
        return;
      }

      if (existing.creadoPorId !== userId) {
        res.status(403).json({ error: 'No tienes permisos para modificar este blueprint' });
        return;
      }

      // Actualizar
      const updateResult = existing.actualizar(
        req.body.nombre,
        req.body.descripcion,
        req.body.publico,
        req.body.productos
      );

      if (!updateResult.isSuccess) {
        res.status(400).json({ error: updateResult.getError().message });
        return;
      }

      const updatedBlueprint = updateResult.getValue();
      const saveResult = await this.blueprintRepository.save(updatedBlueprint);

      if (!saveResult.isSuccess) {
        res.status(500).json({ error: 'Error guardando cambios' });
        return;
      }

      const blueprint = saveResult.getValue();
      res.json({
        id: blueprint.id,
        nombre: blueprint.nombre,
        descripcion: blueprint.descripcion,
        publico: blueprint.publico,
        productos: blueprint.productos,
        fechaCreacion: blueprint.fechaCreacion,
        fechaActualizacion: blueprint.fechaActualizacion,
        creadoPorId: blueprint.creadoPorId
      });
    } catch (error) {
      console.error('Error actualizando blueprint:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }

  /**
   * Eliminar blueprint
   * DELETE /api/blueprints/:id
   */
  async eliminar(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params; if (!id) { res.status(400).json({ error: "ID requerido" }); return; }
      const authReq = req as AuthenticatedRequest; const userId = authReq.user?.id;

      if (!userId) {
        res.status(401).json({ error: 'Usuario no autenticado' });
        return;
      }

      // Verificar que existe y pertenece al usuario
      const existingResult = await this.blueprintRepository.findById(id);
      if (!existingResult.isSuccess) {
        res.status(500).json({ error: 'Error verificando blueprint' });
        return;
      }

      const existing = existingResult.getValue();
      if (!existing) {
        res.status(404).json({ error: 'Blueprint no encontrado' });
        return;
      }

      if (existing.creadoPorId !== userId) {
        res.status(403).json({ error: 'No tienes permisos para eliminar este blueprint' });
        return;
      }

      const deleteResult = await this.blueprintRepository.deleteById(id);
      if (!deleteResult.isSuccess) {
        res.status(500).json({ error: 'Error eliminando blueprint' });
        return;
      }

      res.status(204).send();
    } catch (error) {
      console.error('Error eliminando blueprint:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
}
