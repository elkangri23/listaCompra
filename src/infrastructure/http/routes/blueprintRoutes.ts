/**
 * Rutas para operaciones con blueprints
 */

import { Router } from 'express';
import { createAuthMiddleware } from '../middlewares/authMiddleware';
import { BlueprintController } from '../controllers/BlueprintController';
import { CreateBlueprint } from '../../../application/use-cases/blueprints/CreateBlueprint';
import { CreateListFromBlueprint } from '../../../application/use-cases/blueprints/CreateListFromBlueprint';
import { IBlueprintRepository } from '../../../application/ports/repositories/IBlueprintRepository';
import { IListaRepository } from '../../../application/ports/repositories/IListaRepository';
import { IProductoRepository } from '../../../application/ports/repositories/IProductoRepository';
import { ITokenService } from '../../../application/ports/auth/ITokenService';

interface BlueprintRouteDependencies {
  blueprintRepository: IBlueprintRepository;
  listaRepository: IListaRepository;
  productoRepository: IProductoRepository;
  tokenService: ITokenService;
}

export function createBlueprintRoutes(dependencies: BlueprintRouteDependencies): Router {
  const router = Router();
  const authMiddleware = createAuthMiddleware({ 
    tokenService: dependencies.tokenService 
  });

  // Crear casos de uso
  const createBlueprintUseCase = new CreateBlueprint(
    dependencies.blueprintRepository
  );

  const createListFromBlueprintUseCase = new CreateListFromBlueprint(
    dependencies.blueprintRepository,
    dependencies.listaRepository,
    dependencies.productoRepository
  );

  // Crear controlador
  const blueprintController = new BlueprintController(
    createBlueprintUseCase,
    createListFromBlueprintUseCase,
    dependencies.blueprintRepository
  );

  /**
   * @swagger
   * /api/blueprints:
   *   post:
   *     summary: Crear un nuevo blueprint
   *     tags: [Blueprints]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - nombre
   *               - productos
   *             properties:
   *               nombre:
   *                 type: string
   *                 maxLength: 100
   *                 example: "Lista para barbacoa"
   *               descripcion:
   *                 type: string
   *                 maxLength: 500
   *                 example: "Productos básicos para una barbacoa familiar"
   *               publico:
   *                 type: boolean
   *                 default: false
   *                 example: true
   *               productos:
   *                 type: array
   *                 minItems: 1
   *                 items:
   *                   type: object
   *                   required:
   *                     - nombre
   *                     - cantidad
   *                   properties:
   *                     nombre:
   *                       type: string
   *                       example: "Carne para asar"
   *                     cantidad:
   *                       type: number
   *                       minimum: 1
   *                       example: 2
   *                     notas:
   *                       type: string
   *                       example: "Preferiblemente de res"
   *                     categoriaId:
   *                       type: string
   *                       format: uuid
   *     responses:
   *       201:
   *         description: Blueprint creado exitosamente
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/CreateBlueprintResponse'
   *       400:
   *         description: Datos inválidos
   *       401:
   *         description: No autorizado
   *       500:
   *         description: Error interno del servidor
   */
  router.post('/', authMiddleware, (req, res) => blueprintController.crear(req, res));

  /**
   * @swagger
   * /api/blueprints:
   *   get:
   *     summary: Obtener blueprints del usuario autenticado
   *     tags: [Blueprints]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: pagina
   *         schema:
   *           type: integer
   *           minimum: 1
   *           default: 1
   *         description: Número de página
   *       - in: query
   *         name: limite
   *         schema:
   *           type: integer
   *           minimum: 1
   *           maximum: 50
   *           default: 10
   *         description: Cantidad de elementos por página
   *     responses:
   *       200:
   *         description: Lista de blueprints del usuario
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 blueprints:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/BlueprintSummary'
   *                 pagina:
   *                   type: integer
   *                 limite:
   *                   type: integer
   *                 total:
   *                   type: integer
   *                 totalPages:
   *                   type: integer
   *       401:
   *         description: No autorizado
   *       500:
   *         description: Error interno del servidor
   */
  router.get('/', authMiddleware, (req, res) => blueprintController.obtenerPorUsuario(req, res));

  /**
   * @swagger
   * /api/blueprints/publicos:
   *   get:
   *     summary: Obtener blueprints públicos
   *     tags: [Blueprints]
   *     parameters:
   *       - in: query
   *         name: pagina
   *         schema:
   *           type: integer
   *           minimum: 1
   *           default: 1
   *         description: Número de página
   *       - in: query
   *         name: limite
   *         schema:
   *           type: integer
   *           minimum: 1
   *           maximum: 50
   *           default: 10
   *         description: Cantidad de elementos por página
   *     responses:
   *       200:
   *         description: Lista de blueprints públicos
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 blueprints:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/BlueprintSummary'
   *                 pagina:
   *                   type: integer
   *                 limite:
   *                   type: integer
   *                 total:
   *                   type: integer
   *                 totalPages:
   *                   type: integer
   *       500:
   *         description: Error interno del servidor
   */
  router.get('/publicos', (req, res) => blueprintController.obtenerPublicos(req, res));

  /**
   * @swagger
   * /api/blueprints/buscar:
   *   get:
   *     summary: Buscar blueprints por nombre o descripción
   *     tags: [Blueprints]
   *     parameters:
   *       - in: query
   *         name: q
   *         required: true
   *         schema:
   *           type: string
   *           minLength: 2
   *         description: Término de búsqueda
   *       - in: query
   *         name: pagina
   *         schema:
   *           type: integer
   *           minimum: 1
   *           default: 1
   *         description: Número de página
   *       - in: query
   *         name: limite
   *         schema:
   *           type: integer
   *           minimum: 1
   *           maximum: 50
   *           default: 10
   *         description: Cantidad de elementos por página
   *     responses:
   *       200:
   *         description: Resultados de búsqueda
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 blueprints:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/BlueprintSummary'
   *                 termino:
   *                   type: string
   *                 pagina:
   *                   type: integer
   *                 limite:
   *                   type: integer
   *                 total:
   *                   type: integer
   *                 totalPages:
   *                   type: integer
   *       400:
   *         description: Término de búsqueda inválido
   *       500:
   *         description: Error interno del servidor
   */
  router.get('/buscar', (req, res) => blueprintController.buscar(req, res));

  /**
   * @swagger
   * /api/blueprints/{id}:
   *   get:
   *     summary: Obtener blueprint por ID
   *     tags: [Blueprints]
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: ID del blueprint
   *     responses:
   *       200:
   *         description: Detalles del blueprint
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/BlueprintDetails'
   *       403:
   *         description: Sin permisos para ver este blueprint
   *       404:
   *         description: Blueprint no encontrado
   *       500:
   *         description: Error interno del servidor
   */
  router.get('/:id', (req, res) => blueprintController.obtenerPorId(req, res));

  /**
   * @swagger
   * /api/blueprints/{id}:
   *   put:
   *     summary: Actualizar blueprint
   *     tags: [Blueprints]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: ID del blueprint
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - nombre
   *               - productos
   *             properties:
   *               nombre:
   *                 type: string
   *                 maxLength: 100
   *               descripcion:
   *                 type: string
   *                 maxLength: 500
   *               publico:
   *                 type: boolean
   *               productos:
   *                 type: array
   *                 minItems: 1
   *                 items:
   *                   type: object
   *                   required:
   *                     - nombre
   *                     - cantidad
   *                   properties:
   *                     nombre:
   *                       type: string
   *                     cantidad:
   *                       type: number
   *                       minimum: 1
   *                     notas:
   *                       type: string
   *                     categoriaId:
   *                       type: string
   *                       format: uuid
   *     responses:
   *       200:
   *         description: Blueprint actualizado exitosamente
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/BlueprintDetails'
   *       400:
   *         description: Datos inválidos
   *       401:
   *         description: No autorizado
   *       403:
   *         description: Sin permisos para modificar este blueprint
   *       404:
   *         description: Blueprint no encontrado
   *       500:
   *         description: Error interno del servidor
   */
  router.put('/:id', authMiddleware, (req, res) => blueprintController.actualizar(req, res));

  /**
   * @swagger
   * /api/blueprints/{id}:
   *   delete:
   *     summary: Eliminar blueprint
   *     tags: [Blueprints]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: ID del blueprint
   *     responses:
   *       204:
   *         description: Blueprint eliminado exitosamente
   *       401:
   *         description: No autorizado
   *       403:
   *         description: Sin permisos para eliminar este blueprint
   *       404:
   *         description: Blueprint no encontrado
   *       500:
   *         description: Error interno del servidor
   */
  router.delete('/:id', authMiddleware, (req, res) => blueprintController.eliminar(req, res));

  /**
   * @swagger
   * /api/blueprints/{id}/crear-lista:
   *   post:
   *     summary: Crear lista de compra desde blueprint
   *     tags: [Blueprints]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *           format: uuid
   *         description: ID del blueprint
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - nombre
   *             properties:
   *               nombre:
   *                 type: string
   *                 maxLength: 100
   *                 example: "Lista de barbacoa - Sábado"
   *               descripcion:
   *                 type: string
   *                 maxLength: 500
   *                 example: "Lista generada desde plantilla de barbacoa"
   *     responses:
   *       201:
   *         description: Lista creada exitosamente desde blueprint
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/CreateListFromBlueprintResponse'
   *       400:
   *         description: Datos inválidos
   *       401:
   *         description: No autorizado
   *       403:
   *         description: Sin permisos para usar este blueprint
   *       404:
   *         description: Blueprint no encontrado
   *       500:
   *         description: Error interno del servidor
   */
  router.post('/:id/crear-lista', authMiddleware, (req, res) => blueprintController.crearListaDesdeBlueprint(req, res));

  return router;
}

