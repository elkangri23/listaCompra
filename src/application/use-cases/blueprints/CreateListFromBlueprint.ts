/**
 * Caso de uso: Crear lista desde blueprint
 * Orquesta el proceso de creación de una lista basada en una plantilla existente
 */

import type { Result } from '@shared/result';
import { success, failure } from '@shared/result';
import type { IBlueprintRepository } from '@application/ports/repositories/IBlueprintRepository';
import type { IListaRepository } from '@application/ports/repositories/IListaRepository';
import type { IProductoRepository } from '@application/ports/repositories/IProductoRepository';
import { Lista } from '@domain/entities/Lista';
import { Producto } from '@domain/entities/Producto';
import { ValidationError } from '@application/errors/ValidationError';
import { NotFoundError } from '@application/errors/NotFoundError';
import { UnauthorizedError } from '@application/errors/UnauthorizedError';
import { BusinessRuleViolationError } from '@domain/errors/DomainError';

export interface CreateListFromBlueprintDto {
  blueprintId: string;
  nombreLista: string;
  descripcionLista?: string;
  tiendaId?: string;
}

export interface CreateListFromBlueprintResponseDto {
  lista: {
    id: string;
    nombre: string;
    descripcion?: string | null;
    propietarioId: string;
    tiendaId?: string | null;
    activa: boolean;
    fechaCreacion: string;
  };
  productos: Array<{
    id: string;
    nombre: string;
    descripcion?: string | null;
    cantidad: number;
    urgente: boolean;
    comprado: boolean;
  }>;
  blueprint: {
    id: string;
    nombre: string;
  };
  resumen: {
    totalProductos: number;
    productosCreados: number;
    productosConError: number;
  };
}

export class CreateListFromBlueprint {
  constructor(
    private readonly blueprintRepository: IBlueprintRepository,
    private readonly listaRepository: IListaRepository,
    private readonly productoRepository: IProductoRepository
  ) {}

  async execute(dto: CreateListFromBlueprintDto, usuarioId: string): Promise<Result<CreateListFromBlueprintResponseDto, ValidationError | NotFoundError | UnauthorizedError | BusinessRuleViolationError | Error>> {
    // 1. Validar datos básicos
    if (!dto.blueprintId || dto.blueprintId.trim().length === 0) {
      return failure(ValidationError.create(
        'El ID del blueprint es requerido',
        'blueprintId',
        dto.blueprintId
      ));
    }

    if (!dto.nombreLista || dto.nombreLista.trim().length === 0) {
      return failure(ValidationError.create(
        'El nombre de la lista es requerido',
        'nombreLista',
        dto.nombreLista
      ));
    }

    if (!usuarioId || usuarioId.trim().length === 0) {
      return failure(ValidationError.create(
        'El ID del usuario es requerido',
        'usuarioId',
        usuarioId
      ));
    }

    // 2. Buscar el blueprint
    const blueprintResult = await this.blueprintRepository.findById(dto.blueprintId);
    if (blueprintResult.isFailure) {
      return failure(blueprintResult.error);
    }

    if (!blueprintResult.value) {
      return failure(new NotFoundError('Blueprint', dto.blueprintId));
    }

    const blueprint = blueprintResult.value;

    // 3. Verificar permisos (solo el propietario puede usar el blueprint)
    if (!blueprint.perteneceAUsuario(usuarioId)) {
      return failure(new UnauthorizedError('No tienes permisos para usar este blueprint'));
    }

    // 4. Verificar que el blueprint esté activo
    if (!blueprint.activo) {
      return failure(new BusinessRuleViolationError('No se puede usar un blueprint inactivo', 'BLUEPRINT_INACTIVE'));
    }

    // 5. Verificar que el blueprint no esté vacío
    if (blueprint.estaVacia()) {
      return failure(new BusinessRuleViolationError('No se puede crear una lista desde un blueprint vacío', 'BLUEPRINT_EMPTY'));
    }

    // 6. Verificar que no exista otra lista con el mismo nombre para este usuario
    const existsListResult = await this.listaRepository.existsByNameAndOwner(dto.nombreLista.trim(), usuarioId);
    if (existsListResult.isFailure) {
      return failure(existsListResult.error);
    }

    if (existsListResult.value) {
      return failure(ValidationError.create(
        'Ya existe una lista con ese nombre',
        'nombreLista',
        dto.nombreLista
      ));
    }

    // 7. Crear la nueva lista
    const listaResult = Lista.create({
      nombre: dto.nombreLista,
      descripcion: dto.descripcionLista || undefined,
      propietarioId: usuarioId,
      tiendaId: dto.tiendaId || undefined,
      activa: true
    });

    if (listaResult.isFailure) {
      return failure(listaResult.error);
    }

    // 8. Persistir la lista
    const saveListResult = await this.listaRepository.save(listaResult.value);
    if (saveListResult.isFailure) {
      return failure(saveListResult.error);
    }

    const lista = saveListResult.value;

    // 9. Crear productos desde el blueprint
    const productosCreados: Producto[] = [];
    const productosConError: string[] = [];

    for (const productoPlantilla of blueprint.productos) {
      const productoResult = Producto.create({
        nombre: productoPlantilla.nombre,
        descripcion: productoPlantilla.descripcion || undefined,
        cantidad: productoPlantilla.cantidad,
        listaId: lista.id,
        categoriaId: productoPlantilla.categoriaId || undefined,
        urgente: productoPlantilla.urgente,
        creadoPorId: usuarioId
      });

      if (productoResult.isFailure) {
        productosConError.push(`${productoPlantilla.nombre}: ${productoResult.error.message}`);
        continue;
      }

      const saveProductResult = await this.productoRepository.save(productoResult.value);
      if (saveProductResult.isFailure) {
        productosConError.push(`${productoPlantilla.nombre}: Error al guardar`);
        continue;
      }

      productosCreados.push(saveProductResult.value);
    }

    // 10. Retornar respuesta
    return success({
      lista: {
        id: lista.id,
        nombre: lista.nombre,
        descripcion: lista.descripcion,
        propietarioId: lista.propietarioId,
        tiendaId: lista.tiendaId,
        activa: lista.estaActiva(),
        fechaCreacion: lista.fechaCreacion.toISOString()
      },
      productos: productosCreados.map(p => ({
        id: p.id,
        nombre: p.nombre,
        descripcion: p.descripcion,
        cantidad: p.cantidad,
        urgente: p.esUrgente(),
        comprado: p.estaComprado()
      })),
      blueprint: {
        id: blueprint.id,
        nombre: blueprint.nombre
      },
      resumen: {
        totalProductos: blueprint.productos.length,
        productosCreados: productosCreados.length,
        productosConError: productosConError.length
      }
    });
  }
}