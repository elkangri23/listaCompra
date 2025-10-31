/**
 * Entidad Producto - Representa un producto en una lista de compra
 */

import type { Result } from '@shared/result';
import { success, failure } from '@shared/result';
import { InvalidValueError, BusinessRuleViolationError } from '@domain/errors/DomainError';
import { generateUUID, createDate } from '@shared/utils';

export interface ProductoProps {
  id?: string;
  nombre: string;
  descripcion?: string;
  cantidad?: number;
  unidad?: string;
  precio?: number | null;
  comprado?: boolean;
  urgente?: boolean;
  listaId: string;
  categoriaId?: string;
  creadoPorId: string;
  fechaCreacion?: Date;
  fechaActualizacion?: Date;
  fechaCompra?: Date;
}

export class Producto {
  private constructor(
    private readonly _id: string,
    private _nombre: string,
    private _descripcion: string | null,
    private _cantidad: number,
    private _unidad: string | null,
    private _precio: number | null,
    private _comprado: boolean,
    private _urgente: boolean,
    private readonly _listaId: string,
    private _categoriaId: string | null,
    private readonly _creadoPorId: string,
    private readonly _fechaCreacion: Date,
    private _fechaActualizacion: Date,
    private _fechaCompra: Date | null
  ) {}

  // Getters
  public get id(): string {
    return this._id;
  }

  public get nombre(): string {
    return this._nombre;
  }

  public get descripcion(): string | null {
    return this._descripcion;
  }

  public get cantidad(): number {
    return this._cantidad;
  }

  public get unidad(): string | null {
    return this._unidad;
  }

  public get precio(): number | null {
    return this._precio;
  }

  public get comprado(): boolean {
    return this._comprado;
  }

  public get urgente(): boolean {
    return this._urgente;
  }

  public get listaId(): string {
    return this._listaId;
  }

