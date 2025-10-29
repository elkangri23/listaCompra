/**
 * Entidad de dominio Blueprint
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
   * Factory method para crear un nuevo Blueprint
   */
  public static crear(
    nombre: string,
    descripcion: string | undefined,
    publico: boolean,
    productos: ProductoPlantilla[],
    creadoPorId: string
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

    if (!creadoPorId || creadoPorId.trim().length === 0) {
      return failure(new InvalidValueError('El ID del usuario es requerido', 'creadoPorId', creadoPorId));
    }

    // Validar productos
    for (let i = 0; i < productos.length; i++) {
      const producto = productos[i];
      if (!producto) continue;
      
      const validacion = Blueprint.validarProducto(producto);
      if (!validacion.isSuccess) {
        return failure(new InvalidValueError(`El producto ${i + 1} tiene un nombre inválido`, 'productos', productos));
      }
    }

    const ahora = new Date();
    const blueprint = new Blueprint(
      generateUUID(),
      nombre.trim(),
      descripcion?.trim(),
      publico,
      productos,
      creadoPorId,
      ahora,
      ahora
    );

    return success(blueprint);
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