/**
 * @swagger
 * components:
 *   schemas:
 *     BlueprintSummary:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         nombre:
 *           type: string
 *         descripcion:
 *           type: string
 *         publico:
 *           type: boolean
 *         productosCount:
 *           type: integer
 *         fechaCreacion:
 *           type: string
 *           format: date-time
 *         fechaActualizacion:
 *           type: string
 *           format: date-time
 *         creadoPorId:
 *           type: string
 *           format: uuid
 *     
 *     BlueprintDetails:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         nombre:
 *           type: string
 *         descripcion:
 *           type: string
 *         publico:
 *           type: boolean
 *         productos:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               nombre:
 *                 type: string
 *               cantidad:
 *                 type: number
 *               notas:
 *                 type: string
 *               categoriaId:
 *                 type: string
 *                 format: uuid
 *         fechaCreacion:
 *           type: string
 *           format: date-time
 *         fechaActualizacion:
 *           type: string
 *           format: date-time
 *         creadoPorId:
 *           type: string
 *           format: uuid
 *     
 *     CreateBlueprintResponse:
 *       $ref: '#/components/schemas/BlueprintDetails'
 *     
 *     CreateListFromBlueprintResponse:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         nombre:
 *           type: string
 *         descripcion:
 *           type: string
 *         fechaCreacion:
 *           type: string
 *           format: date-time
 *         propietarioId:
 *           type: string
 *           format: uuid
 *   
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 */