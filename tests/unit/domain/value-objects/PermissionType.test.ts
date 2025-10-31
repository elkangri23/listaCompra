import { PermissionType, PermissionLevel } from '../../../../src/domain/value-objects/PermissionType';
import { InvalidValueError } from '../../../../src/domain/errors/DomainError';

describe('PermissionType', () => {
  describe('create', () => {
    it('debería crear un tipo de permiso válido para LECTURA', () => {
      const result = PermissionType.create(PermissionLevel.LECTURA);

      expect(result.isSuccess).toBe(true);
      if (result.isSuccess) {
        expect(result.value.level).toBe(PermissionLevel.LECTURA);
        expect(result.value.toString()).toBe('LECTURA');
      }
    });

    it('debería crear un tipo de permiso válido para ESCRITURA', () => {
      const result = PermissionType.create(PermissionLevel.ESCRITURA);

      expect(result.isSuccess).toBe(true);
      if (result.isSuccess) {
        expect(result.value.level).toBe(PermissionLevel.ESCRITURA);
        expect(result.value.toString()).toBe('ESCRITURA');
      }
    });

    it('debería crear un tipo de permiso válido para ADMIN', () => {
      const result = PermissionType.create(PermissionLevel.ADMIN);

      expect(result.isSuccess).toBe(true);
      if (result.isSuccess) {
        expect(result.value.level).toBe(PermissionLevel.ADMIN);
        expect(result.value.toString()).toBe('ADMIN');
      }
    });

    it('debería crear desde string válido', () => {
      const result = PermissionType.create('ESCRITURA');

      expect(result.isSuccess).toBe(true);
      if (result.isSuccess) {
        expect(result.value.level).toBe(PermissionLevel.ESCRITURA);
      }
    });

    it('debería fallar con string inválido', () => {
      const result = PermissionType.create('INVALID');

      expect(result.isSuccess).toBe(false);
      if (!result.isSuccess) {
        expect(result.error).toBeInstanceOf(InvalidValueError);
        expect(result.error.message).toContain('Tipo de permiso inválido');
      }
    });

    it('debería fallar con string vacío', () => {
      const result = PermissionType.create('');

      expect(result.isSuccess).toBe(false);
      if (!result.isSuccess) {
        expect(result.error).toBeInstanceOf(InvalidValueError);
      }
    });

    it('debería fallar con null', () => {
      const result = PermissionType.create(null as any);

      expect(result.isSuccess).toBe(false);
      if (!result.isSuccess) {
        expect(result.error).toBeInstanceOf(InvalidValueError);
      }
    });

    it('debería fallar con undefined', () => {
      const result = PermissionType.create(undefined as any);

      expect(result.isSuccess).toBe(false);
      if (!result.isSuccess) {
        expect(result.error).toBeInstanceOf(InvalidValueError);
      }
    });
  });

  describe('createUnsafe', () => {
    it('debería crear un tipo de permiso válido sin Result wrapper', () => {
      const permission = PermissionType.createUnsafe(PermissionLevel.LECTURA);
      
      expect(permission.level).toBe(PermissionLevel.LECTURA);
      expect(permission.toString()).toBe('LECTURA');
    });

    it('debería lanzar excepción con valor inválido', () => {
      expect(() => {
        PermissionType.createUnsafe('INVALID');
      }).toThrow();
    });
  });

  describe('permission checking methods', () => {
    it('debería verificar si permite lectura', () => {
      const lectura = PermissionType.createUnsafe(PermissionLevel.LECTURA);
      const escritura = PermissionType.createUnsafe(PermissionLevel.ESCRITURA);
      const admin = PermissionType.createUnsafe(PermissionLevel.ADMIN);

      expect(lectura.canRead()).toBe(true);
      expect(escritura.canRead()).toBe(true);
      expect(admin.canRead()).toBe(true);
    });

    it('debería verificar si permite escritura', () => {
      const lectura = PermissionType.createUnsafe(PermissionLevel.LECTURA);
      const escritura = PermissionType.createUnsafe(PermissionLevel.ESCRITURA);
      const admin = PermissionType.createUnsafe(PermissionLevel.ADMIN);

      expect(lectura.canWrite()).toBe(false);
      expect(escritura.canWrite()).toBe(true);
      expect(admin.canWrite()).toBe(true);
    });

    it('debería verificar si permite administración', () => {
      const lectura = PermissionType.createUnsafe(PermissionLevel.LECTURA);
      const escritura = PermissionType.createUnsafe(PermissionLevel.ESCRITURA);
      const admin = PermissionType.createUnsafe(PermissionLevel.ADMIN);

      expect(lectura.canAdmin()).toBe(false);
      expect(escritura.canAdmin()).toBe(false);
      expect(admin.canAdmin()).toBe(true);
    });
  });

  describe('utility methods', () => {
    it('debería verificar niveles de permisos con hasLevel', () => {
      const lectura = PermissionType.createUnsafe(PermissionLevel.LECTURA);
      const escritura = PermissionType.createUnsafe(PermissionLevel.ESCRITURA);
      const admin = PermissionType.createUnsafe(PermissionLevel.ADMIN);

      expect(lectura.hasLevel(PermissionLevel.LECTURA)).toBe(true);
      expect(lectura.hasLevel(PermissionLevel.ESCRITURA)).toBe(false);
      expect(escritura.hasLevel(PermissionLevel.LECTURA)).toBe(true);
      expect(escritura.hasLevel(PermissionLevel.ESCRITURA)).toBe(true);
      expect(admin.hasLevel(PermissionLevel.ADMIN)).toBe(true);
    });

    it('debería verificar igualdad de permisos', () => {
      const lectura1 = PermissionType.createUnsafe(PermissionLevel.LECTURA);
      const lectura2 = PermissionType.createUnsafe(PermissionLevel.LECTURA);
      const escritura = PermissionType.createUnsafe(PermissionLevel.ESCRITURA);

      expect(lectura1.equals(lectura2)).toBe(true);
      expect(lectura1.equals(escritura)).toBe(false);
    });

    it('debería obtener descripción correcta', () => {
      const lectura = PermissionType.createUnsafe(PermissionLevel.LECTURA);
      const escritura = PermissionType.createUnsafe(PermissionLevel.ESCRITURA);
      const admin = PermissionType.createUnsafe(PermissionLevel.ADMIN);

      expect(lectura.getDescription()).toContain('Solo lectura');
      expect(escritura.getDescription()).toContain('escritura');
      expect(admin.getDescription()).toContain('Administrador');
    });

    it('debería convertir a JSON correctamente', () => {
      const permission = PermissionType.createUnsafe(PermissionLevel.ESCRITURA);
      
      expect(permission.toJSON()).toBe('ESCRITURA');
    });
  });

  describe('factory methods', () => {
    it('debería crear permiso de solo lectura', () => {
      const permission = PermissionType.lectura();
      
      expect(permission.level).toBe(PermissionLevel.LECTURA);
      expect(permission.canRead()).toBe(true);
      expect(permission.canWrite()).toBe(false);
    });

    it('debería crear permiso de escritura', () => {
      const permission = PermissionType.escritura();
      
      expect(permission.level).toBe(PermissionLevel.ESCRITURA);
      expect(permission.canRead()).toBe(true);
      expect(permission.canWrite()).toBe(true);
      expect(permission.canAdmin()).toBe(false);
    });

    it('debería crear permiso de administrador', () => {
      const permission = PermissionType.admin();
      
      expect(permission.level).toBe(PermissionLevel.ADMIN);
      expect(permission.canRead()).toBe(true);
      expect(permission.canWrite()).toBe(true);
      expect(permission.canAdmin()).toBe(true);
    });
  });
});