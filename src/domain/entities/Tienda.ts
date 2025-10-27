/**
 * Entidad Tienda - Representa una tienda donde se pueden comprar productos
 */

import type { Result } from '@shared/result';
import { success, failure } from '@shared/result';
import { InvalidValueError, BusinessRuleViolationError } from '@domain/errors/DomainError';
import { generateUUID, createDate } from '@shared/utils';

export interface TiendaProps {
  id?: string;
  nombre: string;
  direccion?: string;
  telefono?: string;
  sitioWeb?: string;
  activa?: boolean;
  fechaCreacion?: Date;
  fechaActualizacion?: Date;
}

export class Tienda {
  private constructor(
    private readonly _id: string,
    private _nombre: string,
    private _direccion: string | null,
    private _telefono: string | null,
    private _sitioWeb: string | null,
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

  public get direccion(): string | null {
    return this._direccion;
  }

  public get telefono(): string | null {
    return this._telefono;
  }

  public get sitioWeb(): string | null {
    return this._sitioWeb;
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
   * Factory method para crear una nueva tienda
   */
  static create(props: TiendaProps): Result<Tienda, InvalidValueError | BusinessRuleViolationError> {
    // Validar nombre
    if (!props.nombre || props.nombre.trim().length === 0) {
      return failure(new InvalidValueError(
        'El nombre de la tienda es requerido',
        'nombre',
        props.nombre
      ));
    }

    const nombreSanitizado = props.nombre.trim();
    if (nombreSanitizado.length > 100) {
      return failure(new InvalidValueError(
        'El nombre de la tienda no puede exceder 100 caracteres',
        'nombre',
        props.nombre
      ));
    }

    // Validar dirección
    let direccionSanitizada: string | null = null;
    if (props.direccion) {
      direccionSanitizada = props.direccion.trim();
      if (direccionSanitizada.length > 300) {
        return failure(new InvalidValueError(
          'La dirección no puede exceder 300 caracteres',
          'direccion',
          props.direccion
        ));
      }
      if (direccionSanitizada.length === 0) {
        direccionSanitizada = null;
      }
    }

    // Validar teléfono
    let telefonoSanitizado: string | null = null;
    if (props.telefono) {
      telefonoSanitizado = props.telefono.trim();
      // Validar formato de teléfono
      const phoneRegex = /^[\+]?[1-9][\d]{0,15}$|^[\+]?[(]?[\d\s\-\(\)]{10,20}$/;
      const cleanPhone = telefonoSanitizado.replace(/[\s\-\(\)]/g, '');
      
      if (!phoneRegex.test(cleanPhone) || cleanPhone.length < 7 || cleanPhone.length > 15) {
        return failure(new InvalidValueError(
          'El teléfono debe tener un formato válido',
          'telefono',
          props.telefono
        ));
      }
    }

    // Validar sitio web
    let sitioWebSanitizado: string | null = null;
    if (props.sitioWeb) {
      sitioWebSanitizado = props.sitioWeb.trim();
      try {
        const url = new URL(sitioWebSanitizado);
        if (!['http:', 'https:'].includes(url.protocol)) {
          return failure(new InvalidValueError(
            'El sitio web debe ser una URL válida (http o https)',
            'sitioWeb',
            props.sitioWeb
          ));
        }
      } catch {
        return failure(new InvalidValueError(
          'El sitio web debe ser una URL válida',
          'sitioWeb',
          props.sitioWeb
        ));
      }
    }

    const id = props.id ?? generateUUID();
    const fechaCreacion = props.fechaCreacion ?? createDate();
    const fechaActualizacion = props.fechaActualizacion ?? createDate();
    const activa = props.activa ?? true;

    return success(new Tienda(
      id,
      nombreSanitizado,
      direccionSanitizada,
      telefonoSanitizado,
      sitioWebSanitizado,
      activa,
      fechaCreacion,
      fechaActualizacion
    ));
  }

  /**
   * Factory method para recrear desde persistencia
   */
  static fromPersistence(props: TiendaProps & { id: string }): Tienda {
    return new Tienda(
      props.id,
      props.nombre,
      props.direccion ?? null,
      props.telefono ?? null,
      props.sitioWeb ?? null,
      props.activa ?? true,
      props.fechaCreacion ?? createDate(),
      props.fechaActualizacion ?? createDate()
    );
  }

  // Métodos de negocio
  public updateNombre(nuevoNombre: string): Result<void, InvalidValueError> {
    if (!nuevoNombre || nuevoNombre.trim().length === 0) {
      return failure(new InvalidValueError(
        'El nombre de la tienda es requerido',
        'nombre',
        nuevoNombre
      ));
    }

    const nombreSanitizado = nuevoNombre.trim();
    if (nombreSanitizado.length > 100) {
      return failure(new InvalidValueError(
        'El nombre de la tienda no puede exceder 100 caracteres',
        'nombre',
        nuevoNombre
      ));
    }

    this._nombre = nombreSanitizado;
    this._fechaActualizacion = createDate();
    return success(undefined);
  }

  public updateDireccion(nuevaDireccion?: string): Result<void, InvalidValueError> {
    let direccionSanitizada: string | null = null;
    
    if (nuevaDireccion) {
      direccionSanitizada = nuevaDireccion.trim();
      if (direccionSanitizada.length > 300) {
        return failure(new InvalidValueError(
          'La dirección no puede exceder 300 caracteres',
          'direccion',
          nuevaDireccion
        ));
      }
      if (direccionSanitizada.length === 0) {
        direccionSanitizada = null;
      }
    }

    this._direccion = direccionSanitizada;
    this._fechaActualizacion = createDate();
    return success(undefined);
  }

  public updateTelefono(nuevoTelefono?: string): Result<void, InvalidValueError> {
    let telefonoSanitizado: string | null = null;
    
    if (nuevoTelefono) {
      telefonoSanitizado = nuevoTelefono.trim();
      const phoneRegex = /^[\+]?[1-9][\d]{0,15}$|^[\+]?[(]?[\d\s\-\(\)]{10,20}$/;
      const cleanPhone = telefonoSanitizado.replace(/[\s\-\(\)]/g, '');
      
      if (!phoneRegex.test(cleanPhone) || cleanPhone.length < 7 || cleanPhone.length > 15) {
        return failure(new InvalidValueError(
          'El teléfono debe tener un formato válido',
          'telefono',
          nuevoTelefono
        ));
      }
    }

    this._telefono = telefonoSanitizado;
    this._fechaActualizacion = createDate();
    return success(undefined);
  }

  public updateSitioWeb(nuevoSitioWeb?: string): Result<void, InvalidValueError> {
    let sitioWebSanitizado: string | null = null;
    
    if (nuevoSitioWeb) {
      sitioWebSanitizado = nuevoSitioWeb.trim();
      try {
        const url = new URL(sitioWebSanitizado);
        if (!['http:', 'https:'].includes(url.protocol)) {
          return failure(new InvalidValueError(
            'El sitio web debe ser una URL válida (http o https)',
            'sitioWeb',
            nuevoSitioWeb
          ));
        }
      } catch {
        return failure(new InvalidValueError(
          'El sitio web debe ser una URL válida',
          'sitioWeb',
          nuevoSitioWeb
        ));
      }
    }

    this._sitioWeb = sitioWebSanitizado;
    this._fechaActualizacion = createDate();
    return success(undefined);
  }

  public activar(): void {
    this._activa = true;
    this._fechaActualizacion = createDate();
  }

  public desactivar(): void {
    this._activa = false;
    this._fechaActualizacion = createDate();
  }

  // Métodos de utilidad
  public isActive(): boolean {
    return this._activa;
  }

  public hasContactInfo(): boolean {
    return !!(this._telefono || this._sitioWeb || this._direccion);
  }

  public hasPhysicalLocation(): boolean {
    return !!this._direccion;
  }

  public hasWebsite(): boolean {
    return !!this._sitioWeb;
  }

  public hasPhone(): boolean {
    return !!this._telefono;
  }

  /**
   * Convierte la entidad a objeto para persistencia
   */
  public toPersistence(): TiendaProps {
    const result: TiendaProps = {
      id: this._id,
      nombre: this._nombre,
      activa: this._activa,
      fechaCreacion: this._fechaCreacion,
      fechaActualizacion: this._fechaActualizacion,
    };

    if (this._direccion) {
      result.direccion = this._direccion;
    }
    
    if (this._telefono) {
      result.telefono = this._telefono;
    }
    
    if (this._sitioWeb) {
      result.sitioWeb = this._sitioWeb;
    }

    return result;
  }

  /**
   * Verifica igualdad por ID
   */
  public equals(other: Tienda): boolean {
    return this._id === other._id;
  }

  /**
   * Cálculo del hash
   */
  public calculateHashCode(): string {
    return `${this._id}-${this._nombre}-${this._fechaActualizacion.getTime()}`;
  }
}