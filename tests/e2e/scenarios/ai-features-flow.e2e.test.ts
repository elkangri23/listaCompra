/**
 * @fileoverview Tests E2E para funcionalidades de Inteligencia Artificial
 * Incluye categorización automática y sugerencias
 */

import request from 'supertest';
import type { Application } from 'express';
import { createServer } from '../../../src/infrastructure/http/server';
import { Container } from '../../../src/composition/container';

describe('E2E: AI Features Flow', () => {
  let app: Application;
  let authToken: string;
  let adminToken: string;
  let listaId: string;

  const testUser = {
    email: `aiuser-${Date.now()}@example.com`,
    password: 'TestPassword123!',
    nombre: 'Usuario',
    apellidos: 'IA'
  };

  const adminUser = {
    email: `admin-${Date.now()}@example.com`,
    password: 'AdminPassword123!',
    nombre: 'Admin',
    apellidos: 'IA',
    role: 'ADMIN'
  };

  beforeAll(async () => {
    // Crear servidor con dependencias reales
    const container = Container.getInstance();
    const dependencies = {
      authController: container.authController,
      invitationController: container.invitationController,
      adminController: container.adminController,
      authMiddleware: container.authMiddleware
    };
    app = await createServer(dependencies);

    // Registrar usuarios de prueba
    await request(app)
      .post('/api/v1/auth/register')
      .send(testUser);

    await request(app)
      .post('/api/v1/auth/register')
      .send(adminUser);

    // Autenticar usuarios
    const authResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: testUser.email,
        password: testUser.password
      });
    authToken = authResponse.body.data.token;

    const adminAuthResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: adminUser.email,
        password: adminUser.password
      });
    adminToken = adminAuthResponse.body.data.token;

    // Crear lista para pruebas
    const listaResponse = await request(app)
      .post('/api/v1/lists')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        nombre: 'Lista para IA',
        descripcion: 'Lista para probar funcionalidades de IA'
      });
    listaId = listaResponse.body.data.id;
  });

  describe('Sugerencias de Categorización', () => {
    it('1. Debe obtener sugerencias para producto de alimentación', async () => {
      const response = await request(app)
        .post('/api/ai/category-suggestions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productName: 'Leche entera'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('suggestions');
      expect(Array.isArray(response.body.data.suggestions)).toBe(true);
      expect(response.body.data.suggestions.length).toBeGreaterThan(0);
      expect(response.body.data).toHaveProperty('requestId');
      expect(response.body.data).toHaveProperty('confidence');

      // Verificar que al menos una sugerencia sea relacionada con alimentación
      const hasAlimentation = response.body.data.suggestions.some(
        (s: any) => s.category.toLowerCase().includes('aliment') || 
                   s.category.toLowerCase().includes('láct') ||
                   s.category.toLowerCase().includes('dairy')
      );
      expect(hasAlimentation).toBe(true);
    });

    it('2. Debe obtener sugerencias para producto de limpieza', async () => {
      const response = await request(app)
        .post('/api/ai/category-suggestions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productName: 'Detergente para ropa'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.suggestions.length).toBeGreaterThan(0);

      // Verificar que al menos una sugerencia sea relacionada con limpieza
      const hasCleaning = response.body.data.suggestions.some(
        (s: any) => s.category.toLowerCase().includes('limpie') || 
                   s.category.toLowerCase().includes('hogar') ||
                   s.category.toLowerCase().includes('clean')
      );
      expect(hasCleaning).toBe(true);
    });

    it('3. Debe obtener sugerencias para producto de tecnología', async () => {
      const response = await request(app)
        .post('/api/ai/category-suggestions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productName: 'Cable USB-C'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.suggestions.length).toBeGreaterThan(0);

      // Verificar que al menos una sugerencia sea relacionada con tecnología
      const hasTech = response.body.data.suggestions.some(
        (s: any) => s.category.toLowerCase().includes('tecnol') || 
                   s.category.toLowerCase().includes('electr') ||
                   s.category.toLowerCase().includes('tech')
      );
      expect(hasTech).toBe(true);
    });

    it('4. Debe rechazar productos con nombres vacíos', async () => {
      const response = await request(app)
        .post('/api/ai/category-suggestions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productName: ''
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('nombre');
    });

    it('5. Debe rechazar productos con nombres muy largos', async () => {
      const longName = 'A'.repeat(256); // Más de 255 caracteres
      
      const response = await request(app)
        .post('/api/ai/category-suggestions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productName: longName
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('largo');
    });

    it('6. Debe detectar patrones sospechosos en nombres de productos', async () => {
      const response = await request(app)
        .post('/api/ai/category-suggestions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productName: '<script>alert("hack")</script>'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('inválido');
    });

    it('7. Debe manejar productos con nombres únicos o poco comunes', async () => {
      const response = await request(app)
        .post('/api/ai/category-suggestions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productName: 'Producto Inventado XYZ123'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.suggestions.length).toBeGreaterThan(0);
      expect(response.body.data.confidence).toBeDefined();
      // Para productos desconocidos, la confianza debería ser menor
      expect(response.body.data.confidence).toBeLessThan(0.8);
    });
  });

  describe('Integración con Gestión de Productos', () => {
    it('1. Debe añadir producto y obtener categorización automática', async () => {
      const response = await request(app)
        .post(`/api/v1/lists/${listaId}/products`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          nombre: 'Manzanas Golden',
          cantidad: 5,
          precio: 3.50,
          descripcion: 'Manzanas golden delicious'
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.nombre).toBe('Manzanas Golden');
      
      // Si la IA está habilitada, debería tener categoría sugerida
      if (response.body.data.categoriaSugerida) {
        expect(typeof response.body.data.categoriaSugerida).toBe('string');
        // Para manzanas, esperamos categoría relacionada con frutas/alimentación
        expect(response.body.data.categoriaSugerida.toLowerCase())
          .toMatch(/(frut|aliment|comid|food|fruit)/i);
      }
    });

    it('2. Debe obtener múltiples sugerencias para lista de productos', async () => {
      const productos = [
        'Tomates cherry',
        'Papel higiénico',
        'Smartphone Samsung',
        'Yogur natural'
      ];

      for (const producto of productos) {
        const response = await request(app)
          .post('/api/ai/category-suggestions')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            productName: producto
          })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.suggestions.length).toBeGreaterThan(0);
        
        // Verificar que cada sugerencia tiene la estructura correcta
        response.body.data.suggestions.forEach((suggestion: any) => {
          expect(suggestion).toHaveProperty('category');
          expect(suggestion).toHaveProperty('confidence');
          expect(typeof suggestion.category).toBe('string');
          expect(typeof suggestion.confidence).toBe('number');
          expect(suggestion.confidence).toBeGreaterThanOrEqual(0);
          expect(suggestion.confidence).toBeLessThanOrEqual(1);
        });
      }
    });
  });

  describe('Estado de Salud y Métricas de IA', () => {
    it('1. Debe obtener estado de salud del servicio de IA', async () => {
      const response = await request(app)
        .get('/api/ai/health')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('status');
      expect(response.body.data).toHaveProperty('timestamp');
      expect(response.body.data).toHaveProperty('services');
      
      // Verificar estructura de servicios
      expect(response.body.data.services).toHaveProperty('perplexity');
      expect(response.body.data.services).toHaveProperty('cache');
    });

    it('2. Admin debe obtener información de uso de IA', async () => {
      const response = await request(app)
        .get('/api/ai/usage')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalRequests');
      expect(response.body.data).toHaveProperty('successRate');
      expect(response.body.data).toHaveProperty('averageResponseTime');
      expect(response.body.data).toHaveProperty('cacheStats');
      
      // Verificar tipos de datos
      expect(typeof response.body.data.totalRequests).toBe('number');
      expect(typeof response.body.data.successRate).toBe('number');
      expect(typeof response.body.data.averageResponseTime).toBe('number');
    });

    it('3. Usuario normal NO debe acceder a métricas de administrador', async () => {
      const response = await request(app)
        .get('/api/ai/usage')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('permisos');
    });
  });

  describe('Rate Limiting y Rendimiento', () => {
    it('1. Debe respetar límites de velocidad para solicitudes de IA', async () => {
      // Hacer múltiples solicitudes rápidas para probar rate limiting
      const requests = Array.from({ length: 5 }, () =>
        request(app)
          .post('/api/ai/category-suggestions')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            productName: `Producto Test ${Math.random()}`
          })
      );

      const responses = await Promise.all(requests);

      // Todas las solicitudes deberían ser exitosas o algunas limitadas por rate
      responses.forEach(response => {
        expect([200, 429]).toContain(response.status);
        if (response.status === 429) {
          expect(response.body.error).toContain('límite');
        }
      });
    });

    it('2. Debe responder en tiempo razonable', async () => {
      const startTime = Date.now();
      
      const response = await request(app)
        .post('/api/ai/category-suggestions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productName: 'Producto para test de rendimiento'
        })
        .expect(200);

      const responseTime = Date.now() - startTime;
      
      expect(response.body.success).toBe(true);
      // La respuesta debería ser menor a 5 segundos (5000ms)
      expect(responseTime).toBeLessThan(5000);
    });
  });

  describe('Casos límite y manejo de errores', () => {
    it('1. Debe manejar productos con caracteres especiales', async () => {
      const response = await request(app)
        .post('/api/ai/category-suggestions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productName: 'Café con açúcar & crème'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.suggestions.length).toBeGreaterThan(0);
    });

    it('2. Debe manejar productos en diferentes idiomas', async () => {
      const productos = [
        'Bread',
        'Pan',
        'Pão',
        'パン'
      ];

      for (const producto of productos) {
        const response = await request(app)
          .post('/api/ai/category-suggestions')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            productName: producto
          })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.suggestions.length).toBeGreaterThan(0);
      }
    });

    it('3. Debe manejar productos con números y códigos', async () => {
      const response = await request(app)
        .post('/api/ai/category-suggestions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productName: 'iPhone 15 Pro Max 256GB'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.suggestions.length).toBeGreaterThan(0);
      
      // Para iPhone, esperamos categoría de tecnología/electrónicos
      const hasTechCategory = response.body.data.suggestions.some(
        (s: any) => s.category.toLowerCase().includes('tecnol') || 
                   s.category.toLowerCase().includes('electr') ||
                   s.category.toLowerCase().includes('móvil') ||
                   s.category.toLowerCase().includes('tech')
      );
      expect(hasTechCategory).toBe(true);
    });

    it('4. Debe rechazar solicitudes sin autenticación', async () => {
      const response = await request(app)
        .post('/api/ai/category-suggestions')
        .send({
          productName: 'Producto sin auth'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('token');
    });
  });
});