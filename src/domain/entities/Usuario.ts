/**
 * Entidad Usuario del dominio
 * Representa un usuario en el sistema con todas sus reglas de negocio
 */

import type { UUID } from '@shared/types';
import type { Result } from '@shared/result';
import { success, failure } from '@shared/result';
import { generateUUID, isValidName, sanitizeString, createDate } from '@shared/utils';
import { Email } from '@domain/value-objects/Email';
import { BusinessRuleViolationError, InvalidValueError } from '@domain/errors/DomainError';

export enum RolUsuario {
  USUARIO = 'USUARIO',
  ADMIN = 'ADMIN'
}

export interface UsuarioProps {
  id?: UUID;
  email: Email;
  password: string; // Hash de la contraseña
  nombre: string;
  apellidos?: string;
  rol?: RolUsuario;
  activo?: boolean;
  emailVerificado?: boolean;
  terminosAceptadosEn?: Date | null;
  eliminacionSolicitadaEn?: Date | null;
  // MFA (TOTP) — opcional en create (defaults); reconstruct los recibe del mapper
  totpSecret?: string | null;
  totpEnabled?: boolean;
  totpPendIntentos?: number;
  fechaCreacion?: Date;
  fechaActualizacion?: Date;
}

export class Usuario {
  private constructor(
    private readonly _id: UUID,
    private _email: Email,
    private _password: string, // Hash de la contraseña
    private _nombre: string,
    private _apellidos: string | null,
    private _rol: RolUsuario,
    private _activo: boolean,
    private _emailVerificado: boolean,
    private _terminosAceptadosEn: Date | null,
    private _eliminacionSolicitadaEn: Date | null,
    private _totpSecret: string | null, // AEAD AES-256-GCM (mfa-crypto), formato "v1:..."
    private _totpEnabled: boolean,
    private _totpPendIntentos: number, // cap de fallos de verify-enable sobre el secret pendiente
    private readonly _fechaCreacion: Date,
    private _fechaActualizacion: Date
  ) {}

  static create(props: UsuarioProps): Result<Usuario, InvalidValueError | BusinessRuleViolationError> {
    // Validar nombre
    const nombreSanitizado = sanitizeString(props.nombre);
    if (!isValidName(nombreSanitizado)) {
      return failure(new InvalidValueError(
        'El nombre debe contener solo letras, espacios y tener entre 2 y 50 caracteres',
        'nombre',
        props.nombre
      ));
    }

    // Validar apellidos si se proporcionan
    let apellidosSanitizados: string | null = null;
    if (props.apellidos) {
      apellidosSanitizados = sanitizeString(props.apellidos);
      if (!isValidName(apellidosSanitizados)) {
        return failure(new InvalidValueError(
          'Los apellidos deben contener solo letras, espacios y tener entre 2 y 50 caracteres',
          'apellidos',
          props.apellidos
        ));
      }
    }

    // Validar que la contraseña sea un hash válido (no vacío)
    if (!props.password || props.password.length < 10) {
      return failure(new InvalidValueError(
        'El hash de la contraseña debe ser válido',
        'password',
        '[HIDDEN]'
      ));
    }

    const now = createDate();
    
    return success(new Usuario(
      props.id || generateUUID(),
      props.email,
      props.password,
      nombreSanitizado,
      apellidosSanitizados,
      props.rol || RolUsuario.USUARIO,
      props.activo ?? true,
      props.emailVerificado ?? false,
      props.terminosAceptadosEn ?? null,
      props.eliminacionSolicitadaEn ?? null,
      props.totpSecret ?? null,
      props.totpEnabled ?? false,
      props.totpPendIntentos ?? 0,
      props.fechaCreacion || now,
      props.fechaActualizacion || now
    ));
  }

  static reconstruct(
    props: UsuarioProps & { id: UUID; email: Email; password: string; nombre: string }
  ): Usuario {
    return new Usuario(
      props.id,
      props.email,
      props.password,
      props.nombre,
      props.apellidos || null,
      props.rol ?? RolUsuario.USUARIO,
      props.activo ?? true,
      props.emailVerificado ?? false,
      props.terminosAceptadosEn ?? null,
      props.eliminacionSolicitadaEn ?? null,
      props.totpSecret ?? null,
      props.totpEnabled ?? false,
      props.totpPendIntentos ?? 0,
      props.fechaCreacion ?? new Date(),
      props.fechaActualizacion ?? new Date()
    );
  }

  // Getters
  get id(): UUID {
    return this._id;
  }

