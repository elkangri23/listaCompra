/**
 * Caso de uso: Compartir Lista (CU-15)
 * Permite a un usuario con permisos de administrador compartir una lista con otros usuarios
 */

import type { Result } from '@shared/result';
import { success, failure } from '@shared/result';
import { NotFoundError, UnauthorizedError, ValidationError } from '@application/errors';
import type { IListaRepository } from '@application/ports/repositories/IListaRepository';
import type { IUsuarioRepository } from '@application/ports/repositories/IUsuarioRepository';
import type { IInvitacionRepository } from '@application/ports/repositories/IInvitacionRepository';
import type { IPermisoRepository } from '@application/ports/repositories/IPermisoRepository';
import type { IOutboxService } from '@application/ports/messaging/IOutboxService';
import { Lista } from '@domain/entities/Lista';
import { Usuario } from '@domain/entities/Usuario';
import { Invitacion } from '@domain/entities/Invitacion';
import { Permiso } from '@domain/entities/Permiso';
import { PermissionType } from '@domain/value-objects/PermissionType';
import { IInvitationHashGenerator } from '@domain/services/InvitationHashGenerator';
import { ListaCompartida } from '@domain/events/ListaCompartida';

export interface ShareListDto {
  listaId: string;
  usuarioComparteId: string; // Usuario que comparte
  tipoPermiso: string; // 'LECTURA', 'ESCRITURA', 'ADMIN'
  diasExpiracion?: number; // Opcional, por defecto 7 días
}

export interface ShareListResponseDto {
  invitacionId: string;
  hash: string;
  enlaceInvitacion: string;
  expiraEn: Date;
  tipoPermiso: string;
}

export class ShareList {
  constructor(
    private readonly listaRepository: IListaRepository,
    private readonly usuarioRepository: IUsuarioRepository,
    private readonly invitacionRepository: IInvitacionRepository,
    private readonly permisoRepository: IPermisoRepository,
    private readonly hashGenerator: IInvitationHashGenerator,
    private readonly outboxService: IOutboxService,
    private readonly baseUrl: string = 'https://app.listacompra.com'
  ) {}

  async execute(dto: ShareListDto): Promise<Result<ShareListResponseDto, ValidationError | NotFoundError | UnauthorizedError>> {
    // 1. Validar entrada
    const validationResult = this.validateInput(dto);
    if (validationResult.isFailure) {
      return validationResult;
    }

    // 2. Verificar que la lista existe
    const listaResult = await this.listaRepository.findById(dto.listaId);
    if (listaResult.isFailure) {
      return failure(new NotFoundError('Lista', dto.listaId));
    }
    
    const lista = listaResult.value;
    if (!lista) {
      return failure(new NotFoundError('Lista', dto.listaId));
    }

    // 3. Verificar que el usuario existe
    const usuarioResult = await this.usuarioRepository.findById(dto.usuarioComparteId);
    if (usuarioResult.isFailure) {
      return failure(new NotFoundError('Usuario', dto.usuarioComparteId));
    }
    
    const usuario = usuarioResult.value;
    if (!usuario) {
      return failure(new NotFoundError('Usuario', dto.usuarioComparteId));
    }

    // 4. Verificar permisos del usuario para compartir
    const hasPermissionResult = await this.verifySharePermissions(lista, usuario);
    if (hasPermissionResult.isFailure) {
      return hasPermissionResult;
    }

    // 5. Crear tipo de permiso
    const tipoPermisoResult = PermissionType.create(dto.tipoPermiso);
    if (tipoPermisoResult.isFailure) {
      return failure(new ValidationError(
        'Tipo de permiso inválido',
        'tipoPermiso',
        dto.tipoPermiso
      ));
    }

    // 6. Generar hash único para la invitación
    const existingHashes = await this.invitacionRepository.getAllActiveHashes();
    const hashResult = this.hashGenerator.generateUniqueHash(
      dto.listaId,
      existingHashes,
      10,
      dto.usuarioComparteId
    );
    if (hashResult.isFailure) {
      return failure(new ValidationError(
        'Error al generar hash de invitación',
        'hash',
        hashResult.error.message
      ));
    }

    // 7. Calcular fecha de expiración
    const expiraEn = new Date();
    expiraEn.setDate(expiraEn.getDate() + (dto.diasExpiracion || 7));

    // 8. Crear invitación
    const invitacionResult = Invitacion.create(
      `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      dto.listaId,
      hashResult.value,
      tipoPermisoResult.value,
      new Date(),
      expiraEn,
      true
    );

    if (invitacionResult.isFailure) {
      return failure(new ValidationError(
        'Error al crear invitación',
        'invitacion',
        invitacionResult.error.message
      ));
    }

    // 9. Guardar invitación
    const invitacion = invitacionResult.value;
    await this.invitacionRepository.save(invitacion);

    // 10. Publicar evento de lista compartida
    const evento = new ListaCompartida(
      dto.listaId,
      {
        listaId: dto.listaId,
        propietarioId: lista.propietarioId,
        invitacionId: invitacion.id,
        hashCompartir: hashResult.value.value,
        tipoPermiso: dto.tipoPermiso as 'LECTURA' | 'ESCRITURA',
        fechaCompartir: new Date().toISOString(),
        expiraEn: expiraEn.toISOString(),
        nombreLista: lista.nombre,
        emailsInvitados: []
      },
      {
        userId: dto.usuarioComparteId,
        correlationId: `share_${Date.now()}`
      }
    );

    await this.outboxService.saveEvent(evento);

    // 11. Crear respuesta
    return success({
      invitacionId: invitacion.id,
      hash: invitacion.hash.value,
      enlaceInvitacion: invitacion.obtenerEnlace(this.baseUrl),
      expiraEn: invitacion.expiraEn,
      tipoPermiso: invitacion.tipoPermiso.value
    });
  }

  private validateInput(dto: ShareListDto): Result<void, ValidationError> {
    if (!dto.listaId || dto.listaId.trim().length === 0) {
      return failure(new ValidationError('ID de lista es requerido', 'listaId', dto.listaId));
    }

    if (!dto.usuarioComparteId || dto.usuarioComparteId.trim().length === 0) {
      return failure(new ValidationError('ID de usuario que comparte es requerido', 'usuarioComparteId', dto.usuarioComparteId));
    }

    if (!dto.tipoPermiso || dto.tipoPermiso.trim().length === 0) {
      return failure(new ValidationError('Tipo de permiso es requerido', 'tipoPermiso', dto.tipoPermiso));
    }

    if (dto.diasExpiracion !== undefined) {
      if (dto.diasExpiracion < 1 || dto.diasExpiracion > 365) {
        return failure(new ValidationError('Días de expiración debe estar entre 1 y 365', 'diasExpiracion', dto.diasExpiracion));
      }
    }

    return success(undefined);
  }

  private async verifySharePermissions(
    lista: Lista,
    usuario: Usuario
  ): Promise<Result<void, UnauthorizedError>> {
    // Verificar si es el propietario de la lista
    if (lista.propietarioId === usuario.id) {
      return success(undefined);
    }

    // Verificar si tiene permisos de administrador sobre la lista
    const permisos = await this.permisoRepository.findByUsuarioAndLista(usuario.id, lista.id);
    const hasAdminPermission = permisos.some((permiso: Permiso) => permiso.puedeAdministrar());

    if (!hasAdminPermission) {
      return failure(new UnauthorizedError(
        'No tienes permisos para compartir esta lista'
      ));
    }

    return success(undefined);
  }
}