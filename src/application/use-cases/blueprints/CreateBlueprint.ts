/**
 * Caso de uso: Crear nuevo blueprint
 * Orquesta el proceso de creación de una nueva plantilla de lista
 */

import type { Result } from '@shared/result';
import { success, failure } from '@shared/result';
import type { IBlueprintRepository } from '@application/ports/repositories/IBlueprintRepository';
import { Blueprint } from '@domain/entities/Blueprint';
import { ValidationError } from '@application/errors/ValidationError';
import { BusinessRuleViolationError } from '@domain/errors/DomainError';

export interface CreateBlueprintDto {
  nombre: string;
  descripcion?: string;
  productos: Array<{
    nombre: string;
    descripcion?: string;
    cantidad: number;
    categoriaId?: string;
    urgente: boolean;
  }>;
}

export interface CreateBlueprintResponseDto {
  id: string;
  nombre: string;
  descripcion?: string; // Cambiar a opcional
  productos: Array<{
    nombre: string;
    descripcion?: string;
    cantidad: number;
    categoriaId?: string;
    urgente: boolean;
  }>;
  activo: boolean;
  fechaCreacion: string;
  conteoProductos: number;
}

export class CreateBlueprint {
  constructor(
    private readonly blueprintRepository: IBlueprintRepository
  ) {}

  async execute(dto: CreateBlueprintDto, usuarioId: string): Promise<Result<CreateBlueprintResponseDto, ValidationError | BusinessRuleViolationError | Error>> {
    // 1. Validar datos básicos
    if (!dto.nombre || dto.nombre.trim().length === 0) {
      return failure(ValidationError.create(
        'El nombre del blueprint es requerido',
        'nombre',
        dto.nombre
      ));
    }

    if (!usuarioId || usuarioId.trim().length === 0) {
      return failure(ValidationError.create(
        'El ID del usuario es requerido',
        'usuarioId',
        usuarioId
      ));
    }

    if (!dto.productos || dto.productos.length === 0) {
      return failure(ValidationError.create(
        'El blueprint debe tener al menos un producto',
        'productos',
        dto.productos
      ));
    }

    // 2. Verificar que no exista otro blueprint con el mismo nombre para este usuario
    const existsResult = await this.blueprintRepository.existsByNombreAndUsuario(dto.nombre.trim(), usuarioId);
    if (existsResult.isFailure) {
      return failure(existsResult.error);
    }

    if (existsResult.value) {
      return failure(ValidationError.create(
        'Ya existe un blueprint con ese nombre',
        'nombre',
        dto.nombre
      ));
    }

    // 3. Verificar límite de blueprints por usuario (max 50)
    const countResult = await this.blueprintRepository.countByUsuarioId(usuarioId, true);
    if (countResult.isFailure) {
      return failure(countResult.error);
    }

    if (countResult.value >= 50) {
      return failure(new BusinessRuleViolationError('Has alcanzado el límite máximo de 50 blueprints activos', 'BLUEPRINT_LIMIT_EXCEEDED'));
    }

    // 4. Sanitizar y validar productos antes de crear entidad
    const productosSanitizados = dto.productos.map(p => {
      // Validación adicional de tipos
      if (!p || typeof p !== 'object') {
        throw new ValidationError('Producto inválido', 'productos', p);
      }

      return {
        nombre: p.nombre?.toString() || '',
        descripcion: p.descripcion?.toString(),
        cantidad: Number(p.cantidad) || 0,
        categoriaId: p.categoriaId?.toString(),
        urgente: Boolean(p.urgente)
      };
    });

    // 5. Crear entidad Blueprint (que aplicará sanitización adicional)
    const productosProcesados = productosSanitizados.map(p => {
      const producto: any = {
        nombre: p.nombre,
        cantidad: p.cantidad
      };
      
      if (p.descripcion) {
        producto.notas = p.descripcion;
      }
      
      if (p.categoriaId) {
        producto.categoriaId = p.categoriaId;
      }
      
      return producto;
    });

    const blueprintResult = Blueprint.crear(
      dto.nombre,
      dto.descripcion,
      false, // Por defecto privado para seguridad
      productosProcesados,
      usuarioId
    );

    if (blueprintResult.isFailure) {
      return failure(blueprintResult.error);
    }

    // 5. Persistir blueprint
    const saveResult = await this.blueprintRepository.save(blueprintResult.value);
    if (saveResult.isFailure) {
      return failure(saveResult.error);
    }

    const blueprint = saveResult.value;

    // 7. Retornar respuesta
    const responseProductos = blueprint.productos.map(p => {
      const producto: any = {
        nombre: p.nombre,
        cantidad: p.cantidad,
        urgente: false // Blueprint no tiene urgente, por defecto false
      };
      
      if (p.notas) {
        producto.descripcion = p.notas;
      }
      
      if (p.categoriaId) {
        producto.categoriaId = p.categoriaId;
      }
      
      return producto;
    });

    const response: any = {
      id: blueprint.id,
      nombre: blueprint.nombre,
      productos: responseProductos,
      activo: true, // Los blueprints creados están activos por defecto
      fechaCreacion: blueprint.fechaCreacion.toISOString(),
      conteoProductos: blueprint.productos.length
    };

    if (blueprint.descripcion) {
      response.descripcion = blueprint.descripcion;
    }

    return success(response);
  }
}