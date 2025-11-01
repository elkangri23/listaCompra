/**
 * Caso de uso: Añadir producto a una lista
 * Permite añadir un nuevo producto a una lista de compra existente
 * Incluye categorización automática usando IA si está disponible
 */

import type { Result } from '@shared/result';
import { success, failure } from '@shared/result';
import type { IProductoRepository } from '@application/ports/repositories/IProductoRepository';
import type { IListaRepository } from '@application/ports/repositories/IListaRepository';
import type { ICategoriaRepository } from '@application/ports/repositories/ICategoriaRepository';
import type { ITiendaRepository } from '@application/ports/repositories/ITiendaRepository';
import type { IPermisoRepository } from '@application/ports/repositories/IPermisoRepository';
import type { IAIService } from '@application/ports/external/IAIService';
import type { IOutboxService } from '@application/ports/messaging/IOutboxService';
import type { AddProductDto, AddProductResponseDto } from '@application/dto/products/AddProductDto';
import { Producto } from '@domain/entities/Producto';
import { Categoria } from '@domain/entities/Categoria';
import { ValidationError } from '@application/errors/ValidationError';
import { NotFoundError } from '@application/errors/NotFoundError';
import { UnauthorizedError } from '@application/errors/UnauthorizedError';
import { Logger } from '../../../infrastructure/observability/logger/Logger';

interface AddProductDependencies {
  productoRepository: IProductoRepository;
  listaRepository: IListaRepository;
  categoriaRepository: ICategoriaRepository;
  tiendaRepository: ITiendaRepository;
  permisoRepository: IPermisoRepository;
  aiService?: IAIService; // Opcional - IA para categorización automática
  outboxService?: IOutboxService; // Opcional - Para eventos de auditoría
}

export class AddProduct {
  private readonly logger = new Logger('AddProduct');

  constructor(private readonly deps: AddProductDependencies) {}