  public get categoriaId(): string | null {
    return this._categoriaId;
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

  public get fechaCompra(): Date | null {
    return this._fechaCompra;
  }

  /**
   * Factory method para crear un nuevo producto
   */
  static create(props: ProductoProps): Result<Producto, InvalidValueError | BusinessRuleViolationError> {
    // Validar nombre
    if (!props.nombre || props.nombre.trim().length === 0) {
      return failure(new InvalidValueError(
        'El nombre del producto es requerido',
        'nombre',
        props.nombre
      ));
    }

    const nombreSanitizado = props.nombre.trim();
    if (nombreSanitizado.length > 200) {
      return failure(new InvalidValueError(
        'El nombre del producto no puede exceder 200 caracteres',
        'nombre',
        props.nombre
      ));
    }

    // Validar descripción
    let descripcionSanitizada: string | null = null;
    if (props.descripcion) {
      descripcionSanitizada = props.descripcion.trim();
      if (descripcionSanitizada.length > 1000) {
        return failure(new InvalidValueError(
          'La descripción no puede exceder 1000 caracteres',
          'descripcion',
          props.descripcion
        ));
      }
      if (descripcionSanitizada.length === 0) {
        descripcionSanitizada = null;
      }
    }

    // Validar cantidad
    const cantidad = props.cantidad ?? 1;
    if (cantidad < 1) {
      return failure(new InvalidValueError(
        'La cantidad debe ser mayor a 0',
        'cantidad',
        props.cantidad
      ));
    }
    if (cantidad > 999999) {
      return failure(new InvalidValueError(
        'La cantidad no puede exceder 999,999',
        'cantidad',
        props.cantidad
      ));
    }

    // Validar unidad
    let unidadSanitizada: string | null = null;
    if (props.unidad) {
      unidadSanitizada = props.unidad.trim();
      if (unidadSanitizada.length > 20) {
        return failure(new InvalidValueError(
          'La unidad no puede exceder 20 caracteres',
          'unidad',
          props.unidad
        ));
      }
      if (unidadSanitizada.length === 0) {
        unidadSanitizada = null;
      }
    }

    // Validar precio
    let precioValidado: number | null = null;
    if (props.precio !== undefined && props.precio !== null) {
      if (props.precio < 0) {
        return failure(new InvalidValueError(
          'El precio no puede ser negativo',
          'precio',
          props.precio
        ));
      }
      if (props.precio > 999999.99) {
        return failure(new InvalidValueError(
          'El precio no puede exceder 999,999.99',
          'precio',
          props.precio
        ));
      }
      precioValidado = props.precio;
    }

    // Validar listaId
    if (!props.listaId || props.listaId.trim().length === 0) {
      return failure(new InvalidValueError(
        'El ID de la lista es requerido',
        'listaId',
        props.listaId
      ));
    }

    // Validar creadoPorId
    if (!props.creadoPorId || props.creadoPorId.trim().length === 0) {
      return failure(new InvalidValueError(
        'El ID del creador es requerido',
        'creadoPorId',
        props.creadoPorId
      ));
    }

    const now = createDate();

    return success(new Producto(
      props.id || generateUUID(),
      nombreSanitizado,
      descripcionSanitizada,
      cantidad,
      unidadSanitizada,
      precioValidado,
      props.comprado ?? false,
      props.urgente ?? false,
      props.listaId.trim(),
      props.categoriaId?.trim() || null,
      props.creadoPorId.trim(),
      props.fechaCreacion || now,
      props.fechaActualizacion || now,
      props.fechaCompra || null
    ));
  }

  /**
   * Actualiza el nombre del producto
   */
  public actualizarNombre(nuevoNombre: string): Result<void, InvalidValueError> {
    if (!nuevoNombre || nuevoNombre.trim().length === 0) {
      return failure(new InvalidValueError(
        'El nombre del producto es requerido',
        'nombre',
        nuevoNombre
      ));
    }

    const nombreSanitizado = nuevoNombre.trim();
    if (nombreSanitizado.length > 200) {
      return failure(new InvalidValueError(
        'El nombre del producto no puede exceder 200 caracteres',
        'nombre',
        nuevoNombre
      ));
    }

    this._nombre = nombreSanitizado;
    this._fechaActualizacion = createDate();
    return success(undefined);
  }

  /**
   * Actualiza la descripción del producto
   */
  public actualizarDescripcion(nuevaDescripcion?: string): Result<void, InvalidValueError> {
    let descripcionSanitizada: string | null = null;
    
    if (nuevaDescripcion) {
      descripcionSanitizada = nuevaDescripcion.trim();
      if (descripcionSanitizada.length > 1000) {
        return failure(new InvalidValueError(
          'La descripción no puede exceder 1000 caracteres',
          'descripcion',
          nuevaDescripcion
        ));
      }
      if (descripcionSanitizada.length === 0) {
        descripcionSanitizada = null;
      }
    }

    this._descripcion = descripcionSanitizada;
    this._fechaActualizacion = createDate();
    return success(undefined);
  }

  /**
   * Actualiza la cantidad del producto
   */
  public actualizarCantidad(nuevaCantidad: number): Result<void, InvalidValueError> {
    if (nuevaCantidad < 1) {
      return failure(new InvalidValueError(
        'La cantidad debe ser mayor a 0',
        'cantidad',
        nuevaCantidad
      ));
    }
    if (nuevaCantidad > 999999) {
      return failure(new InvalidValueError(
        'La cantidad no puede exceder 999,999',
        'cantidad',
        nuevaCantidad
      ));
    }

    this._cantidad = nuevaCantidad;
    this._fechaActualizacion = createDate();
    return success(undefined);
  }

  /**
   * Actualiza la unidad del producto
   */
  public actualizarUnidad(nuevaUnidad?: string): Result<void, InvalidValueError> {
    let unidadSanitizada: string | null = null;

    if (nuevaUnidad) {
      unidadSanitizada = nuevaUnidad.trim();
      if (unidadSanitizada.length > 20) {
        return failure(new InvalidValueError(
          'La unidad no puede exceder 20 caracteres',
          'unidad',
          nuevaUnidad
        ));
      }
      if (unidadSanitizada.length === 0) {
        unidadSanitizada = null;
      }
    }

    this._unidad = unidadSanitizada;
    this._fechaActualizacion = createDate();
    return success(undefined);
  }

  /**
   * Actualiza el precio del producto
   */
  public actualizarPrecio(nuevoPrecio?: number): Result<void, InvalidValueError> {
    let precioValidado: number | null = null;

    if (nuevoPrecio !== undefined && nuevoPrecio !== null) {
      if (nuevoPrecio < 0) {
        return failure(new InvalidValueError(
          'El precio no puede ser negativo',
          'precio',
          nuevoPrecio
        ));
      }
      if (nuevoPrecio > 999999.99) {
        return failure(new InvalidValueError(
          'El precio no puede exceder 999,999.99',
          'precio',
          nuevoPrecio
        ));
      }
      precioValidado = nuevoPrecio;
    }

    this._precio = precioValidado;
    this._fechaActualizacion = createDate();
    return success(undefined);
  }

  /**
   * Actualiza la categoría del producto
   */
  public actualizarCategoria(categoriaId?: string): Result<void, InvalidValueError> {
    let categoriaIdSanitizada: string | null = null;

    if (categoriaId) {
      categoriaIdSanitizada = categoriaId.trim();
      if (categoriaIdSanitizada.length === 0) {
        categoriaIdSanitizada = null;
      }
    }

    this._categoriaId = categoriaIdSanitizada;
    this._fechaActualizacion = createDate();
    return success(undefined);
  }

  /**
   * Marca el producto como comprado
   */
  public marcarComoComprado(): void {
    if (!this._comprado) {
      this._comprado = true;
      this._fechaCompra = createDate();
      this._fechaActualizacion = createDate();
    }
  }

  /**
   * Marca el producto como no comprado
   */
  public marcarComoNoComprado(): void {
    if (this._comprado) {
      this._comprado = false;
      this._fechaCompra = null;
      this._fechaActualizacion = createDate();
    }
  }

  /**
   * Marca el producto como urgente
   */
  public marcarComoUrgente(): void {
    if (!this._urgente) {
      this._urgente = true;
      this._fechaActualizacion = createDate();
    }
  }

  /**
   * Marca el producto como no urgente
   */
  public marcarComoNoUrgente(): void {
    if (this._urgente) {
      this._urgente = false;
      this._fechaActualizacion = createDate();
    }
  }

  /**
   * Verifica si el usuario puede modificar el producto
   */
  public puedeModificar(usuarioId: string): boolean {
    return this._creadoPorId === usuarioId;
  }

  /**
   * Verifica si el producto está comprado
   */
  public estaComprado(): boolean {
    return this._comprado;
  }

  /**
   * Verifica si el producto es urgente
   */
  public esUrgente(): boolean {
    return this._urgente;
  }

  /**
   * Calcula el valor total (cantidad * precio)
   */
  public calcularValorTotal(): number | null {
    if (this._precio === null) {
      return null;
    }
    return this._cantidad * this._precio;
  }

  /**
   * Convierte la entidad a formato JSON
   */
  public toJSON(): Record<string, any> {
    return {
      id: this._id,
      nombre: this._nombre,
      descripcion: this._descripcion,
      cantidad: this._cantidad,
      unidad: this._unidad,
      precio: this._precio,
      comprado: this._comprado,
      urgente: this._urgente,
      listaId: this._listaId,
      categoriaId: this._categoriaId,
      creadoPorId: this._creadoPorId,
      fechaCreacion: this._fechaCreacion.toISOString(),
      fechaActualizacion: this._fechaActualizacion.toISOString(),
      fechaCompra: this._fechaCompra?.toISOString() || null,
      valorTotal: this.calcularValorTotal(),
    };
  }

  /**
   * Convierte la entidad para persistencia
   */
  public toPersistence(): Record<string, any> {
    return {
      id: this._id,
      nombre: this._nombre,
      descripcion: this._descripcion,
      cantidad: this._cantidad,
      unidad: this._unidad,
      precio: this._precio,
      comprado: this._comprado,
      urgente: this._urgente,
      listaId: this._listaId,
      categoriaId: this._categoriaId,
      creadoPorId: this._creadoPorId,
      fechaCreacion: this._fechaCreacion,
      fechaActualizacion: this._fechaActualizacion,
      fechaCompra: this._fechaCompra,
    };
  }

  /**
   * Factory method para reconstruir desde persistencia
   */
  static fromPersistence(data: Record<string, any>): Result<Producto, InvalidValueError | BusinessRuleViolationError> {
    try {
      return Producto.create({
        id: data['id'],
        nombre: data['nombre'],
        descripcion: data['descripcion'],
        cantidad: data['cantidad'],
        unidad: data['unidad'],
        precio: data['precio'] ? Number(data['precio']) : null,
        comprado: data['comprado'],
        urgente: data['urgente'],
        listaId: data['listaId'],
        categoriaId: data['categoriaId'],
        creadoPorId: data['creadoPorId'],
        fechaCreacion: data['fechaCreacion'],
        fechaActualizacion: data['fechaActualizacion'],
        fechaCompra: data['fechaCompra'],
      });
    } catch (error) {
      return failure(new InvalidValueError(
        'Error al reconstruir producto desde persistencia',
        'data',
        data
      ));
    }
  }
}