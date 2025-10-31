/**
 * Tests de integración para PrismaPermisoRepository
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPermisoRepository } from '../../../src/infrastructure/persistence/repositories/PrismaPermisoRepository';
import { Permiso } from '../../../src/domain/entities/Permiso';
import { PermissionType } from '../../../src/domain/value-objects/PermissionType';
import { v4 as uuidv4 } from 'uuid';

describe('PrismaPermisoRepository Integration Tests', () => {
  let prisma: PrismaClient;
  let repository: PrismaPermisoRepository;
  let validPermissionType: PermissionType;

  // Helper para crear datos únicos por test
  const createTestData = async () => {
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 15);
    const usuarioId = uuidv4();
    const listaId = uuidv4();
    
    await prisma.usuario.create({
      data: {
        id: usuarioId,
        nombre: `Test User Permiso ${timestamp}-${randomId}`,
        email: `testpermiso-${timestamp}-${randomId}@example.com`,
        password: 'hashedpassword',
        activo: true,
        emailVerificado: true
      }
    });

    await prisma.lista.create({
      data: {
        id: listaId,
        nombre: `Lista de prueba permiso ${timestamp}-${randomId}`,
        propietarioId: usuarioId,
        activa: true
      }
    });

    return { usuarioId, listaId };
  };

  beforeAll(async () => {
    prisma = new PrismaClient();
    repository = new PrismaPermisoRepository(prisma);
    
    // Crear PermissionType válido
    const permissionResult = PermissionType.create('LECTURA');
    
    if (permissionResult.isFailure) {
      throw new Error('Error al crear PermissionType de prueba');
    }
    
    validPermissionType = permissionResult.value;

    // Conectar a la base de datos
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Limpiar datos antes de cada test - solo permisos
    await prisma.permiso.deleteMany({});
  });

  describe('save', () => {
    it('debería guardar un nuevo permiso correctamente', async () => {
      const { usuarioId, listaId } = await createTestData();

      const permisoResult = Permiso.create(
        uuidv4(),
        usuarioId,
        listaId,
        validPermissionType
      );

      expect(permisoResult.isSuccess).toBe(true);
      
      if (permisoResult.isSuccess) {
        const permiso = permisoResult.value;
        
        await expect(repository.save(permiso)).resolves.not.toThrow();
        
        // Verificar que se guardó correctamente
        const permisoGuardado = await repository.findById(permiso.id);
        expect(permisoGuardado).not.toBeNull();
        expect(permisoGuardado?.id).toBe(permiso.id);
        expect(permisoGuardado?.usuarioId).toBe(permiso.usuarioId);
        expect(permisoGuardado?.listaId).toBe(permiso.listaId);
      }
    });

    it('debería actualizar un permiso existente usando upsert', async () => {
      const { usuarioId, listaId } = await createTestData();

      const permisoResult = Permiso.create(
        uuidv4(),
        usuarioId,
        listaId,
        validPermissionType
      );

      expect(permisoResult.isSuccess).toBe(true);
      
      if (permisoResult.isSuccess) {
        const permiso = permisoResult.value;
        
        // Guardar inicialmente
        await repository.save(permiso);
        
        // Verificar que se guardó
        const permisoGuardado = await repository.findById(permiso.id);
        expect(permisoGuardado).not.toBeNull();
        expect(permisoGuardado?.tipoPermiso.canWrite()).toBe(false);
      }
    });
  });

  describe('findById', () => {
    it('debería encontrar un permiso por su ID', async () => {
      const { usuarioId, listaId } = await createTestData();

      const permisoResult = Permiso.create(
        uuidv4(),
        usuarioId,
        listaId,
        validPermissionType
      );

      expect(permisoResult.isSuccess).toBe(true);
      
      if (permisoResult.isSuccess) {
        const permiso = permisoResult.value;
        await repository.save(permiso);
        
        const permisoEncontrado = await repository.findById(permiso.id);
        
        expect(permisoEncontrado).not.toBeNull();
        expect(permisoEncontrado?.id).toBe(permiso.id);
      }
    });

    it('debería retornar null si el permiso no existe', async () => {
      const permisoNoExistente = await repository.findById(uuidv4());
      expect(permisoNoExistente).toBeNull();
    });
  });

  describe('findByUsuarioId', () => {
    it('debería encontrar todos los permisos de un usuario', async () => {
      const { usuarioId, listaId } = await createTestData();

      // Crear dos permisos para el mismo usuario en diferentes listas
      const { listaId: lista2Id } = await createTestData();
      
      const permiso1Result = Permiso.create(uuidv4(), usuarioId, listaId, validPermissionType);
      const permiso2Result = Permiso.create(uuidv4(), usuarioId, lista2Id, validPermissionType);
      
      expect(permiso1Result.isSuccess && permiso2Result.isSuccess).toBe(true);
      
      if (permiso1Result.isSuccess && permiso2Result.isSuccess) {
        await repository.save(permiso1Result.value);
        await repository.save(permiso2Result.value);
        
        const permisos = await repository.findByUsuarioId(usuarioId);
        
        expect(permisos.length).toBeGreaterThanOrEqual(1); // Al menos uno
        expect(permisos.map((p: Permiso) => p.usuarioId)).toContain(usuarioId);
      }
    });
  });

  describe('findByListaId', () => {
    it('debería encontrar todos los permisos de una lista', async () => {
      const { usuarioId, listaId } = await createTestData();

      // Crear un permiso para la lista
      const permisoResult = Permiso.create(uuidv4(), usuarioId, listaId, validPermissionType);
      
      expect(permisoResult.isSuccess).toBe(true);
      
      if (permisoResult.isSuccess) {
        await repository.save(permisoResult.value);
        
        const permisos = await repository.findByListaId(listaId);
        
        expect(permisos.length).toBeGreaterThanOrEqual(1); // Al menos uno
        expect(permisos.map((p: Permiso) => p.listaId)).toContain(listaId);
      }
    });
  });

  describe('hasPermission', () => {
    it('debería verificar si un usuario tiene permisos en una lista', async () => {
      const { listaId } = await createTestData();
      const otroUsuarioId = uuidv4();
      
      // Crear otro usuario para evitar conflictos
      await prisma.usuario.create({
        data: {
          id: otroUsuarioId,
          nombre: `Test User Permiso Has ${Date.now()}`,
          email: `testpermiso-has-${Date.now()}@example.com`,
          password: 'hashedpassword',
          activo: true,
          emailVerificado: true
        }
      });

      // Verificar que no tiene permisos inicialmente
      let tienePermisos = await repository.hasPermission(otroUsuarioId, listaId);
      expect(tienePermisos).toBe(false);

      // Crear permiso para el otro usuario
      const permisoResult = Permiso.create(uuidv4(), otroUsuarioId, listaId, validPermissionType);
      
      if (permisoResult.isSuccess) {
        await repository.save(permisoResult.value);
        
        // Verificar que ahora sí tiene permisos
        tienePermisos = await repository.hasPermission(otroUsuarioId, listaId);
        expect(tienePermisos).toBe(true);
      }
    });
  });

  describe('delete', () => {
    it('debería eliminar un permiso correctamente', async () => {
      const { usuarioId, listaId } = await createTestData();

      const permisoResult = Permiso.create(uuidv4(), usuarioId, listaId, validPermissionType);
      
      if (permisoResult.isSuccess) {
        const permiso = permisoResult.value;
        await repository.save(permiso);
        
        // Verificar que existe
        let permisoEncontrado = await repository.findById(permiso.id);
        expect(permisoEncontrado).not.toBeNull();
        
        // Eliminar
        await repository.delete(permiso.id);
        
        // Verificar que se eliminó
        permisoEncontrado = await repository.findById(permiso.id);
        expect(permisoEncontrado).toBeNull();
      }
    });
  });
});