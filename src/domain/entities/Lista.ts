/**
 * Entidad Lista de dominio
 * Representa una lista de compras con sus reglas de negocio
 */

import type { Result } from '@shared/result';
import { success, failure } from '@shared/result';
import { InvalidValueError, BusinessRuleViolationError } from '@domain/errors/DomainError';
import { createDate, generateUUID } from '@shared/utils';

export interface ListaProps {
  id?: string;
  nombre: string;
  descripcion?: string;
  propietarioId: string;
  tiendaId?: string;
  activa?: boolean;
  fechaCreacion?: Date;
  fechaActualizacion?: Date;
}

export class Lista {
  private constructor(
    private readonly _id: string,
    private _nombre: string,
    private _descripcion: string | null,
    private readonly _propietarioId: string,
    private _tiendaId: string | null,
    private _activa: boolean,
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

  public get descripcion(): string | null {
    return this._descripcion;
  }

  public get propietarioId(): string {
    return this._propietarioId;
  }

  public get tiendaId(): string | null {
    return this._tiendaId;
  }

  public get activa(): boolean {
    return this._activa;
  }

  public get fechaCreacion(): Date {
    return this._fechaCreacion;
  }

  public get fechaActualizacion(): Date {
    return this._fechaActualizacion;
  }

  /**
   * Factory method para crear una nueva lista
   */
  static create(props: ListaProps): Result<Lista, InvalidValueError | BusinessRuleViolationError> {
    // Validar nombre
    if (!props.nombre || props.nombre.trim().length === 0) {
      return failure(new InvalidValueError(
        'El nombre de la lista es requerido',
        'nombre',
        props.nombre
      ));
    }

    const nombreSanitizado = props.nombre.trim();
    if (nombreSanitizado.length > 100) {
      return failure(new InvalidValueError(
        'El nombre de la lista no puede exceder 100 caracteres',
        'nombre',
        props.nombre
      ));
    }

    // Validar descripción si se proporciona
    let descripcionSanitizada: string | null = null;
    if (props.descripcion) {
      descripcionSanitizada = props.descripcion.trim();
      if (descripcionSanitizada.length > 500) {
        return failure(new InvalidValueError(
          'La descripción no puede exceder 500 caracteres',
          'descripcion',
          props.descripcion
        ));
      }
      if (descripcionSanitizada.length === 0) {
        descripcionSanitizada = null;
      }
    }

    // Validar propietarioId
    if (!props.propietarioId || props.propietarioId.trim().length === 0) {
      return failure(new InvalidValueError(
        'El ID del propietario es requerido',
        'propietarioId',
        props.propietarioId
      ));
    }

    const now = createDate();

    return success(new Lista(
      props.id || generateUUID(),
      nombreSanitizado,
      descripcionSanitizada,
      props.propietarioId.trim(),
      props.tiendaId?.trim() || null,
      props.activa ?? true,
      props.fechaCreacion || now,
      props.fechaActualizacion || now
    ));
  }

  /**
   * Actualiza el nombre de la lista
   */
  public actualizarNombre(nuevoNombre: string): Result<void, InvalidValueError> {
    if (!nuevoNombre || nuevoNombre.trim().length === 0) {
      return failure(new InvalidValueError(
        'El nombre de la lista es requerido',
        'nombre',
        nuevoNombre
      ));
    }

    const nombreSanitizado = nuevoNombre.trim();
    if (nombreSanitizado.length > 100) {
      return failure(new InvalidValueError(
        'El nombre de la lista no puede exceder 100 caracteres',
        'nombre',
        nuevoNombre
      ));
    }

    this._nombre = nombreSanitizado;
    this._fechaActualizacion = createDate();
    return success(undefined);
  }

  /**
   * Actualiza la descripción de la lista
   */
  public actualizarDescripcion(nuevaDescripcion?: string): Result<void, InvalidValueError> {
    let descripcionSanitizada: string | null = null;
    
    if (nuevaDescripcion) {
      descripcionSanitizada = nuevaDescripcion.trim();
      if (descripcionSanitizada.length > 500) {
        return failure(new InvalidValueError(
          'La descripción no puede exceder 500 caracteres',
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
   * Actualiza la tienda asociada a la lista
   */
  public actualizarTienda(tiendaId?: string): Result<void, InvalidValueError> {
    let tiendaIdSanitizada: string | null = null;

    if (tiendaId) {
      tiendaIdSanitizada = tiendaId.trim();
      if (tiendaIdSanitizada.length === 0) {
        tiendaIdSanitizada = null;
      }
    }

    this._tiendaId = tiendaIdSanitizada;
    this._fechaActualizacion = createDate();
    return success(undefined);
  }

  /**
   * Activa la lista
   */
  public activar(): void {
    this._activa = true;
    this._fechaActualizacion = createDate();
  }

  /**
   * Desactiva la lista
   */
  public desactivar(): void {
    this._activa = false;
    this._fechaActualizacion = createDate();
  }

  /**
   * Verifica si el usuario es propietario de la lista
   */
  public esPropietario(usuarioId: string): boolean {
    return this._propietarioId === usuarioId;
  }

  /**
   * Verifica si la lista está activa
   */
  public estaActiva(): boolean {
    return this._activa;
  }

  /**
   * Convierte la entidad a formato JSON
   */
  public toJSON(): Record<string, any> {
    return {
      id: this._id,
      nombre: this._nombre,
      descripcion: this._descripcion,
      propietarioId: this._propietarioId,
      tiendaId: this._tiendaId,
      activa: this._activa,
      fechaCreacion: this._fechaCreacion.toISOString(),
      fechaActualizacion: this._fechaActualizacion.toISOString(),
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
      propietario_id: this._propietarioId,
      tienda_id: this._tiendaId,
      activa: this._activa,
      fecha_creacion: this._fechaCreacion,
      fecha_actualizacion: this._fechaActualizacion,
    };
  }

  /**
   * Factory method para reconstruir desde persistencia
   */
  static fromPersistence(data: Record<string, any>): Result<Lista, InvalidValueError | BusinessRuleViolationError> {
    try {
      return Lista.create({
        id: data['id'],
        nombre: data['nombre'],
        descripcion: data['descripcion'],
        propietarioId: data['propietario_id'],
        tiendaId: data['tienda_id'],
        activa: data['activa'],
        fechaCreacion: data['fecha_creacion'],
        fechaActualizacion: data['fecha_actualizacion'],
      });
    } catch (error) {
      return failure(new InvalidValueError(
        'Error al reconstruir lista desde persistencia',
        'data',
        data
      ));
    }
  }
}