  get email(): Email {
    return this._email;
  }

  get password(): string {
    return this._password;
  }

  get nombre(): string {
    return this._nombre;
  }

  get apellidos(): string | null {
    return this._apellidos;
  }

  get nombreCompleto(): string {
    return this._apellidos ? `${this._nombre} ${this._apellidos}` : this._nombre;
  }

  get rol(): RolUsuario {
    return this._rol;
  }

  get activo(): boolean {
    return this._activo;
  }

  // ===== MFA (TOTP) =====
  get totpSecret(): string | null {
    return this._totpSecret;
  }

  get totpEnabled(): boolean {
    return this._totpEnabled;
  }

  get totpPendIntentos(): number {
    return this._totpPendIntentos;
  }

  /** true si hay secret pendiente de confirmar (no activo aún) */
  get totpPendiente(): boolean {
    return this._totpSecret !== null && !this._totpEnabled;
  }

  /** Guarda un secret cifrado nuevo (estado pendiente de confirmar) */
  setTotpPending(encryptedSecret: string): void {
    this._totpSecret = encryptedSecret;
    this._totpEnabled = false;
    this._totpPendIntentos = 0;
    this._touch();
  }

  /** Confirma el TOTP: se activa el pendiente */
  enableTotp(): void {
    this._totpEnabled = true;
    this._totpPendIntentos = 0;
    this._touch();
  }

  /** Desactiva y borra el secret (estado "sin TOTP") */
  disableTotp(): void {
    this._totpSecret = null;
    this._totpEnabled = false;
    this._totpPendIntentos = 0;
    this._touch();
  }

  /** Registra un fallo de verify-enable; devuelve el total acumulado */
  recordTotpPendingFailure(): number {
    this._totpPendIntentos += 1;
    this._touch();
    return this._totpPendIntentos;
  }

  private _touch(): void {
    this._fechaActualizacion = new Date();
  }
  // ===== fin MFA =====

  get emailVerificado(): boolean {
    return this._emailVerificado;
  }

  /** Fecha en la que el usuario aceptó los Términos de Servicio (null en cuentas anteriores al item 1) */
  get terminosAceptadosEn(): Date | null {
    return this._terminosAceptadosEn;
  }

  /** Fecha en la que el usuario solicitó la eliminación de su cuenta (null si no la ha solicitado) */
  get eliminacionSolicitadaEn(): Date | null {
    return this._eliminacionSolicitadaEn;
  }

  get fechaCreacion(): Date {
    return this._fechaCreacion;
  }

  get fechaActualizacion(): Date {
    return this._fechaActualizacion;
  }

  // Métodos de negocio
  actualizarEmail(nuevoEmail: Email): Result<void, BusinessRuleViolationError> {
    if (!this._activo) {
      return failure(new BusinessRuleViolationError(
        'No se puede actualizar el email de un usuario inactivo',
        'USER_INACTIVE'
      ));
    }

    this._email = nuevoEmail;
    this._emailVerificado = false; // Requiere re-verificación
    this._fechaActualizacion = createDate();
    
    return success(undefined);
  }

  actualizarPassword(nuevoPasswordHash: string): Result<void, BusinessRuleViolationError | InvalidValueError> {
    if (!this._activo) {
      return failure(new BusinessRuleViolationError(
        'No se puede actualizar la contraseña de un usuario inactivo',
        'USER_INACTIVE'
      ));
    }

    if (!nuevoPasswordHash || nuevoPasswordHash.length < 10) {
      return failure(new InvalidValueError(
        'El hash de la contraseña debe ser válido',
        'password',
        '[HIDDEN]'
      ));
    }

    this._password = nuevoPasswordHash;
    this._fechaActualizacion = createDate();
    
    return success(undefined);
  }

  actualizarNombre(nuevoNombre: string, nuevosApellidos?: string): Result<void, InvalidValueError> {
    const nombreSanitizado = sanitizeString(nuevoNombre);
    if (!isValidName(nombreSanitizado)) {
      return failure(new InvalidValueError(
        'El nombre debe contener solo letras, espacios y tener entre 2 y 50 caracteres',
        'nombre',
        nuevoNombre
      ));
    }

    let apellidosSanitizados: string | null = null;
    if (nuevosApellidos) {
      apellidosSanitizados = sanitizeString(nuevosApellidos);
      if (!isValidName(apellidosSanitizados)) {
        return failure(new InvalidValueError(
          'Los apellidos deben contener solo letras, espacios y tener entre 2 y 50 caracteres',
          'apellidos',
          nuevosApellidos
        ));
      }
    }

    this._nombre = nombreSanitizado;
    this._apellidos = apellidosSanitizados;
    this._fechaActualizacion = createDate();
    
    return success(undefined);
  }

