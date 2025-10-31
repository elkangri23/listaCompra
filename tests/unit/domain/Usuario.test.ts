import { Usuario, RolUsuario } from '../../../src/domain/entities/Usuario';
import { Email } from '../../../src/domain/value-objects/Email';
import { InvalidValueError, BusinessRuleViolationError } from '../../../src/domain/errors/DomainError';

describe('Entidad Usuario', () => {
  let validEmail: Email;
  let validUsuarioData: any;

  beforeAll(() => {
    const emailResult = Email.create('test@example.com');
    if (emailResult.isSuccess) {
      validEmail = emailResult.value;
      validUsuarioData = {
        email: validEmail,
        password: 'hashedPassword123',
        nombre: 'Juan Carlos',
        apellidos: 'Pérez García',
        rol: RolUsuario.USUARIO,
        activo: true,
        emailVerificado: false,
      };
    }
  });

  describe('create', () => {
    it('debería crear un usuario válido con datos mínimos', () => {
      const data = {
        email: validEmail,
        password: 'hashedPassword123',
        nombre: 'María',
      };

      const result = Usuario.create(data);

      expect(result.isSuccess).toBe(true);
      if (result.isSuccess) {
        const usuario = result.value;
        expect(usuario.nombre).toBe('María');
        expect(usuario.email).toBe(validEmail);
        expect(usuario.password).toBe('hashedPassword123');
        expect(usuario.apellidos).toBeNull();
        expect(usuario.rol).toBe(RolUsuario.USUARIO);
        expect(usuario.activo).toBe(true);
        expect(usuario.emailVerificado).toBe(false);
        expect(usuario.id).toBeDefined();
        expect(usuario.fechaCreacion).toBeInstanceOf(Date);
        expect(usuario.fechaActualizacion).toBeInstanceOf(Date);
      }
    });

    it('debería crear un usuario válido con todos los datos', () => {
      const result = Usuario.create(validUsuarioData);

      expect(result.isSuccess).toBe(true);
      if (result.isSuccess) {
        const usuario = result.value;
        expect(usuario.nombre).toBe('Juan Carlos');
        expect(usuario.apellidos).toBe('Pérez García');
        expect(usuario.rol).toBe(RolUsuario.USUARIO);
        expect(usuario.activo).toBe(true);
        expect(usuario.emailVerificado).toBe(false);
      }
    });

    it('debería fallar con nombre inválido (muy corto)', () => {
      const result = Usuario.create({ 
        ...validUsuarioData, 
        nombre: 'A' 
      });
      
      expect(result.isFailure).toBe(true);
      if (result.isFailure) {
        expect(result.error).toBeInstanceOf(InvalidValueError);
        expect(result.error.message).toContain('entre 2 y 50 caracteres');
      }
    });

    it('debería fallar con nombre inválido (muy largo)', () => {
      const nombreLargo = 'A'.repeat(51);
      const result = Usuario.create({ 
        ...validUsuarioData, 
        nombre: nombreLargo 
      });
      
      expect(result.isFailure).toBe(true);
      if (result.isFailure) {
        expect(result.error).toBeInstanceOf(InvalidValueError);
        expect(result.error.message).toContain('entre 2 y 50 caracteres');
      }
    });

    it('debería fallar con nombre con caracteres inválidos', () => {
      const result = Usuario.create({ 
        ...validUsuarioData, 
        nombre: 'Juan123' 
      });
      
      expect(result.isFailure).toBe(true);
      if (result.isFailure) {
        expect(result.error).toBeInstanceOf(InvalidValueError);
        expect(result.error.message).toContain('solo letras');
      }
    });

    it('debería fallar con apellidos inválidos', () => {
      const apellidosLargos = 'A'.repeat(101);
      const result = Usuario.create({ 
        ...validUsuarioData, 
        apellidos: apellidosLargos 
      });
      
      expect(result.isFailure).toBe(true);
      if (result.isFailure) {
        expect(result.error).toBeInstanceOf(InvalidValueError);
        expect(result.error.message).toContain('entre 2 y 50 caracteres');
      }
    });

    it('debería fallar con password vacío', () => {
      const result = Usuario.create({ 
        ...validUsuarioData, 
        password: '' 
      });
      
      expect(result.isFailure).toBe(true);
      if (result.isFailure) {
        expect(result.error).toBeInstanceOf(InvalidValueError);
        expect(result.error.message).toContain('hash de la contraseña debe ser válido');
      }
    });

    it('debería limpiar espacios en nombre', () => {
      const result = Usuario.create({ 
        ...validUsuarioData, 
        nombre: '  Juan Carlos  ' 
      });
      
      expect(result.isSuccess).toBe(true);
      if (result.isSuccess) {
        expect(result.value.nombre).toBe('Juan Carlos');
      }
    });

    it('debería usar valores por defecto', () => {
      const data = {
        email: validEmail,
        password: 'hashedPassword123',
        nombre: 'Pedro',
      };
      
      const result = Usuario.create(data);
      
      expect(result.isSuccess).toBe(true);
      if (result.isSuccess) {
        const usuario = result.value;
        expect(usuario.rol).toBe(RolUsuario.USUARIO);
        expect(usuario.activo).toBe(true);
        expect(usuario.emailVerificado).toBe(false);
      }
    });
  });

  describe('getters', () => {
    let usuario: Usuario;

    beforeEach(() => {
      const result = Usuario.create(validUsuarioData);
      if (result.isSuccess) {
        usuario = result.value;
      }
    });

    it('debería devolver el nombre completo correctamente', () => {
      expect(usuario.nombreCompleto).toBe('Juan Carlos Pérez García');
    });

    it('debería devolver solo el nombre si no hay apellidos', () => {
      const data = {
        email: validEmail,
        password: 'hashedPassword123',
        nombre: 'Ana',
      };
      
      const result = Usuario.create(data);
      expect(result.isSuccess).toBe(true);
      
      if (result.isSuccess) {
        expect(result.value.nombreCompleto).toBe('Ana');
      }
    });
  });

  describe('actualizarEmail', () => {
    let usuario: Usuario;

    beforeEach(() => {
      const result = Usuario.create(validUsuarioData);
      if (result.isSuccess) {
        usuario = result.value;
      }
    });

    it('debería actualizar el email correctamente', async () => {
      const nuevoEmailResult = Email.create('nuevo@example.com');
      expect(nuevoEmailResult.isSuccess).toBe(true);
      
      if (nuevoEmailResult.isSuccess) {
        await new Promise(resolve => setTimeout(resolve, 1));
        
        const fechaOriginal = usuario.fechaActualizacion.getTime();
        const result = usuario.actualizarEmail(nuevoEmailResult.value);

        expect(result.isSuccess).toBe(true);
        expect(usuario.email).toBe(nuevoEmailResult.value);
        expect(usuario.emailVerificado).toBe(false);
        expect(usuario.fechaActualizacion.getTime()).toBeGreaterThan(fechaOriginal);
      }
    });

    it('debería fallar si el usuario está inactivo', () => {
      usuario.desactivar();
      
      const nuevoEmailResult = Email.create('nuevo@example.com');
      expect(nuevoEmailResult.isSuccess).toBe(true);
      
      if (nuevoEmailResult.isSuccess) {
        const result = usuario.actualizarEmail(nuevoEmailResult.value);
        
        expect(result.isFailure).toBe(true);
        if (result.isFailure) {
          expect(result.error).toBeInstanceOf(BusinessRuleViolationError);
          expect(result.error.message).toContain('usuario inactivo');
        }
      }
    });
  });

  describe('actualizarPassword', () => {
    let usuario: Usuario;

    beforeEach(() => {
      const result = Usuario.create(validUsuarioData);
      if (result.isSuccess) {
        usuario = result.value;
      }
    });

    it('debería actualizar la contraseña correctamente', async () => {
      const fechaOriginal = usuario.fechaActualizacion.getTime();
      
      // Esperar al menos 2ms para asegurar diferencia de timestamp
      await new Promise(resolve => setTimeout(resolve, 5));
      
      const result = usuario.actualizarPassword('nuevoHashPassword456');

      expect(result.isSuccess).toBe(true);
      expect(usuario.password).toBe('nuevoHashPassword456');
      expect(usuario.fechaActualizacion.getTime()).toBeGreaterThanOrEqual(fechaOriginal);
    });

    it('debería fallar con password vacío', () => {
      const result = usuario.actualizarPassword('');
      
      expect(result.isFailure).toBe(true);
      if (result.isFailure) {
        expect(result.error).toBeInstanceOf(InvalidValueError);
        expect(result.error.message).toContain('hash de la contraseña debe ser válido');
      }
    });

    it('debería fallar si el usuario está inactivo', () => {
      usuario.desactivar();
      
      const result = usuario.actualizarPassword('nuevoHashPassword456');
      
      expect(result.isFailure).toBe(true);
      if (result.isFailure) {
        expect(result.error).toBeInstanceOf(BusinessRuleViolationError);
        expect(result.error.message).toContain('usuario inactivo');
      }
    });
  });

  describe('actualizarNombre', () => {
    let usuario: Usuario;

    beforeEach(() => {
      const result = Usuario.create(validUsuarioData);
      if (result.isSuccess) {
        usuario = result.value;
      }
    });

    it('debería actualizar nombre y apellidos correctamente', async () => {
      await new Promise(resolve => setTimeout(resolve, 1));
      
      const fechaOriginal = usuario.fechaActualizacion.getTime();
      const result = usuario.actualizarNombre('Pedro Luis', 'González Ruiz');

      expect(result.isSuccess).toBe(true);
      expect(usuario.nombre).toBe('Pedro Luis');
      expect(usuario.apellidos).toBe('González Ruiz');
      expect(usuario.fechaActualizacion.getTime()).toBeGreaterThanOrEqual(fechaOriginal);
    });

    it('debería actualizar solo el nombre', async () => {
      await new Promise(resolve => setTimeout(resolve, 1));
      
      const result = usuario.actualizarNombre('Pedro Luis');

      expect(result.isSuccess).toBe(true);
      expect(usuario.nombre).toBe('Pedro Luis');
      expect(usuario.apellidos).toBeNull();
    });

    it('debería fallar con nombre inválido', () => {
      const result = usuario.actualizarNombre('P');
      
      expect(result.isFailure).toBe(true);
      if (result.isFailure) {
        expect(result.error).toBeInstanceOf(InvalidValueError);
        expect(result.error.message).toContain('entre 2 y 50 caracteres');
      }
    });
  });

  describe('activar y desactivar', () => {
    let usuario: Usuario;

    beforeEach(() => {
      const result = Usuario.create(validUsuarioData);
      if (result.isSuccess) {
        usuario = result.value;
      }
    });

    it('debería desactivar el usuario', async () => {
      await new Promise(resolve => setTimeout(resolve, 1));
      
      const fechaOriginal = usuario.fechaActualizacion.getTime();
      const result = usuario.desactivar();
      
      expect(result.isSuccess).toBe(true);
      expect(usuario.activo).toBe(false);
      expect(usuario.fechaActualizacion.getTime()).toBeGreaterThan(fechaOriginal);
    });

    it('debería activar el usuario', async () => {
      usuario.desactivar();
      expect(usuario.activo).toBe(false);
      
      await new Promise(resolve => setTimeout(resolve, 1));
      
      const fechaOriginal = usuario.fechaActualizacion.getTime();
      const result = usuario.activar();
      
      expect(result.isSuccess).toBe(true);
      expect(usuario.activo).toBe(true);
      expect(usuario.fechaActualizacion.getTime()).toBeGreaterThan(fechaOriginal);
    });
  });

  describe('verificación de email', () => {
    let usuario: Usuario;

    beforeEach(() => {
      const result = Usuario.create(validUsuarioData);
      if (result.isSuccess) {
        usuario = result.value;
      }
    });

    it('debería verificar el email', async () => {
      await new Promise(resolve => setTimeout(resolve, 1));
      
      const fechaOriginal = usuario.fechaActualizacion.getTime();
      usuario.verificarEmail();
      
      expect(usuario.emailVerificado).toBe(true);
      expect(usuario.fechaActualizacion.getTime()).toBeGreaterThan(fechaOriginal);
    });
  });

  describe('roles y permisos', () => {
    let usuario: Usuario;

    beforeEach(() => {
      const result = Usuario.create(validUsuarioData);
      if (result.isSuccess) {
        usuario = result.value;
      }
    });

    it('esAdmin debería devolver false para usuarios normales', () => {
      expect(usuario.esAdmin()).toBe(false);
    });

    it('puedeAcceder debería considerar estado activo y email verificado', () => {
      // Inicialmente: activo=true, emailVerificado=false
      expect(usuario.puedeAcceder()).toBe(false);
      
      // Verificar email
      usuario.verificarEmail();
      expect(usuario.puedeAcceder()).toBe(true);
      
      // Desactivar usuario
      usuario.desactivar();
      expect(usuario.puedeAcceder()).toBe(false);
    });
  });

  describe('toJSON', () => {
    let usuario: Usuario;

    beforeEach(() => {
      const result = Usuario.create(validUsuarioData);
      if (result.isSuccess) {
        usuario = result.value;
      }
    });

    it('debería convertir a JSON correctamente', () => {
      const json = usuario.toJSON();
      
      expect(json).toMatchObject({
        id: usuario.id,
        email: validEmail.value,
        nombre: 'Juan Carlos',
        apellidos: 'Pérez García',
        nombreCompleto: 'Juan Carlos Pérez García',
        rol: RolUsuario.USUARIO,
        activo: true,
        emailVerificado: false,
      });
      expect(json['fechaCreacion']).toBeDefined();
      expect(json['fechaActualizacion']).toBeDefined();
      expect(json['password']).toBeUndefined(); // No debe incluir la contraseña
    });
  });

  describe('toPersistence', () => {
    let usuario: Usuario;

    beforeEach(() => {
      const result = Usuario.create(validUsuarioData);
      if (result.isSuccess) {
        usuario = result.value;
      }
    });

    it('debería convertir a formato de persistencia correctamente', () => {
      const persistence = usuario.toPersistence();
      
      expect(persistence).toMatchObject({
        id: usuario.id,
        email: validEmail.value,
        password: 'hashedPassword123',
        nombre: 'Juan Carlos',
        apellidos: 'Pérez García',
        rol: RolUsuario.USUARIO,
        activo: true,
        emailVerificado: false,
      });
      expect(persistence['fechaCreacion']).toBeInstanceOf(Date);
      expect(persistence['fechaActualizacion']).toBeInstanceOf(Date);
    });
  });
});