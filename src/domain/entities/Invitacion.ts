/**
 * Entidad Invitacion - Representa una invitación para compartir una lista
 */

import type { Result } from '@shared/result';
import { success, failure } from '@shared/result';
import { DomainError, InvalidValueError } from '@domain/errors/DomainError';
import { Hash } from '@domain/value-objects/Hash';
import { PermissionType } from '@domain/value-objects/PermissionType';

export interface InvitacionProps {
  id: string;
  listaId: string;
  hash: Hash;
  tipoPermiso: PermissionType;
  creadaEn: Date;
  expiraEn: Date;
  activa: boolean;
}

export class Invitacion {
  private constructor(private readonly props: InvitacionProps) {}

  static create(
    id: string,
    listaId: string,
    hash: Hash,
    tipoPermiso: PermissionType,
    creadaEn: Date = new Date(),
    expiraEn?: Date,
    activa: boolean = true
  ): Result<Invitacion, DomainError> {
    // Validar ID
    if (!id || id.trim().length === 0) {
      return failure(new InvalidValueError(
        'ID de invitación no puede estar vacío',
        'id',
        id
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

    // Establecer fecha de expiración por defecto (7 días)
    const fechaExpiracion = expiraEn || new Date(creadaEn.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Validar que la fecha de expiración sea posterior a la de creación
    if (fechaExpiracion <= creadaEn) {
      return failure(new InvalidValueError(
        'La fecha de expiración debe ser posterior a la fecha de creación',
        'expiraEn',
        fechaExpiracion.toISOString()
      ));
    }

    return success(new Invitacion({
      id,
      listaId,
      hash,
      tipoPermiso,
      creadaEn,
      expiraEn: fechaExpiracion,
      activa
    }));
  }

  // Getters
  get id(): string {
    return this.props.id;
  }

  get listaId(): string {
    return this.props.listaId;
  }

  get hash(): Hash {
    return this.props.hash;
  }

  get tipoPermiso(): PermissionType {
    return this.props.tipoPermiso;
  }

  get creadaEn(): Date {
    return this.props.creadaEn;
  }

  get expiraEn(): Date {
    return this.props.expiraEn;
  }

  get activa(): boolean {
    return this.props.activa;
  }

  // Métodos de negocio

  /**
   * Verifica si la invitación ha expirado
   */
  haExpirado(): boolean {
    return new Date() > this.props.expiraEn;
  }

  /**
   * Verifica si la invitación es válida para usar
   */
  esValida(): boolean {
    return this.props.activa && !this.haExpirado();
  }

  /**
   * Desactiva la invitación
   */
  desactivar(): Result<Invitacion, DomainError> {
    if (!this.props.activa) {
      return failure(new InvalidValueError(
        'La invitación ya está desactivada',
        'activa',
        'false'
      ));
    }

    return success(new Invitacion({
      ...this.props,
      activa: false
    }));
  }

  /**
   * Activa la invitación (solo si no ha expirado)
   */
  activar(): Result<Invitacion, DomainError> {
    if (this.haExpirado()) {
      return failure(new InvalidValueError(
        'No se puede activar una invitación expirada',
        'expiraEn',
        this.props.expiraEn.toISOString()
      ));
    }

    if (this.props.activa) {
      return failure(new InvalidValueError(
        'La invitación ya está activa',
        'activa',
        'true'
      ));
    }

    return success(new Invitacion({
      ...this.props,
      activa: true
    }));
  }

  /**
   * Extiende la fecha de expiración de la invitación
   */
  extenderExpiracion(nuevaFecha: Date): Result<Invitacion, DomainError> {
    if (nuevaFecha <= new Date()) {
      return failure(new InvalidValueError(
        'La nueva fecha de expiración debe ser futura',
        'expiraEn',
        nuevaFecha.toISOString()
      ));
    }

    if (nuevaFecha <= this.props.expiraEn) {
      return failure(new InvalidValueError(
        'La nueva fecha de expiración debe ser posterior a la actual',
        'expiraEn',
        nuevaFecha.toISOString()
      ));
    }

    return success(new Invitacion({
      ...this.props,
      expiraEn: nuevaFecha
    }));
  }

  /**
   * Cambia el tipo de permiso de la invitación
   */
  cambiarTipoPermiso(nuevoTipo: PermissionType): Result<Invitacion, DomainError> {
    if (!this.esValida()) {
      return failure(new InvalidValueError(
        'No se puede cambiar el tipo de permiso de una invitación inválida',
        'invitacion',
        'inválida'
      ));
    }

    return success(new Invitacion({
      ...this.props,
      tipoPermiso: nuevoTipo
    }));
  }

  /**
   * Obtiene el enlace completo de la invitación
   */
  obtenerEnlace(baseUrl: string): string {
    return `${baseUrl}/invitations/${this.props.hash.value}`;
  }

  /**
   * Compara dos invitaciones por su ID
   */
  equals(other: Invitacion): boolean {
    return this.props.id === other.props.id;
  }

  /**
   * Convierte la entidad a un objeto plano para persistencia
   */
  toPersistence(): {
    id: string;
    listaId: string;
    hash: string;
    tipoPermiso: string;
    creadaEn: Date;
    expiraEn: Date;
    activa: boolean;
  } {
    return {
      id: this.props.id,
      listaId: this.props.listaId,
      hash: this.props.hash.value,
      tipoPermiso: this.props.tipoPermiso.value,
      creadaEn: this.props.creadaEn,
      expiraEn: this.props.expiraEn,
      activa: this.props.activa
    };
  }

  /**
   * Crea una instancia desde datos de persistencia
   */
  static fromPersistence(data: {
    id: string;
    listaId: string;
    hash: string;
    tipoPermiso: string;
    creadaEn: Date;
    expiraEn: Date;
    activa: boolean;
  }): Result<Invitacion, DomainError> {
    const hashResult = Hash.create(data.hash);
    if (hashResult.isFailure) {
      return failure(hashResult.error);
    }

    const tipoPermisoResult = PermissionType.create(data.tipoPermiso);
    if (tipoPermisoResult.isFailure) {
      return failure(tipoPermisoResult.error);
    }

    return Invitacion.create(
      data.id,
      data.listaId,
      hashResult.value,
      tipoPermisoResult.value,
      data.creadaEn,
      data.expiraEn,
      data.activa
    );
  }
}