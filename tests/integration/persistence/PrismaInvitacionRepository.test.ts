/**
 * Tests de integración para PrismaInvitacionRepository
 */

import { PrismaClient } from '@prisma/client';
import { PrismaInvitacionRepository } from '../../../src/infrastructure/persistence/repositories/PrismaInvitacionRepository';
import { Invitacion } from '../../../src/domain/entities/Invitacion';
import { Hash } from '../../../src/domain/value-objects/Hash';
import { PermissionType } from '../../../src/domain/value-objects/PermissionType';
import { v4 as uuidv4 } from 'uuid';

describe('PrismaInvitacionRepository Integration Tests', () => {
  let prisma: PrismaClient;
  let repository: PrismaInvitacionRepository;
  let validHash: Hash;
  let validPermissionType: PermissionType;
  let testCounter = 0;

  // Helper para crear datos únicos por test
  const createTestData = async () => {
    testCounter++;
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(7);
    const usuarioId = uuidv4();
    const listaId = uuidv4();
    
    await prisma.usuario.create({
      data: {
        id: usuarioId,
        nombre: `Test User ${testCounter}-${timestamp}`,
        email: `test-${testCounter}-${timestamp}-${randomId}@example.com`,
        password: 'hashedpassword',
        activo: true,
        emailVerificado: true
      }
    });

    await prisma.lista.create({
      data: {
        id: listaId,
        nombre: `Lista de prueba ${testCounter}-${timestamp}`,
        propietarioId: usuarioId,
        activa: true
      }
    });

    return { usuarioId, listaId };
  };

  beforeAll(async () => {
    prisma = new PrismaClient();
    repository = new PrismaInvitacionRepository(prisma);
    
    // Crear value objects válidos
    const hashResult = Hash.create('abcd1234efgh5678ijkl9012mnop3456');
    const permissionResult = PermissionType.create('LECTURA');
    
    if (hashResult.isFailure || permissionResult.isFailure) {
      throw new Error('Error al crear value objects de prueba');
    }
    
    validHash = hashResult.value;
    validPermissionType = permissionResult.value;

    // Conectar a la base de datos
    await prisma.$connect();
  });

  afterAll(async () => {
    // Limpiar datos de prueba al final
    await prisma.invitacion.deleteMany({});
    await prisma.lista.deleteMany({});
    await prisma.usuario.deleteMany({});
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Limpiar datos antes de cada test - solo invitaciones
    await prisma.invitacion.deleteMany({});
  });

  describe('save', () => {
    it('debería guardar una nueva invitación correctamente', async () => {
      const { listaId } = await createTestData();

      const invitacionResult = Invitacion.create(
        uuidv4(),
        listaId,
        validHash,
        validPermissionType
      );

      expect(invitacionResult.isSuccess).toBe(true);
      
      if (invitacionResult.isSuccess) {
        const invitacion = invitacionResult.value;
        
        await expect(repository.save(invitacion)).resolves.not.toThrow();
        
        // Verificar que se guardó correctamente
        const invitacionGuardada = await repository.findById(invitacion.id);
        expect(invitacionGuardada).not.toBeNull();
        expect(invitacionGuardada?.id).toBe(invitacion.id);
        expect(invitacionGuardada?.listaId).toBe(invitacion.listaId);
        expect(invitacionGuardada?.activa).toBe(invitacion.activa);
      }
    });

    it('debería actualizar una invitación existente', async () => {
      const { listaId } = await createTestData();
      
      const hashResult2 = Hash.create('efgh5678ijkl9012mnop3456qrst7890');
      expect(hashResult2.isSuccess).toBe(true);
      
      if (hashResult2.isSuccess) {
        const invitacionResult = Invitacion.create(
          uuidv4(),
          listaId,
          hashResult2.value,
          validPermissionType
        );

        expect(invitacionResult.isSuccess).toBe(true);
        
        if (invitacionResult.isSuccess) {
          const invitacion = invitacionResult.value;
          
          // Guardar inicialmente
          await repository.save(invitacion);
          
          // Desactivar
          const desactivarResult = invitacion.desactivar();
          expect(desactivarResult.isSuccess).toBe(true);
          
          if (desactivarResult.isSuccess) {
            const invitacionDesactivada = desactivarResult.value;
            
            // Actualizar
            await repository.save(invitacionDesactivada);
            
            // Verificar actualización
            const invitacionActualizada = await repository.findById(invitacion.id);
            expect(invitacionActualizada?.activa).toBe(false);
          }
        }
      }
    });
  });

  describe('findById', () => {
    it('debería encontrar una invitación por su ID', async () => {
      const { listaId } = await createTestData();
      
      const hashResult3 = Hash.create('ijkl9012mnop3456qrst7890uvwx1234');
      expect(hashResult3.isSuccess).toBe(true);
      
      if (hashResult3.isSuccess) {
        const invitacionResult = Invitacion.create(
          uuidv4(),
          listaId,
          hashResult3.value,
          validPermissionType
        );

        expect(invitacionResult.isSuccess).toBe(true);
        
        if (invitacionResult.isSuccess) {
          const invitacion = invitacionResult.value;
          await repository.save(invitacion);
          
          const invitacionEncontrada = await repository.findById(invitacion.id);
          
          expect(invitacionEncontrada).not.toBeNull();
          expect(invitacionEncontrada?.id).toBe(invitacion.id);
        }
      }
    });

    it('debería retornar null si la invitación no existe', async () => {
      const invitacionNoExistente = await repository.findById(uuidv4());
      expect(invitacionNoExistente).toBeNull();
    });
  });

  describe('findByHash', () => {
    it('debería encontrar una invitación por su hash', async () => {
      const { listaId } = await createTestData();
      
      const hashResult4 = Hash.create('mnop3456qrst7890uvwx1234yzab5678');
      expect(hashResult4.isSuccess).toBe(true);
      
      if (hashResult4.isSuccess) {
        const invitacionResult = Invitacion.create(
          uuidv4(),
          listaId,
          hashResult4.value,
          validPermissionType
        );

        expect(invitacionResult.isSuccess).toBe(true);
        
        if (invitacionResult.isSuccess) {
          const invitacion = invitacionResult.value;
          await repository.save(invitacion);
          
          const invitacionEncontrada = await repository.findByHash(hashResult4.value.value);
          
          expect(invitacionEncontrada).not.toBeNull();
          expect(invitacionEncontrada?.hash.equals(hashResult4.value)).toBe(true);
        }
      }
    });
  });

  describe('findByListaId', () => {
    it('debería encontrar todas las invitaciones de una lista', async () => {
      const { listaId } = await createTestData();

      // Crear dos invitaciones para la misma lista
      const hash1Result = Hash.create('qrst7890uvwx1234yzab5678cdef9012');
      const hash2Result = Hash.create('uvwx1234yzab5678cdef9012ghij3456');
      
      expect(hash1Result.isSuccess && hash2Result.isSuccess).toBe(true);
      
      if (hash1Result.isSuccess && hash2Result.isSuccess) {
        const invitacion1Result = Invitacion.create(uuidv4(), listaId, hash1Result.value, validPermissionType);
        const invitacion2Result = Invitacion.create(uuidv4(), listaId, hash2Result.value, validPermissionType);
        
        expect(invitacion1Result.isSuccess && invitacion2Result.isSuccess).toBe(true);
        
        if (invitacion1Result.isSuccess && invitacion2Result.isSuccess) {
          await repository.save(invitacion1Result.value);
          await repository.save(invitacion2Result.value);
          
          const invitaciones = await repository.findByListaId(listaId);
          
          expect(invitaciones).toHaveLength(2);
          expect(invitaciones.map((inv: Invitacion) => inv.listaId)).toEqual([listaId, listaId]);
        }
      }
    });
  });

  describe('delete', () => {
    it('debería eliminar una invitación correctamente', async () => {
      const { listaId } = await createTestData();
      
      const hashResult6 = Hash.create('yzab5678cdef9012ghij3456klmn7890');
      expect(hashResult6.isSuccess).toBe(true);
      
      if (hashResult6.isSuccess) {
        const invitacionResult = Invitacion.create(
          uuidv4(),
          listaId,
          hashResult6.value,
          validPermissionType
        );

        expect(invitacionResult.isSuccess).toBe(true);
        
        if (invitacionResult.isSuccess) {
          const invitacion = invitacionResult.value;
          await repository.save(invitacion);
          
          // Verificar que existe
          let invitacionEncontrada = await repository.findById(invitacion.id);
          expect(invitacionEncontrada).not.toBeNull();
          
          // Eliminar
          await repository.delete(invitacion.id);
          
          // Verificar que se eliminó
          invitacionEncontrada = await repository.findById(invitacion.id);
          expect(invitacionEncontrada).toBeNull();
        }
      }
    });
  });
});