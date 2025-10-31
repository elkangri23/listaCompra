/**
 * Entidad Categoria - Representa una categoría de productos
 */

import type { Result } from '@shared/result';
import { success, failure } from '@shared/result';
import { InvalidValueError, BusinessRuleViolationError } from '@domain/errors/DomainError';
import { generateUUID, createDate } from '@shared/utils';

export interface CategoriaProps {
  id?: string;
  nombre: string;
  descripcion?: string;
  color?: string;
  icono?: string;
  activa?: boolean;
  tiendaId?: string;
  fechaCreacion?: Date;
  fechaActualizacion?: Date;
}

export class Categoria {
  private constructor(
    private readonly _id: string,
    private _nombre: string,
    private _descripcion: string | null,
    private _color: string | null,
    private _icono: string | null,
    private _activa: boolean,
    private _tiendaId: string | null,
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

  public get color(): string | null {
    return this._color;
  }

  public get icono(): string | null {
    return this._icono;
  }

  public get activa(): boolean {
    return this._activa;
  }

  public get tiendaId(): string | null {
    return this._tiendaId;
  }

  public get fechaCreacion(): Date {
    return this._fechaCreacion;
  }

  public get fechaActualizacion(): Date {
    return this._fechaActualizacion;
  }

  /**
   * Factory method para crear una nueva categoría
   */
  static create(props: CategoriaProps): Result<Categoria, InvalidValueError | BusinessRuleViolationError> {
    // Validar nombre
    if (!props.nombre || props.nombre.trim().length === 0) {
      return failure(new InvalidValueError(
        'El nombre de la categoría es requerido',
        'nombre',
        props.nombre
      ));
    }

    const nombreSanitizado = props.nombre.trim();
    if (nombreSanitizado.length > 100) {
      return failure(new InvalidValueError(
        'El nombre de la categoría no puede exceder 100 caracteres',
        'nombre',
        props.nombre
      ));
    }

    // Validar descripción
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

    // Validar color
    let colorSanitizado: string | null = null;
    if (props.color) {
      colorSanitizado = props.color.trim().toUpperCase();
      const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
      if (!hexColorRegex.test(colorSanitizado)) {
        return failure(new InvalidValueError(
          'El color debe ser un código hexadecimal válido (ej: #FF0000)',
          'color',
          props.color
        ));
      }
    }

    // Validar icono
    let iconoSanitizado: string | null = null;
    if (props.icono) {
      iconoSanitizado = props.icono.trim();
      if (iconoSanitizado.length === 0) {
        iconoSanitizado = null;
      }
    }

    const id = props.id ?? generateUUID();
    const fechaCreacion = props.fechaCreacion ?? createDate();
    const fechaActualizacion = props.fechaActualizacion ?? createDate();
    const activa = props.activa ?? true;
    const tiendaId = props.tiendaId ?? null;

    return success(new Categoria(
      id,
      nombreSanitizado,
      descripcionSanitizada,
      colorSanitizado,
      iconoSanitizado,
      activa,
      tiendaId,
      fechaCreacion,
      fechaActualizacion
    ));
  }

  /**
   * Factory method para recrear desde persistencia
   */
  static fromPersistence(props: CategoriaProps & { id: string }): Categoria {
    return new Categoria(
      props.id,
      props.nombre,
      props.descripcion ?? null,
      props.color ?? null,
      props.icono ?? null,
      props.activa ?? true,
      props.tiendaId ?? null,
      props.fechaCreacion ?? createDate(),
      props.fechaActualizacion ?? createDate()
    );
  }

  // Métodos de negocio
  public updateNombre(nuevoNombre: string): Result<void, InvalidValueError> {
    if (!nuevoNombre || nuevoNombre.trim().length === 0) {
      return failure(new InvalidValueError(
        'El nombre de la categoría es requerido',
        'nombre',
        nuevoNombre
      ));
    }

    const nombreSanitizado = nuevoNombre.trim();
    if (nombreSanitizado.length > 100) {
      return failure(new InvalidValueError(
        'El nombre de la categoría no puede exceder 100 caracteres',
        'nombre',
        nuevoNombre
      ));
    }

    this._nombre = nombreSanitizado;
    this._fechaActualizacion = createDate();
    return success(undefined);
  }

  public updateDescripcion(nuevaDescripcion?: string): Result<void, InvalidValueError> {
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

  public updateColor(nuevoColor?: string): Result<void, InvalidValueError> {
    let colorSanitizado: string | null = null;
    
    if (nuevoColor) {
      colorSanitizado = nuevoColor.trim().toUpperCase();
      const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
      if (!hexColorRegex.test(colorSanitizado)) {
        return failure(new InvalidValueError(
          'El color debe ser un código hexadecimal válido (ej: #FF0000)',
          'color',
          nuevoColor
        ));
      }
    }

    this._color = colorSanitizado;
    this._fechaActualizacion = createDate();
    return success(undefined);
  }

  public updateIcono(nuevoIcono?: string): void {
    let iconoSanitizado: string | null = null;
    
    if (nuevoIcono) {
      iconoSanitizado = nuevoIcono.trim();
      if (iconoSanitizado.length === 0) {
        iconoSanitizado = null;
      }
    }

    this._icono = iconoSanitizado;
    this._fechaActualizacion = createDate();
  }

  public activar(): void {
    this._activa = true;
    this._fechaActualizacion = createDate();
  }

  public desactivar(): void {
    this._activa = false;
    this._fechaActualizacion = createDate();
  }

  public assignToTienda(tiendaId: string): void {
    this._tiendaId = tiendaId;
    this._fechaActualizacion = createDate();
  }

  public removeFromTienda(): void {
    this._tiendaId = null;
    this._fechaActualizacion = createDate();
  }

  // Métodos de utilidad
  public isActive(): boolean {
    return this._activa;
  }

  public belongsToTienda(tiendaId: string): boolean {
    return this._tiendaId === tiendaId;
  }

  public isGeneral(): boolean {
    return this._tiendaId === null;
  }

  public hasColor(): boolean {
    return this._color !== null;
  }

  public hasIcon(): boolean {
    return this._icono !== null;
  }

  /**
   * Convierte la entidad a objeto para persistencia
   */
  public toPersistence(): CategoriaProps {
    const result: CategoriaProps = {
      id: this._id,
      nombre: this._nombre,
      activa: this._activa,
      fechaCreacion: this._fechaCreacion,
      fechaActualizacion: this._fechaActualizacion,
    };

    if (this._descripcion) {
      result.descripcion = this._descripcion;
    }
    
    if (this._color) {
      result.color = this._color;
    }
    
    if (this._icono) {
      result.icono = this._icono;
    }
    
    if (this._tiendaId) {
      result.tiendaId = this._tiendaId;
    }

    return result;
  }

  /**
   * Verifica igualdad por ID
   */
  public equals(other: Categoria): boolean {
    return this._id === other._id;
  }

  /**
   * Cálculo del total de elementos
   */
  public calculateHashCode(): string {
    return `${this._id}-${this._nombre}-${this._fechaActualizacion.getTime()}`;
  }
}