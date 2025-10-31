/**
 * Entidad de dominio Blueprint con protecciones contra inyección
 * Representa una plantilla reutilizable de lista de compra
 */

import { Result, success, failure } from '@shared/result';
import { InvalidValueError } from '@domain/errors/DomainError';
import { generateUUID } from '@shared/utils';

export interface ProductoPlantilla {
  nombre: string;
  cantidad: number;
  notas?: string;
  categoriaId?: string;
}

/**
 * Utilitarios de seguridad para blueprints
 */
export class BlueprintSanitizer {
  /**
   * Sanitiza un string para prevenir XSS y injection
   */
  public static sanitizeText(text: string): string {
    if (!text || typeof text !== 'string') return '';
    
    // Limpiar caracteres peligrosos
    return text
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remover scripts
      .replace(/javascript:/gi, '') // Remover javascript:
      .replace(/on\w+\s*=/gi, '') // Remover event handlers
      .replace(/[<>]/g, '') // Remover < y >
      .trim()
      .substring(0, 500); // Límite de longitud
  }

  /**
   * Valida y sanitiza un nombre de producto
   */
  public static sanitizeProductName(nombre: string): string {
    const sanitized = this.sanitizeText(nombre);
    
    if (sanitized.length === 0) {
      throw new InvalidValueError('El nombre del producto no puede estar vacío después del sanitizado', 'nombre', nombre);
    }
    
    if (sanitized.length > 100) {
      throw new InvalidValueError('El nombre del producto excede el límite después del sanitizado', 'nombre', sanitized);
    }
    
    return sanitized;
  }

  /**
   * Valida y sanitiza notas de producto
   */
  public static sanitizeProductNotes(notas?: string): string | undefined {
    if (!notas) return undefined;
    
    const sanitized = this.sanitizeText(notas);
    
    if (sanitized.length === 0) return undefined;
    
    if (sanitized.length > 200) {
      throw new InvalidValueError('Las notas del producto exceden el límite después del sanitizado', 'notas', sanitized);
    }
    
    return sanitized;
  }

  /**
   * Valida cantidad para prevenir valores maliciosos
   */
  public static sanitizeQuantity(cantidad: any): number {
    if (typeof cantidad !== 'number' || isNaN(cantidad)) {
      throw new InvalidValueError('La cantidad debe ser un número válido', 'cantidad', cantidad);
    }
    
    const cleanQuantity = Math.max(0, Math.min(9999, Math.floor(cantidad)));
    
    if (cleanQuantity === 0) {
      throw new InvalidValueError('La cantidad debe ser mayor a 0', 'cantidad', cantidad);
    }
    
    return cleanQuantity;
  }

  /**
   * Valida ID de categoría
   */
  public static sanitizeCategoryId(categoriaId?: string): string | undefined {
    if (!categoriaId) return undefined;
    
    if (typeof categoriaId !== 'string') {
      throw new InvalidValueError('El ID de categoría debe ser una cadena', 'categoriaId', categoriaId);
    }
    
    // Validar formato UUID básico
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(categoriaId)) {
      throw new InvalidValueError('El ID de categoría no tiene formato válido', 'categoriaId', categoriaId);
    }
    
    return categoriaId;
  }

  /**
   * Sanitiza completamente un producto
   */
  public static sanitizeProduct(producto: any): ProductoPlantilla {
    if (!producto || typeof producto !== 'object') {
      throw new InvalidValueError('El producto debe ser un objeto válido', 'producto', producto);
    }

    const sanitizedProduct: ProductoPlantilla = {
      nombre: this.sanitizeProductName(producto.nombre),
      cantidad: this.sanitizeQuantity(producto.cantidad)
    };

    const sanitizedNotes = this.sanitizeProductNotes(producto.notas);
    if (sanitizedNotes !== undefined) {
      sanitizedProduct.notas = sanitizedNotes;
    }

    const sanitizedCategoryId = this.sanitizeCategoryId(producto.categoriaId);
    if (sanitizedCategoryId !== undefined) {
      sanitizedProduct.categoriaId = sanitizedCategoryId;
    }

    return sanitizedProduct;
  }
}

export class Blueprint {
  private constructor(
    private readonly _id: string,
    private _nombre: string,
    private _descripcion: string | undefined,
    private _publico: boolean,
    private _productos: ProductoPlantilla[],
    private readonly _creadoPorId: string,
    private readonly _fechaCreacion: Date,
    private _fechaActualizacion: Date
  ) {}

  // Getters
  public get id(): string {
    return this._id;
  }

  public get nombre(): string {
    return this._nombre;
  }

  public get descripcion(): string | undefined {
    return this._descripcion;
  }

  public get publico(): boolean {
    return this._publico;
  }

  public get productos(): ProductoPlantilla[] {
    return [...this._productos];
  }

  public get creadoPorId(): string {
    return this._creadoPorId;
  }

  public get fechaCreacion(): Date {
    return this._fechaCreacion;
  }

  public get fechaActualizacion(): Date {
    return this._fechaActualizacion;
  }

