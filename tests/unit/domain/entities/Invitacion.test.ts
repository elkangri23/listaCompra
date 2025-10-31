/**
 * Tests para la entidad Invitacion
 */

import { Invitacion } from '../../../../src/domain/entities/Invitacion';
import { Hash } from '../../../../src/domain/value-objects/Hash';
import { PermissionType } from '../../../../src/domain/value-objects/PermissionType';
import { v4 as uuidv4 } from 'uuid';

describe('Entidad Invitacion', () => {
  let validHash: Hash;
  let validPermissionType: PermissionType;

  beforeEach(() => {
    // Hash de 32 caracteres alfanuméricos válido
    const hashResult = Hash.create('abcd1234efgh5678ijkl9012mnop3456');
    const permissionResult = PermissionType.create('LECTURA');
    
    if (hashResult.isFailure || permissionResult.isFailure) {
      console.log('Hash error:', hashResult.isFailure ? hashResult.error : 'OK');
      console.log('Permission error:', permissionResult.isFailure ? permissionResult.error : 'OK');
      throw new Error('Error al crear value objects de prueba');
    }
    
    validHash = hashResult.value;
    validPermissionType = permissionResult.value;
  });

  describe('create', () => {
    it('debería crear una invitación válida con datos mínimos', () => {
      const id = uuidv4();
      const listaId = uuidv4();
      
      const result = Invitacion.create(
        id,
        listaId,
        validHash,
        validPermissionType
      );

      expect(result.isSuccess).toBe(true);
      if (result.isSuccess) {
        const invitacion = result.value;
        expect(invitacion.id).toBe(id);
        expect(invitacion.listaId).toBe(listaId);
        expect(invitacion.hash).toBe(validHash);
        expect(invitacion.tipoPermiso).toBe(validPermissionType);
        expect(invitacion.activa).toBe(true);
        expect(invitacion.creadaEn).toBeInstanceOf(Date);
        expect(invitacion.expiraEn).toBeInstanceOf(Date);
      }
    });

    it('debería crear una invitación con fecha de expiración personalizada', () => {
      const id = uuidv4();
      const listaId = uuidv4();
      const fechaExpiracion = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas
      
      const result = Invitacion.create(
        id,
        listaId,
        validHash,
        validPermissionType,
        new Date(),
        fechaExpiracion,
        true
      );

      expect(result.isSuccess).toBe(true);
      if (result.isSuccess) {
        const invitacion = result.value;
        expect(invitacion.expiraEn).toEqual(fechaExpiracion);
      }
    });

    it('debería fallar con ID vacío', () => {
      const result = Invitacion.create(
        '',
        uuidv4(),
        validHash,
        validPermissionType
      );

      expect(result.isFailure).toBe(true);
      if (result.isFailure) {
        expect(result.error.message).toContain('ID de invitación no puede estar vacío');
      }
    });

    it('debería fallar con listaId vacío', () => {
      const result = Invitacion.create(
        uuidv4(),
        '',
        validHash,
        validPermissionType
      );

      expect(result.isFailure).toBe(true);
      if (result.isFailure) {
        expect(result.error.message).toContain('ID de lista no puede estar vacío');
      }
    });

    it('debería fallar con fecha de expiración en el pasado', () => {
      const id = uuidv4();
      const listaId = uuidv4();
      const fechaPasada = new Date(Date.now() - 24 * 60 * 60 * 1000); // Ayer
      
      const result = Invitacion.create(
        id,
        listaId,
        validHash,
        validPermissionType,
        new Date(),
        fechaPasada
      );

      expect(result.isFailure).toBe(true);
    });
  });

  describe('métodos de estado', () => {
    let invitacion: Invitacion;

    beforeEach(() => {
      const result = Invitacion.create(
        uuidv4(),
        uuidv4(),
        validHash,
        validPermissionType
      );
      
      if (result.isFailure) {
        throw new Error('Error al crear invitación de prueba');
      }
      
      invitacion = result.value;
    });

    it('debería indicar si está activa', () => {
      expect(invitacion.activa).toBe(true);
    });

    it('debería indicar si ha expirado', () => {
      expect(invitacion.haExpirado()).toBe(false);
    });

    it('debería desactivar la invitación', () => {
      const result = invitacion.desactivar();
      
      expect(result.isSuccess).toBe(true);
      if (result.isSuccess) {
        const invitacionDesactivada = result.value;
        expect(invitacionDesactivada.activa).toBe(false);
      }
    });

    it('debería activar la invitación', () => {
      const resultDesactivar = invitacion.desactivar();
      expect(resultDesactivar.isSuccess).toBe(true);
      
      if (resultDesactivar.isSuccess) {
        const invitacionDesactivada = resultDesactivar.value;
        const resultActivar = invitacionDesactivada.activar();
        
        expect(resultActivar.isSuccess).toBe(true);
        if (resultActivar.isSuccess) {
          const invitacionActivada = resultActivar.value;
          expect(invitacionActivada.activa).toBe(true);
        }
      }
    });

    it('debería verificar si es válida para usar', () => {
      expect(invitacion.esValida()).toBe(true);
      
      const resultDesactivar = invitacion.desactivar();
      if (resultDesactivar.isSuccess) {
        expect(resultDesactivar.value.esValida()).toBe(false);
      }
    });
  });

  describe('conversión de datos', () => {
    let invitacion: Invitacion;

    beforeEach(() => {
      const result = Invitacion.create(
        uuidv4(),
        uuidv4(),
        validHash,
        validPermissionType
      );
      
      if (result.isFailure) {
        throw new Error('Error al crear invitación de prueba');
      }
      
      invitacion = result.value;
    });

    it('debería convertir a JSON correctamente', () => {
      const persistence = invitacion.toPersistence();
      
      expect(persistence).toHaveProperty('id');
      expect(persistence).toHaveProperty('listaId');
      expect(persistence).toHaveProperty('hash');
      expect(persistence).toHaveProperty('tipoPermiso');
      expect(persistence).toHaveProperty('creadaEn');
      expect(persistence).toHaveProperty('expiraEn');
      expect(persistence).toHaveProperty('activa');
    });

    it('debería convertir a formato de persistencia', () => {
      const persistence = invitacion.toPersistence();
      
      expect(persistence).toHaveProperty('id');
      expect(persistence).toHaveProperty('listaId');
      expect(persistence).toHaveProperty('hash');
      expect(persistence).toHaveProperty('tipoPermiso');
      expect(persistence).toHaveProperty('creadaEn');
      expect(persistence).toHaveProperty('expiraEn');
      expect(persistence).toHaveProperty('activa');
    });
  });

  describe('fromPersistence', () => {
    it('debería reconstruir desde datos de persistencia', () => {
      const persistenceData = {
        id: uuidv4(),
        listaId: uuidv4(),
        hash: 'abcd1234efgh5678ijkl9012mnop3456',
        tipoPermiso: 'LECTURA',
        creadaEn: new Date(),
        expiraEn: new Date(Date.now() + 24 * 60 * 60 * 1000),
        activa: true
      };

      const result = Invitacion.fromPersistence(persistenceData);
      
      expect(result.isSuccess).toBe(true);
      if (result.isSuccess) {
        const invitacion = result.value;
        expect(invitacion.id).toBe(persistenceData.id);
        expect(invitacion.listaId).toBe(persistenceData.listaId);
        expect(invitacion.activa).toBe(persistenceData.activa);
      }
    });

    it('debería fallar con datos de persistencia inválidos', () => {
      const persistenceData = {
        id: '',
        listaId: uuidv4(),
        hash: 'abcd1234efgh5678ijkl9012mnop3456',
        tipoPermiso: 'LECTURA',
        creadaEn: new Date(),
        expiraEn: new Date(),
        activa: true
      };

      const result = Invitacion.fromPersistence(persistenceData);
      
      expect(result.isFailure).toBe(true);
    });
  });
});