  verificarEmail(): Result<void, BusinessRuleViolationError> {
    if (!this._activo) {
      return failure(new BusinessRuleViolationError(
        'No se puede verificar el email de un usuario inactivo',
        'USER_INACTIVE'
      ));
    }

    if (this._emailVerificado) {
      return failure(new BusinessRuleViolationError(
        'El email ya está verificado',
        'EMAIL_ALREADY_VERIFIED'
      ));
    }

    this._emailVerificado = true;
    this._fechaActualizacion = createDate();
    
    return success(undefined);
  }

  activar(): Result<void, BusinessRuleViolationError> {
    if (this._activo) {
      return failure(new BusinessRuleViolationError(
        'El usuario ya está activo',
        'USER_ALREADY_ACTIVE'
      ));
    }

    this._activo = true;
    this._fechaActualizacion = createDate();
    
    return success(undefined);
  }

  desactivar(): Result<void, BusinessRuleViolationError> {
    if (!this._activo) {
      return failure(new BusinessRuleViolationError(
        'El usuario ya está inactivo',
        'USER_ALREADY_INACTIVE'
      ));
    }

    this._activo = false;
    this._fechaActualizacion = createDate();
    
    return success(undefined);
  }

  /**
   * Solicita la eliminación de la cuenta (GDPR, item 15): desactiva la
   * cuenta y fija la fecha de solicitud; la purga definitiva llega a los 30 días.
   */
  solicitarEliminacion(): Result<void, BusinessRuleViolationError> {
    if (!this._activo) {
      return failure(new BusinessRuleViolationError(
        'El usuario ya está inactivo',
        'USER_ALREADY_INACTIVE'
      ));
    }

    this._activo = false;
    this._eliminacionSolicitadaEn = new Date();
    this._fechaActualizacion = createDate();

    return success(undefined);
  }

  promoverAAdmin(): Result<void, BusinessRuleViolationError> {
    if (!this._activo) {
      return failure(new BusinessRuleViolationError(
        'No se puede promover un usuario inactivo',
        'USER_INACTIVE'
      ));
    }

    if (this._rol === RolUsuario.ADMIN) {
      return failure(new BusinessRuleViolationError(
        'El usuario ya es administrador',
        'USER_ALREADY_ADMIN'
      ));
    }

    this._rol = RolUsuario.ADMIN;
    this._fechaActualizacion = createDate();
    
    return success(undefined);
  }

  degradarAUsuario(): Result<void, BusinessRuleViolationError> {
    if (this._rol === RolUsuario.USUARIO) {
      return failure(new BusinessRuleViolationError(
        'El usuario ya tiene rol de usuario',
        'USER_ALREADY_USER'
      ));
    }

    this._rol = RolUsuario.USUARIO;
    this._fechaActualizacion = createDate();
    
    return success(undefined);
  }

  // Métodos de consulta
  esAdmin(): boolean {
    return this._rol === RolUsuario.ADMIN;
  }

  puedeAcceder(): boolean {
    return this._activo && this._emailVerificado;
  }

  equals(other: Usuario): boolean {
    return this._id === other._id;
  }

  // Métodos de serialización
  toJSON(): Record<string, unknown> {
    return {
      id: this._id,
      email: this._email.value,
      nombre: this._nombre,
      apellidos: this._apellidos,
      nombreCompleto: this.nombreCompleto,
      rol: this._rol,
      activo: this._activo,
      emailVerificado: this._emailVerificado,
      terminosAceptadosEn: this._terminosAceptadosEn,
      eliminacionSolicitadaEn: this._eliminacionSolicitadaEn,
      fechaCreacion: this._fechaCreacion,
      fechaActualizacion: this._fechaActualizacion,
    };
  }

  // Para persistencia (incluye password hash)
  toPersistence(): Record<string, unknown> {
    return {
      id: this._id,
      email: this._email.value,
      password: this._password,
      nombre: this._nombre,
      apellidos: this._apellidos,
      rol: this._rol,
      activo: this._activo,
      emailVerificado: this._emailVerificado,
      terminosAceptadosEn: this._terminosAceptadosEn,
      eliminacionSolicitadaEn: this._eliminacionSolicitadaEn,
      fechaCreacion: this._fechaCreacion,
      fechaActualizacion: this._fechaActualizacion,
    };
  }
}