import { Usuario, RolUsuario } from '../../../../src/domain/entities/Usuario';
import { Email } from '../../../../src/domain/value-objects/Email';
import { InvalidValueError } from '../../../../src/domain/errors/DomainError';

describe('Usuario Entity', () => {
  const validEmail = Email.createUnsafe('test@example.com');
  const validPasswordHash = 'hashedPassword123';
  const validNombre = 'Juan';
  const validApellidos = 'Pérez García';

  describe('create', () => {
    it('debería crear un usuario válido con campos mínimos', () => {
      const result = Usuario.create({
        email: validEmail,
        password: validPasswordHash,
        nombre: validNombre
      });

      expect(result.isSuccess).toBe(true);
      if (result.isSuccess) {
        const usuario = result.value;
        expect(usuario.email).toBe(validEmail);
        expect(usuario.nombre).toBe(validNombre);
        expect(usuario.apellidos).toBeNull();
        expect(usuario.rol).toBe(RolUsuario.USUARIO);
        expect(usuario.activo).toBe(true);
        expect(usuario.emailVerificado).toBe(false);
        expect(usuario.id).toBeDefined();
        expect(usuario.fechaCreacion).toBeInstanceOf(Date);
        expect(usuario.fechaActualizacion).toBeInstanceOf(Date);
      }
    });

    it('debería crear un usuario válido con todos los campos', () => {
      const result = Usuario.create({
        email: validEmail,
        password: validPasswordHash,
        nombre: validNombre,
        apellidos: validApellidos,
        rol: RolUsuario.ADMIN,
        activo: true,
        emailVerificado: true
      });

      expect(result.isSuccess).toBe(true);
      if (result.isSuccess) {
        const usuario = result.value;
        expect(usuario.nombre).toBe(validNombre);
        expect(usuario.apellidos).toBe(validApellidos);
        expect(usuario.nombreCompleto).toBe(`${validNombre} ${validApellidos}`);
        expect(usuario.rol).toBe(RolUsuario.ADMIN);
        expect(usuario.activo).toBe(true);
        expect(usuario.emailVerificado).toBe(true);
      }
    });

    it('debería fallar con nombre inválido', () => {
      const invalidNames = [
        '',
        'A',
        'A'.repeat(51),
        '123',
        'Juan123',
        'Juan@'
      ];

      invalidNames.forEach(nombre => {
        const result = Usuario.create({
          email: validEmail,
          password: validPasswordHash,
          nombre
        });

        expect(result.isSuccess).toBe(false);
        if (!result.isSuccess) {
          expect(result.error).toBeInstanceOf(InvalidValueError);
          expect(result.error.message).toContain('nombre');
        }
      });
    });

    it('debería fallar con apellidos inválidos', () => {
      const invalidApellidos = [
        'A',
        'A'.repeat(51),
        '123',
        'García123',
        'García@'
      ];

      invalidApellidos.forEach(apellidos => {
        const result = Usuario.create({
          email: validEmail,
          password: validPasswordHash,
          nombre: validNombre,
          apellidos
        });

        expect(result.isSuccess).toBe(false);
        if (!result.isSuccess) {
          expect(result.error).toBeInstanceOf(InvalidValueError);
          expect(result.error.message).toContain('apellidos');
        }
      });
    });

    it('debería fallar con password hash inválido', () => {
      const invalidPasswords = [
        '',
        'short',
        '123456789'  // Menos de 10 caracteres
      ];

      invalidPasswords.forEach(password => {
        const result = Usuario.create({
          email: validEmail,
          password,
          nombre: validNombre
        });

        expect(result.isSuccess).toBe(false);
        if (!result.isSuccess) {
          expect(result.error).toBeInstanceOf(InvalidValueError);
          expect(result.error.message).toContain('contraseña');
        }
      });
    });

    it('debería aceptar nombres con espacios y acentos', () => {
      const validNames = [
        'María José',
        'José Luis',
        'Ángel',
        'Sofía'
      ];

      validNames.forEach(nombre => {
        const result = Usuario.create({
          email: validEmail,
          password: validPasswordHash,
          nombre
        });

        expect(result.isSuccess).toBe(true);
      });
    });
  });

  describe('reconstruct', () => {
    it('debería reconstruir un usuario desde datos persistidos', () => {
      const now = new Date();
      const usuario = Usuario.reconstruct({
        id: 'test-id-123',
        email: validEmail,
        password: validPasswordHash,
        nombre: validNombre,
        apellidos: validApellidos,
        rol: RolUsuario.ADMIN,
        activo: true,
        emailVerificado: true,
        fechaCreacion: now,
        fechaActualizacion: now
      });

      expect(usuario.id).toBe('test-id-123');
      expect(usuario.nombre).toBe(validNombre);
      expect(usuario.apellidos).toBe(validApellidos);
      expect(usuario.rol).toBe(RolUsuario.ADMIN);
      expect(usuario.fechaCreacion).toBe(now);
    });
  });

  describe('business methods', () => {
    let usuario: Usuario;

    beforeEach(() => {
      const result = Usuario.create({
        email: validEmail,
        password: validPasswordHash,
        nombre: validNombre,
        apellidos: validApellidos
      });
      
      if (result.isSuccess) {
        usuario = result.value;
      } else {
        throw new Error('Failed to create test user');
      }
    });

    it('debería actualizar nombre correctamente', () => {
      const fechaCreacionAnterior = new Date(usuario.fechaCreacion);
      const nuevoNombre = 'Carlos';
      const result = usuario.actualizarNombre(nuevoNombre);

      expect(result.isSuccess).toBe(true);
      expect(usuario.nombre).toBe(nuevoNombre);
      expect(usuario.fechaActualizacion.getTime()).toBeGreaterThanOrEqual(fechaCreacionAnterior.getTime());
    });

    it('debería fallar al actualizar con nombre inválido', () => {
      const result = usuario.actualizarNombre('123');

      expect(result.isSuccess).toBe(false);
      expect(usuario.nombre).toBe(validNombre); // No debería cambiar
    });

    it('debería actualizar nombre y apellidos correctamente', () => {
      const nuevoNombre = 'Carlos';
      const nuevosApellidos = 'González López';
      const result = usuario.actualizarNombre(nuevoNombre, nuevosApellidos);

      expect(result.isSuccess).toBe(true);
      expect(usuario.nombre).toBe(nuevoNombre);
      expect(usuario.apellidos).toBe(nuevosApellidos);
      expect(usuario.nombreCompleto).toBe(`${nuevoNombre} ${nuevosApellidos}`);
    });

    it('debería limpiar apellidos cuando se pasa cadena vacía', () => {
      const result = usuario.actualizarNombre(validNombre, '');

      expect(result.isSuccess).toBe(true);
      expect(usuario.nombre).toBe(validNombre);
      expect(usuario.apellidos).toBeNull();
      expect(usuario.nombreCompleto).toBe(validNombre);
    });

    it('debería actualizar email correctamente', () => {
      const nuevoEmail = Email.createUnsafe('nuevo@example.com');
      const result = usuario.actualizarEmail(nuevoEmail);

      expect(result.isSuccess).toBe(true);
      expect(usuario.email).toBe(nuevoEmail);
      expect(usuario.emailVerificado).toBe(false); // Se resetea
    });

    it('debería actualizar contraseña correctamente', () => {
      const nuevoHash = 'newHashedPassword123';
      const result = usuario.actualizarPassword(nuevoHash);

      expect(result.isSuccess).toBe(true);
      expect(usuario.password).toBe(nuevoHash);
    });

    it('debería verificar email correctamente', () => {
      const result = usuario.verificarEmail();

      expect(result.isSuccess).toBe(true);
      expect(usuario.emailVerificado).toBe(true);
    });

    it('debería activar usuario correctamente', () => {
      usuario.desactivar();
      expect(usuario.activo).toBe(false);

      const result = usuario.activar();
      expect(result.isSuccess).toBe(true);
      expect(usuario.activo).toBe(true);
    });

    it('debería desactivar usuario correctamente', () => {
      const result = usuario.desactivar();

      expect(result.isSuccess).toBe(true);
      expect(usuario.activo).toBe(false);
    });

    it('debería promover a admin correctamente', () => {
      const result = usuario.promoverAAdmin();

      expect(result.isSuccess).toBe(true);
      expect(usuario.rol).toBe(RolUsuario.ADMIN);
    });

    it('debería degradar a usuario normal correctamente', () => {
      // Primero promover a admin
      usuario.promoverAAdmin();
      expect(usuario.rol).toBe(RolUsuario.ADMIN);

      // Luego degradar
      const result = usuario.degradarAUsuario();

      expect(result.isSuccess).toBe(true);
      expect(usuario.rol).toBe(RolUsuario.USUARIO);
    });
  });

  describe('utility methods', () => {
    let usuario: Usuario;

    beforeEach(() => {
      const result = Usuario.create({
        email: validEmail,
        password: validPasswordHash,
        nombre: validNombre,
        apellidos: validApellidos,
        rol: RolUsuario.ADMIN
      });
      
      if (result.isSuccess) {
        usuario = result.value;
      }
    });

    it('debería verificar si es admin correctamente', () => {
      expect(usuario.esAdmin()).toBe(true);

      usuario.degradarAUsuario();
      expect(usuario.esAdmin()).toBe(false);
    });

    it('debería verificar si puede acceder', () => {
      // Primero verificar email para que pueda acceder
      usuario.verificarEmail();
      expect(usuario.puedeAcceder()).toBe(true);

      usuario.desactivar();
      expect(usuario.puedeAcceder()).toBe(false);
    });

    it('debería convertir a JSON correctamente', () => {
      const json = usuario.toJSON();

      expect(json).toEqual({
        id: usuario.id,
        email: validEmail.value,
        nombre: validNombre,
        apellidos: validApellidos,
        nombreCompleto: `${validNombre} ${validApellidos}`,
        rol: RolUsuario.ADMIN,
        activo: true,
        emailVerificado: false,
        fechaCreacion: usuario.fechaCreacion,
        fechaActualizacion: usuario.fechaActualizacion
      });
    });

    it('debería convertir a persistencia correctamente', () => {
      const persistence = usuario.toPersistence();

      expect(persistence).toEqual({
        id: usuario.id,
        email: validEmail.value,
        password: validPasswordHash,
        nombre: validNombre,
        apellidos: validApellidos,
        rol: RolUsuario.ADMIN,
        activo: true,
        emailVerificado: false,
        fechaCreacion: usuario.fechaCreacion,
        fechaActualizacion: usuario.fechaActualizacion
      });
    });

    it('debería verificar igualdad correctamente', () => {
      const otroUsuario = Usuario.create({
        email: Email.createUnsafe('otro@example.com'),
        password: validPasswordHash,
        nombre: 'Otro'
      });

      if (otroUsuario.isSuccess) {
        expect(usuario.equals(otroUsuario.value)).toBe(false);
        expect(usuario.equals(usuario)).toBe(true);
      }
    });
  });

  describe('edge cases', () => {
    it('debería manejar nombres con espacios múltiples', () => {
      const result = Usuario.create({
        email: validEmail,
        password: validPasswordHash,
        nombre: '  María   José  '
      });

      expect(result.isSuccess).toBe(true);
      if (result.isSuccess) {
        expect(result.value.nombre).toBe('María José'); // Espacios normalizados
      }
    });

    it('debería manejar casos límite de longitud', () => {
      const nombreLimite = 'A'.repeat(50);
      const result = Usuario.create({
        email: validEmail,
        password: validPasswordHash,
        nombre: nombreLimite
      });

      expect(result.isSuccess).toBe(true);
    });

    it('debería preservar fechas en reconstruct', () => {
      const fechaCreacion = new Date('2023-01-01');
      const fechaActualizacion = new Date('2023-06-01');
      
      const usuario = Usuario.reconstruct({
        id: 'test-id',
        email: validEmail,
        password: validPasswordHash,
        nombre: validNombre,
        apellidos: validApellidos,
        rol: RolUsuario.USUARIO,
        activo: true,
        emailVerificado: false,
        fechaCreacion,
        fechaActualizacion
      });

      expect(usuario.fechaCreacion).toBe(fechaCreacion);
      expect(usuario.fechaActualizacion).toBe(fechaActualizacion);
    });
  });
});