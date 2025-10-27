/**
 * Tests para la entidad Permiso
 */

import { Permiso } from '../../../../src/domain/entities/Permiso';
import { PermissionType } from '../../../../src/domain/value-objects/PermissionType';
import { v4 as uuidv4 } from 'uuid';

describe('Entidad Permiso', () => {
  let validPermissionType: PermissionType;

  beforeEach(() => {
    const permissionResult = PermissionType.create('LECTURA');
    
    if (permissionResult.isFailure) {
      throw new Error('Error al crear PermissionType de prueba');
    }
    
    validPermissionType = permissionResult.value;
  });

  describe('create', () => {
    it('debería crear un permiso válido con datos mínimos', () => {
      const id = uuidv4();
      const usuarioId = uuidv4();
      const listaId = uuidv4();
      
      const result = Permiso.create(
        id,
        usuarioId,
        listaId,
        validPermissionType
      );

      expect(result.isSuccess).toBe(true);
      if (result.isSuccess) {
        const permiso = result.value;
        expect(permiso.id).toBe(id);
        expect(permiso.usuarioId).toBe(usuarioId);
        expect(permiso.listaId).toBe(listaId);
        expect(permiso.tipoPermiso).toBe(validPermissionType);
        expect(permiso.creadoEn).toBeInstanceOf(Date);
      }
    });

    it('debería crear un permiso con fecha personalizada', () => {
      const id = uuidv4();
      const usuarioId = uuidv4();
      const listaId = uuidv4();
      const fechaCreacion = new Date('2023-01-01');
      
      const result = Permiso.create(
        id,
        usuarioId,
        listaId,
        validPermissionType,
        fechaCreacion
      );

      expect(result.isSuccess).toBe(true);
      if (result.isSuccess) {
        const permiso = result.value;
        expect(permiso.creadoEn).toEqual(fechaCreacion);
      }
    });

    it('debería fallar con ID vacío', () => {
      const result = Permiso.create(
        '',
        uuidv4(),
        uuidv4(),
        validPermissionType
      );

      expect(result.isFailure).toBe(true);
      if (result.isFailure) {
        expect(result.error.message).toContain('ID de permiso no puede estar vacío');
      }
    });

    it('debería fallar con usuarioId vacío', () => {
      const result = Permiso.create(
        uuidv4(),
        '',
        uuidv4(),
        validPermissionType
      );

      expect(result.isFailure).toBe(true);
      if (result.isFailure) {
        expect(result.error.message).toContain('ID de usuario no puede estar vacío');
      }
    });

    it('debería fallar con listaId vacío', () => {
      const result = Permiso.create(
        uuidv4(),
        uuidv4(),
        '',
        validPermissionType
      );

      expect(result.isFailure).toBe(true);
      if (result.isFailure) {
        expect(result.error.message).toContain('ID de lista no puede estar vacío');
      }
    });
  });

  describe('métodos de negocio', () => {
    let permiso: Permiso;

    beforeEach(() => {
      const result = Permiso.create(
        uuidv4(),
        uuidv4(),
        uuidv4(),
        validPermissionType
      );
      
      if (result.isFailure) {
        throw new Error('Error al crear permiso de prueba');
      }
      
      permiso = result.value;
    });

    it('debería verificar permisos de lectura', () => {
      expect(permiso.tipoPermiso.canRead()).toBe(true);
    });

    it('debería verificar permisos de escritura', () => {
      expect(permiso.tipoPermiso.canWrite()).toBe(false); // LECTURA no permite escritura
    });

    it('debería verificar permisos de administración', () => {
      expect(permiso.tipoPermiso.canAdmin()).toBe(false); // LECTURA no permite admin
    });

    it('debería actualizar el tipo de permiso', () => {
      const escrituraResult = PermissionType.create('ESCRITURA');
      expect(escrituraResult.isSuccess).toBe(true);
      
      if (escrituraResult.isSuccess) {
        const nuevoTipo = escrituraResult.value;
        const result = permiso.cambiarTipoPermiso(nuevoTipo);
        
        expect(result.isSuccess).toBe(true);
        if (result.isSuccess) {
          const permisoActualizado = result.value;
          expect(permisoActualizado.tipoPermiso).toBe(nuevoTipo);
          expect(permisoActualizado.tipoPermiso.canWrite()).toBe(true);
        }
      }
    });

    it('debería elevar permisos a escritura', () => {
      const result = permiso.elevarAEscritura();
      
      expect(result.isSuccess).toBe(true);
      if (result.isSuccess) {
        const permisoElevado = result.value;
        expect(permisoElevado.tipoPermiso.canWrite()).toBe(true);
      }
    });

    it('debería elevar permisos a administrador', () => {
      const result = permiso.elevarAAdmin();
      
      expect(result.isSuccess).toBe(true);
      if (result.isSuccess) {
        const permisoElevado = result.value;
        expect(permisoElevado.tipoPermiso.canAdmin()).toBe(true);
      }
    });

    it('debería permitir comparar permisos', () => {
      const otroPermiso = Permiso.create(
        permiso.id,
        uuidv4(),
        uuidv4(),
        validPermissionType
      );
      
      if (otroPermiso.isSuccess) {
        expect(permiso.equals(otroPermiso.value)).toBe(true);
      }
    });
  });

  describe('conversión de datos', () => {
    let permiso: Permiso;

    beforeEach(() => {
      const result = Permiso.create(
        uuidv4(),
        uuidv4(),
        uuidv4(),
        validPermissionType
      );
      
      if (result.isFailure) {
        throw new Error('Error al crear permiso de prueba');
      }
      
      permiso = result.value;
    });

    it('debería convertir a formato de persistencia', () => {
      const persistence = permiso.toPersistence();
      
      expect(persistence).toHaveProperty('id');
      expect(persistence).toHaveProperty('usuarioId');
      expect(persistence).toHaveProperty('listaId');
      expect(persistence).toHaveProperty('tipoPermiso');
      expect(persistence).toHaveProperty('creadoEn');
      expect(typeof persistence.tipoPermiso).toBe('string');
    });
  });

  describe('fromPersistence', () => {
    it('debería reconstruir desde datos de persistencia', () => {
      const persistenceData = {
        id: uuidv4(),
        usuarioId: uuidv4(),
        listaId: uuidv4(),
        tipoPermiso: 'ESCRITURA',
        creadoEn: new Date()
      };

      const result = Permiso.fromPersistence(persistenceData);
      
      expect(result.isSuccess).toBe(true);
      if (result.isSuccess) {
        const permiso = result.value;
        expect(permiso.id).toBe(persistenceData.id);
        expect(permiso.usuarioId).toBe(persistenceData.usuarioId);
        expect(permiso.listaId).toBe(persistenceData.listaId);
        expect(permiso.creadoEn).toEqual(persistenceData.creadoEn);
      }
    });

    it('debería fallar con datos de persistencia inválidos', () => {
      const persistenceData = {
        id: '',
        usuarioId: uuidv4(),
        listaId: uuidv4(),
        tipoPermiso: 'LECTURA',
        creadoEn: new Date()
      };

      const result = Permiso.fromPersistence(persistenceData);
      
      expect(result.isFailure).toBe(true);
    });

    it('debería fallar con tipo de permiso inválido', () => {
      const persistenceData = {
        id: uuidv4(),
        usuarioId: uuidv4(),
        listaId: uuidv4(),
        tipoPermiso: 'INVALID_PERMISSION',
        creadoEn: new Date()
      };

      const result = Permiso.fromPersistence(persistenceData);
      
      expect(result.isFailure).toBe(true);
    });
  });

  describe('tipos de permiso específicos', () => {
    it('debería manejar permiso de ESCRITURA correctamente', () => {
      const escrituraResult = PermissionType.create('ESCRITURA');
      expect(escrituraResult.isSuccess).toBe(true);
      
      if (escrituraResult.isSuccess) {
        const result = Permiso.create(
          uuidv4(),
          uuidv4(),
          uuidv4(),
          escrituraResult.value
        );
        
        expect(result.isSuccess).toBe(true);
        if (result.isSuccess) {
          const permiso = result.value;
          expect(permiso.tipoPermiso.canRead()).toBe(true);
          expect(permiso.tipoPermiso.canWrite()).toBe(true);
          expect(permiso.tipoPermiso.canAdmin()).toBe(false);
        }
      }
    });

    it('debería manejar permiso de ADMIN correctamente', () => {
      const adminResult = PermissionType.create('ADMIN');
      expect(adminResult.isSuccess).toBe(true);
      
      if (adminResult.isSuccess) {
        const result = Permiso.create(
          uuidv4(),
          uuidv4(),
          uuidv4(),
          adminResult.value
        );
        
        expect(result.isSuccess).toBe(true);
        if (result.isSuccess) {
          const permiso = result.value;
          expect(permiso.tipoPermiso.canRead()).toBe(true);
          expect(permiso.tipoPermiso.canWrite()).toBe(true);
          expect(permiso.tipoPermiso.canAdmin()).toBe(true);
        }
      }
    });
  });
});