  async execute(
    dto: AddProductDto,
    usuarioId: string
  ): Promise<Result<AddProductResponseDto, ValidationError | NotFoundError | UnauthorizedError | Error>> {
    // 1. Validar entrada básica
    if (!usuarioId || usuarioId.trim().length === 0) {
      return failure(ValidationError.create(
        'El ID del usuario es requerido',
        'usuarioId',
        usuarioId
      ));
    }

    if (!dto.listaId || dto.listaId.trim().length === 0) {
      return failure(ValidationError.create(
        'El ID de la lista es requerido',
        'listaId',
        dto.listaId
      ));
    }

    // 2. Verificar que la lista existe y el usuario tiene permisos
    const listaResult = await this.deps.listaRepository.findByIdAndOwner(dto.listaId, usuarioId);
    if (listaResult.isFailure) {
      return failure(listaResult.error);
    }

    const lista = listaResult.value;
    if (!lista) {
      return failure(new NotFoundError(
        'Lista',
        dto.listaId
      ));
    }

    // 3. Verificar que el usuario es propietario de la lista
    if (!lista.esPropietario(usuarioId)) {
      return failure(new UnauthorizedError(
        'No tienes permisos para añadir productos a esta lista'
      ));
    }

    // 4. Verificar que la lista está activa
    if (!lista.estaActiva()) {
      return failure(ValidationError.create(
        'No se pueden añadir productos a una lista inactiva',
        'lista',
        dto.listaId
      ));
    }

    // 5. Contar productos existentes para validar límites (opcional: máximo 1000 productos por lista)
    const countResult = await this.deps.productoRepository.countByList(dto.listaId);
    if (countResult.isFailure) {
      return failure(countResult.error);
    }

    const cantidadProductos = countResult.value;
    if (cantidadProductos >= 1000) {
      return failure(ValidationError.create(
        'La lista ha alcanzado el límite máximo de 1000 productos',
        'productos',
        cantidadProductos
      ));
    }

    // 6. Categorización automática con IA (si está disponible y no se especificó categoría)
    let categoriaId = dto.categoriaId;
    
    if (!categoriaId && this.deps.aiService) {
      try {
        this.logger.ai('Iniciando categorización automática', {
          productName: dto.nombre,
          listaId: dto.listaId,
          usuarioId
        });

        // Obtener información de la tienda asociada a la lista (si existe)
        let storeName: string | undefined;
        if (lista.tiendaId) {
          const tiendaResult = await this.deps.tiendaRepository.findById(lista.tiendaId);
          if (tiendaResult.isSuccess && tiendaResult.value) {
            storeName = tiendaResult.value.nombre;
          }
        }

        // Obtener categorías existentes para contexto
        const categoriasResult = await this.deps.categoriaRepository.findAll();
        const existingCategories = categoriasResult.isSuccess 
          ? categoriasResult.value.map(c => c.nombre)
          : [];

        // Solicitar sugerencias de categorías a la IA
        const suggestions = await this.deps.aiService.suggestCategories(
          dto.nombre,
          storeName,
          existingCategories
        );

        if (suggestions.length > 0 && suggestions[0]) {
          const bestSuggestion = suggestions[0]; // Tomar la primera (más confiable)
          const categoria = bestSuggestion.category;
          const confidence = bestSuggestion.confidence;
          
          if (confidence > 0.7) { // Solo usar si tiene alta confianza
            // Buscar si ya existe esa categoría
            const categoriaExistenteResult = await this.deps.categoriaRepository.findByNombre(categoria);
            
            if (categoriaExistenteResult.isSuccess && categoriaExistenteResult.value && categoriaExistenteResult.value.length > 0) {
              // Usar categoría existente (primera coincidencia)
              const categoriaExistente = categoriaExistenteResult.value[0];
              if (categoriaExistente) {
                categoriaId = categoriaExistente.id;
                this.logger.ai('Categoría automática aplicada (existente)', {
                  productName: dto.nombre,
                  categoria,
                  confidence,
                  categoriaId
                });
              }
            } else {
              // Crear nueva categoría automáticamente
              const nuevaCategoriaResult = Categoria.create({
                nombre: categoria,
                color: '#6B7280', // Color gris por defecto
                descripcion: 'Categoría creada automáticamente por IA'
              });

              if (nuevaCategoriaResult.isSuccess) {
                const nuevaCategoriaGuardadaResult = await this.deps.categoriaRepository.save(nuevaCategoriaResult.value);
                if (nuevaCategoriaGuardadaResult.isSuccess) {
                  categoriaId = nuevaCategoriaGuardadaResult.value.id;
                  this.logger.ai('Categoría automática creada y aplicada', {
                    productName: dto.nombre,
                    categoria,
                    confidence,
                    categoriaId
                  });
                }
              }
            }
          } else {
            this.logger.ai('Sugerencia de categoría con baja confianza, no aplicada', {
              productName: dto.nombre,
              categoria,
              confidence
            });
          }
        }

      } catch (error) {
        // Si falla la IA, continuar sin categorización automática
        this.logger.warn('Error en categorización automática, continuando sin categoría', {
          error: error instanceof Error ? error.message : String(error),
          productName: dto.nombre,
          usuarioId
        });
      }
    }

    // 7. Crear la entidad producto
    const productoResult = Producto.create({
      nombre: dto.nombre,
      ...(dto.descripcion && { descripcion: dto.descripcion }),
      ...(dto.cantidad && { cantidad: dto.cantidad }),
      ...(dto.unidad && { unidad: dto.unidad }),
      ...(dto.precio !== undefined && { precio: dto.precio }),
      ...(dto.urgente !== undefined && { urgente: dto.urgente }),
      listaId: dto.listaId,
      ...(categoriaId && { categoriaId: categoriaId }),
      creadoPorId: usuarioId,
    });

    if (productoResult.isFailure) {
      const error = productoResult.error;
      if ('field' in error && 'value' in error) {
        // Es InvalidValueError
        return failure(ValidationError.create(
          error.message,
          error.field,
          error.value
        ));
      } else {
        // Es BusinessRuleViolationError
        return failure(ValidationError.create(
          error.message,
          'producto',
          dto
        ));
      }
    }

    const producto = productoResult.value;

    // 8. Guardar el producto
    const saveResult = await this.deps.productoRepository.save(producto);
    if (saveResult.isFailure) {
      return failure(saveResult.error);
    }

    const productoGuardado = saveResult.value;

    // 9. Construir respuesta
    const response: AddProductResponseDto = {
      id: productoGuardado.id,
      nombre: productoGuardado.nombre,
      ...(productoGuardado.descripcion && { descripcion: productoGuardado.descripcion }),
      cantidad: productoGuardado.cantidad,
      ...(productoGuardado.unidad && { unidad: productoGuardado.unidad }),
      ...(productoGuardado.precio !== null && { precio: productoGuardado.precio }),
      comprado: productoGuardado.comprado,
      urgente: productoGuardado.urgente,
      listaId: productoGuardado.listaId,
      ...(productoGuardado.categoriaId && { categoriaId: productoGuardado.categoriaId }),
      creadoPorId: productoGuardado.creadoPorId,
      fechaCreacion: productoGuardado.fechaCreacion.toISOString(),
      fechaActualizacion: productoGuardado.fechaActualizacion.toISOString(),
      ...(productoGuardado.calcularValorTotal() !== null && { valorTotal: productoGuardado.calcularValorTotal()! }),
    };

    return success(response);
  }
}