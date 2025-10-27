/**
 * Entidad Permiso - Representa los permisos de un usuario sobre una lista
 */

import type { Result } from '@shared/result';
import { success, failure } from '@shared/result';
import { DomainError, InvalidValueError } from '@domain/errors/DomainError';
import { PermissionType } from '@domain/value-objects/PermissionType';

export interface PermisoProps {
  id: string;
  usuarioId: string;
  listaId: string;
  tipoPermiso: PermissionType;
  creadoEn: Date;
}

export class Permiso {
  private constructor(private readonly props: PermisoProps) {}

  static create(
    id: string,
    usuarioId: string,
    listaId: string,
    tipoPermiso: PermissionType,
    creadoEn: Date = new Date()
  ): Result<Permiso, DomainError> {
    // Validar ID
    if (!id || id.trim().length === 0) {
      return failure(new InvalidValueError(
        'ID de permiso no puede estar vacío',
        'id',
        id
      ));
    }

    // Validar usuarioId
    if (!usuarioId || usuarioId.trim().length === 0) {
      return failure(new InvalidValueError(
        'ID de usuario no puede estar vacío',
        'usuarioId',
        usuarioId
      ));
    }

    // Validar listaId
    if (!listaId || listaId.trim().length === 0) {
      return failure(new InvalidValueError(
        'ID de lista no puede estar vacío',
        'listaId',
        listaId
      ));
    }

    return success(new Permiso({
      id,
      usuarioId,
      listaId,
      tipoPermiso,
      creadoEn
    }));
  }

  // Getters
  get id(): string {
    return this.props.id;
  }

  get usuarioId(): string {
    return this.props.usuarioId;
  }

  get listaId(): string {
    return this.props.listaId;
  }

  get tipoPermiso(): PermissionType {
    return this.props.tipoPermiso;
  }

  get creadoEn(): Date {
    return this.props.creadoEn;
  }

  // Métodos de negocio

  /**
   * Verifica si el permiso permite escritura
   */
  puedeEscribir(): boolean {
    return this.props.tipoPermiso.canWrite();
  }

  /**
   * Verifica si el permiso permite administrar
   */
  puedeAdministrar(): boolean {
    return this.props.tipoPermiso.canAdmin();
  }

  /**
   * Cambia el tipo de permiso
   */
  cambiarTipoPermiso(nuevoTipo: PermissionType): Result<Permiso, DomainError> {
    return success(new Permiso({
      ...this.props,
      tipoPermiso: nuevoTipo
    }));
  }

  /**
   * Eleva permisos a escritura (solo si actualmente es de lectura)
   */
  elevarAEscritura(): Result<Permiso, DomainError> {
    if (this.props.tipoPermiso.canWrite()) {
      return failure(new InvalidValueError(
        'El usuario ya tiene permisos de escritura o superiores',
        'tipoPermiso',
        this.props.tipoPermiso.value
      ));
    }

    const nuevoTipoResult = PermissionType.create('ESCRITURA');
    if (nuevoTipoResult.isFailure) {
      return failure(nuevoTipoResult.error);
    }

    return success(new Permiso({
      ...this.props,
      tipoPermiso: nuevoTipoResult.value
    }));
  }

  /**
   * Eleva permisos a administrador
   */
  elevarAAdmin(): Result<Permiso, DomainError> {
    if (this.props.tipoPermiso.canAdmin()) {
      return failure(new InvalidValueError(
        'El usuario ya tiene permisos de administrador',
        'tipoPermiso',
        this.props.tipoPermiso.value
      ));
    }

    const nuevoTipoResult = PermissionType.create('ADMIN');
    if (nuevoTipoResult.isFailure) {
      return failure(nuevoTipoResult.error);
    }

    return success(new Permiso({
      ...this.props,
      tipoPermiso: nuevoTipoResult.value
    }));
  }

  /**
   * Reduce permisos a lectura
   */
  reducirALectura(): Result<Permiso, DomainError> {
    if (!this.props.tipoPermiso.canWrite()) {
      return failure(new InvalidValueError(
        'El usuario ya tiene solo permisos de lectura',
        'tipoPermiso',
        this.props.tipoPermiso.value
      ));
    }

    const nuevoTipoResult = PermissionType.create('LECTURA');
    if (nuevoTipoResult.isFailure) {
      return failure(nuevoTipoResult.error);
    }

    return success(new Permiso({
      ...this.props,
      tipoPermiso: nuevoTipoResult.value
    }));
  }

  /**
   * Verifica si este permiso es para el mismo usuario y lista que otro
   */
  esMismoUsuarioYLista(other: Permiso): boolean {
    return this.props.usuarioId === other.props.usuarioId && 
           this.props.listaId === other.props.listaId;
  }

  /**
   * Compara dos permisos por su ID
   */
  equals(other: Permiso): boolean {
    return this.props.id === other.props.id;
  }

  /**
   * Convierte la entidad a un objeto plano para persistencia
   */
  toPersistence(): {
    id: string;
    usuarioId: string;
    listaId: string;
    tipoPermiso: string;
    creadoEn: Date;
  } {
    return {
      id: this.props.id,
      usuarioId: this.props.usuarioId,
      listaId: this.props.listaId,
      tipoPermiso: this.props.tipoPermiso.value,
      creadoEn: this.props.creadoEn
    };
  }

  /**
   * Crea una instancia desde datos de persistencia
   */
  static fromPersistence(data: {
    id: string;
    usuarioId: string;
    listaId: string;
    tipoPermiso: string;
    creadoEn: Date;
  }): Result<Permiso, DomainError> {
    const tipoPermisoResult = PermissionType.create(data.tipoPermiso);
    if (tipoPermisoResult.isFailure) {
      return failure(tipoPermisoResult.error);
    }

    return Permiso.create(
      data.id,
      data.usuarioId,
      data.listaId,
      tipoPermisoResult.value,
      data.creadoEn
    );
  }
}