  /**
   * Factory method para crear un nuevo Blueprint con sanitización
   */
  public static crear(
    nombre: string,
    descripcion: string | undefined,
    publico: boolean,
    productos: ProductoPlantilla[],
    creadoPorId: string
  ): Result<Blueprint, Error> {
    try {
      // Validaciones y sanitización de nombre
      if (!nombre || nombre.trim().length === 0) {
        return failure(new InvalidValueError('El nombre no puede estar vacío', 'nombre', nombre));
      }

      const nombreSanitizado = BlueprintSanitizer.sanitizeText(nombre.trim());
      if (nombreSanitizado.length === 0) {
        return failure(new InvalidValueError('El nombre no puede estar vacío después del sanitizado', 'nombre', nombre));
      }

      if (nombreSanitizado.length > 100) {
        return failure(new InvalidValueError('El nombre no puede exceder 100 caracteres', 'nombre', nombreSanitizado));
      }

      // Validaciones y sanitización de descripción
      let descripcionSanitizada: string | undefined = undefined;
      if (descripcion) {
        descripcionSanitizada = BlueprintSanitizer.sanitizeText(descripcion.trim());
        if (descripcionSanitizada.length > 500) {
          return failure(new InvalidValueError('La descripción no puede exceder 500 caracteres', 'descripcion', descripcionSanitizada));
        }
        if (descripcionSanitizada.length === 0) {
          descripcionSanitizada = undefined;
        }
      }

      // Validaciones de productos con límites de seguridad
      if (!productos || productos.length === 0) {
        return failure(new InvalidValueError('Debe contener al menos un producto', 'productos', productos));
      }

      if (productos.length > 50) {
        return failure(new InvalidValueError('No puede contener más de 50 productos', 'productos', productos));
      }

      if (!creadoPorId || creadoPorId.trim().length === 0) {
        return failure(new InvalidValueError('El ID del usuario es requerido', 'creadoPorId', creadoPorId));
      }

      // Sanitizar todos los productos
      const productosSanitizados: ProductoPlantilla[] = [];
      for (let i = 0; i < productos.length; i++) {
        try {
          const productoSanitizado = BlueprintSanitizer.sanitizeProduct(productos[i]);
          productosSanitizados.push(productoSanitizado);
        } catch (error) {
          return failure(new InvalidValueError(
            `Error en producto ${i + 1}: ${error instanceof Error ? error.message : 'Error desconocido'}`, 
            'productos', 
            productos[i]
          ));
        }
      }

      const ahora = new Date();
      const blueprint = new Blueprint(
        generateUUID(),
        nombreSanitizado,
        descripcionSanitizada,
        publico,
        productosSanitizados,
        creadoPorId.trim(),
        ahora,
        ahora
      );

      return success(blueprint);
    } catch (error) {
      return failure(error instanceof Error ? error : new Error('Error inesperado al crear blueprint'));
    }
  }

  /**
   * Recrear blueprint desde datos persistidos
   */
  public static recrear(
    id: string,
    nombre: string,
    descripcion: string | undefined,
    publico: boolean,
    productos: ProductoPlantilla[],
    creadoPorId: string,
    fechaCreacion: Date,
    fechaActualizacion: Date
  ): Blueprint {
    return new Blueprint(
      id,
      nombre,
      descripcion,
      publico,
      productos,
      creadoPorId,
      fechaCreacion,
      fechaActualizacion
    );
  }

  /**
   * Actualizar el blueprint
   */
  public actualizar(
    nombre: string,
    descripcion: string | undefined,
    publico: boolean,
    productos: ProductoPlantilla[]
  ): Result<Blueprint, Error> {
    // Validaciones básicas
    if (!nombre || nombre.trim().length === 0) {
      return failure(new InvalidValueError('El nombre no puede estar vacío', 'nombre', nombre));
    }

    if (nombre.trim().length > 100) {
      return failure(new InvalidValueError('El nombre no puede exceder 100 caracteres', 'nombre', nombre));
    }

    if (descripcion && descripcion.length > 500) {
      return failure(new InvalidValueError('La descripción no puede exceder 500 caracteres', 'descripcion', descripcion));
    }

    if (!productos || productos.length === 0) {
      return failure(new InvalidValueError('Debe contener al menos un producto', 'productos', productos));
    }

    if (productos.length > 50) {
      return failure(new InvalidValueError('No puede contener más de 50 productos', 'productos', productos));
    }

    // Validar productos
    for (let i = 0; i < productos.length; i++) {
      const producto = productos[i];
      if (!producto) continue;
      
      const validacion = Blueprint.validarProducto(producto);
      if (!validacion.isSuccess) {
        return failure(new InvalidValueError(`El producto ${i + 1} es inválido`, 'productos', productos));
      }
    }

    this._nombre = nombre.trim();
    this._descripcion = descripcion?.trim();
    this._publico = publico;
    this._productos = productos;
    this._fechaActualizacion = new Date();

    return success(this);
  }

  /**
   * Validar un producto de la plantilla
   */
  public static validarProducto(producto: ProductoPlantilla): Result<void, Error> {
    if (!producto.nombre || producto.nombre.trim().length === 0) {
      return failure(new InvalidValueError('El nombre del producto no puede estar vacío', 'nombre', producto.nombre));
    }

    if (producto.nombre.trim().length > 100) {
      return failure(new InvalidValueError('El nombre del producto no puede exceder 100 caracteres', 'nombre', producto.nombre));
    }

    if (producto.notas && producto.notas.length > 200) {
      return failure(new InvalidValueError('Las notas no pueden exceder 200 caracteres', 'notas', producto.notas));
    }

    if (producto.cantidad <= 0 || producto.cantidad > 1000) {
      return failure(new InvalidValueError('La cantidad debe ser mayor a 0', 'cantidad', producto.cantidad));
    }

    return success(undefined);
  }
}