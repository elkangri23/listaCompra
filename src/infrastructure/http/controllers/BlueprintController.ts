import { Request, Response } from 'express';
import '../types/express.d.ts';
import { CreateBlueprint } from '../../../application/use-cases/blueprints/CreateBlueprint';
import { CreateListFromBlueprint } from '../../../application/use-cases/blueprints/CreateListFromBlueprint';
import { IBlueprintRepository } from '../../../application/ports/repositories/IBlueprintRepository';
import { CreateBlueprintDto } from '../../../application/dto/blueprints/CreateBlueprintDto';
import { CreateListFromBlueprintDto } from '../../../application/dto/blueprints/CreateListFromBlueprintDto';
import { ValidationError } from '../../../application/errors/ValidationError';
import { NotFoundError } from '../../../application/errors/NotFoundError';
import { UnauthorizedError } from '../../../application/errors/UnauthorizedError';
import { z } from 'zod';

// Interface para requests autenticados
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    rol: string;
  };
}

// Esquemas de validación
const createBlueprintSchema = z.object({
  nombre: z.string().min(1, 'El nombre es requerido').max(100, 'El nombre es muy largo'),
  descripcion: z.string().max(500, 'La descripción es muy larga').optional(),
  publico: z.boolean().default(false),
  productos: z.array(z.object({
    nombre: z.string().min(1, 'El nombre del producto es requerido'),
    cantidad: z.number().min(1, 'La cantidad debe ser mayor a 0'),
    notas: z.string().optional(),
    categoriaId: z.string().optional()
  })).min(1, 'Debe incluir al menos un producto')
});

const createListFromBlueprintSchema = z.object({
  nombre: z.string().min(1, 'El nombre de la lista es requerido').max(100, 'El nombre es muy largo'),
  descripcion: z.string().max(500, 'La descripción es muy larga').optional()
});

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
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Usuario no autenticado' });
        return;
      }

      // Validar datos de entrada
      const validationResult = createBlueprintSchema.safeParse(req.body);
      if (!validationResult.success) {
        res.status(400).json({
          error: 'Datos inválidos',
          details: validationResult.error.errors
        });
        return;
      }

      const dto: CreateBlueprintDto = {
        ...validationResult.data,
        creadoPorId: userId
      };

      const result = await this.createBlueprintUseCase.execute(dto);

      if (!result.isSuccess()) {
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
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Usuario no autenticado' });
        return;
      }

      const pagina = parseInt(req.query['pagina'] as string) || 1;
      const limite = Math.min(parseInt(req.query['limite'] as string) || 10, 50);

      const result = await this.blueprintRepository.findByUsuarioId(
        userId, 
        { page: pagina, limit: limite }
      );

      if (!result.isSuccess()) {
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
        blueprints, 
        pagina: paginatedResult.page, 
        limite: paginatedResult.limit,
        total: paginatedResult.total,
        totalPages: paginatedResult.totalPages
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
        { publico: true }
      );

      if (!result.isSuccess()) {
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
      const { id } = req.params;
      const userId = req.user?.id;

      const result = await this.blueprintRepository.findById(id);

      if (!result.isSuccess()) {
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

      const userId = req.user?.id;
      const pagina = parseInt(req.query['pagina'] as string) || 1;
      const limite = Math.min(parseInt(req.query['limite'] as string) || 10, 50);

      const result = await this.blueprintRepository.findByNombre(
        termino.trim(), 
        userId || '', 
        { page: pagina, limit: limite }
      );

      if (!result.isSuccess()) {
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
      const { id } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ error: 'Usuario no autenticado' });
        return;
      }

      // Validar datos de entrada
      const validationResult = createListFromBlueprintSchema.safeParse(req.body);
      if (!validationResult.success) {
        res.status(400).json({
          error: 'Datos inválidos',
          details: validationResult.error.errors
        });
        return;
      }

      const dto: CreateListFromBlueprintDto = {
        blueprintId: id,
        nombre: validationResult.data.nombre,
        descripcion: validationResult.data.descripcion,
        usuarioId: userId
      };

      const result = await this.createListFromBlueprintUseCase.execute(dto);

      if (!result.isSuccess()) {
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
      const { id } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ error: 'Usuario no autenticado' });
        return;
      }

      // Validar datos de entrada
      const validationResult = createBlueprintSchema.safeParse(req.body);
      if (!validationResult.success) {
        res.status(400).json({
          error: 'Datos inválidos',
          details: validationResult.error.errors
        });
        return;
      }

      // Verificar que existe y pertenece al usuario
      const existingResult = await this.blueprintRepository.findById(id);
      if (!existingResult.isSuccess()) {
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
        validationResult.data.nombre,
        validationResult.data.descripcion,
        validationResult.data.publico,
        validationResult.data.productos
      );

      if (!updateResult.isSuccess()) {
        res.status(400).json({ error: updateResult.getError().message });
        return;
      }

      const updatedBlueprint = updateResult.getValue();
      const saveResult = await this.blueprintRepository.save(updatedBlueprint);

      if (!saveResult.isSuccess()) {
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
      const { id } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({ error: 'Usuario no autenticado' });
        return;
      }

      // Verificar que existe y pertenece al usuario
      const existingResult = await this.blueprintRepository.findById(id);
      if (!existingResult.isSuccess()) {
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
      if (!deleteResult.isSuccess()) {
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