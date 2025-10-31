/**
 * Caso de uso: Registrar nuevo usuario
 * Orquesta el proceso de registro de un nuevo usuario en el sistema
 */

import type { Result } from '@shared/result';
import { success, failure } from '@shared/result';
import type { IUsuarioRepository } from '@application/ports/repositories/IUsuarioRepository';
import type { IPasswordHasher } from '@application/ports/auth/IPasswordHasher';
import type { RegisterUserDto, RegisterUserResponseDto } from '@application/dto/auth/RegisterUserDto';
import { Email } from '@domain/value-objects/Email';
import { Password } from '@domain/value-objects/Password';
import { Usuario } from '@domain/entities/Usuario';
import { ValidationError } from '@application/errors/ValidationError';

export class RegisterUser {
  constructor(
    private readonly usuarioRepository: IUsuarioRepository,
    private readonly passwordHasher: IPasswordHasher
  ) {}

  async execute(dto: RegisterUserDto): Promise<Result<RegisterUserResponseDto, ValidationError | Error>> {
    // 1. Validar y crear email
    const emailResult = Email.create(dto.email);
    if (emailResult.isFailure) {
      return failure(ValidationError.create(
        emailResult.error.message,
        'email',
        dto.email
      ));
    }
    const email = emailResult.value;

    // 2. Verificar que el email no esté en uso
    const existsResult = await this.usuarioRepository.existsByEmail(email);
    if (existsResult.isFailure) {
      return failure(existsResult.error);
    }
    
    if (existsResult.value) {
      return failure(ValidationError.create(
        'Ya existe un usuario registrado con este email',
        'email',
        dto.email
      ));
    }

    // 3. Validar y crear contraseña
    const passwordResult = Password.create(dto.password);
    if (passwordResult.isFailure) {
      return failure(ValidationError.create(
        passwordResult.error.message,
        'password',
        '[HIDDEN]'
      ));
    }
    const password = passwordResult.value;

    // 4. Hashear la contraseña
    const hashResult = await this.passwordHasher.hash(password);
    if (hashResult.isFailure) {
      return failure(hashResult.error);
    }
    const passwordHash = hashResult.value;

    // 5. Crear la entidad usuario
    const usuarioResult = Usuario.create({
      email,
      password: passwordHash,
      nombre: dto.nombre,
      ...(dto.apellidos && { apellidos: dto.apellidos }),
    });

    if (usuarioResult.isFailure) {
      return failure(ValidationError.create(
        usuarioResult.error.message,
        'usuario',
        dto
      ));
    }
    const usuario = usuarioResult.value;

    // 6. Guardar el usuario
    const saveResult = await this.usuarioRepository.save(usuario);
    if (saveResult.isFailure) {
      return failure(saveResult.error);
    }
    const usuarioGuardado = saveResult.value;

    // 7. Retornar respuesta
    const response: RegisterUserResponseDto = {
      id: usuarioGuardado.id,
      email: usuarioGuardado.email.value,
      nombre: usuarioGuardado.nombre,
      ...(usuarioGuardado.apellidos && { apellidos: usuarioGuardado.apellidos }),
      nombreCompleto: usuarioGuardado.nombreCompleto,
      rol: usuarioGuardado.rol,
      activo: usuarioGuardado.activo,
      emailVerificado: usuarioGuardado.emailVerificado,
      fechaCreacion: usuarioGuardado.fechaCreacion.toISOString(),
    };

    return success(response);
  }
}