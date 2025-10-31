/**
 * @fileoverview Tests E2E para funcionalidades de Inteligencia Artificial
 * Incluye categorización automática y sugerencias
 */

import request from 'supertest';
import type { Application } from 'express';
import { createServer } from '../../../src/infrastructure/http/server';
import { Container } from '../../../src/composition/container';
import { AIController } from '../../../src/infrastructure/http/controllers/AIController';
import { GetCategorySuggestionsUseCase } from '../../../src/application/use-cases/ai/GetCategorySuggestions';
import { Email } from '../../../src/domain/value-objects/Email';

jest.mock('bcrypt', () => {
  const hash = async (value: string) => `hashed:${value}`;
  const compare = async (value: string, hashed: string) => hashed === `hashed:${value}`;
  return { hash, compare };
});

jest.mock('../../../src/infrastructure/external-services/ai/PerplexityService', () => {
  class MockPerplexityService {
    async suggestCategories(productName: string): Promise<any[]> {
      const lower = productName.toLowerCase();

      if (lower.includes('leche')) {
        return [
          { category: 'Lácteos', confidence: 0.92, reasoning: 'Producto lácteo' },
          { category: 'Alimentación', confidence: 0.8 },
        ];
      }

      if (lower.includes('detergente') || lower.includes('limp')) {
        return [
          { category: 'Limpieza del Hogar', confidence: 0.9 },
          { category: 'Hogar', confidence: 0.7 },
        ];
      }

      if (lower.includes('cable') || lower.includes('iphone')) {
        return [
          { category: 'Tecnología', confidence: 0.88 },
          { category: 'Electrónica', confidence: 0.76 },
        ];
      }

      return [
        { category: `General`, confidence: 0.6 },
      ];
    }

    async analyzePurchaseHabits(): Promise<any[]> {
      return [];
    }

    async recommendProducts(): Promise<any[]> {
      return [];
    }

    async generateOccasionList(): Promise<string> {
      return JSON.stringify({ items: [], metadata: { source: 'mock' } });
    }

    async getProductRecommendations(): Promise<string> {
      return JSON.stringify({ recommendations: [] });
    }

    async bulkCategorizeProducts(products: Array<{ nombre: string }>): Promise<string> {
      return JSON.stringify({
        products: products.map((product, index) => ({
          nombre: product.nombre,
          suggestedCategory: {
            nombre: `Categoría ${index + 1}`,
            confidence: 0.85,
          },
          alternativeCategories: []
        })),
        statistics: {
          total: products.length,
          successful: products.length,
          failed: 0,
          fromCache: false,
        }
      });
    }

    async analyzeWithAI(): Promise<any> {
      return {
        content: 'mock-content',
        tokensUsed: 0,
        model: 'mock-model',
        timestamp: new Date(),
      };
    }

    async isAvailable(): Promise<boolean> {
      return true;
    }

    async getUsageInfo(): Promise<any> {
      return {
        provider: 'mock',
        usage: {
          totalRequests: 42,
          successfulRequests: 40,
          failedRequests: 2,
          tokensUsed: 1234,
          successRate: 0.95,
        },
        cache: {
          hitRatio: 0.7,
          savedRequests: 15,
          estimatedSavings: 1.2,
        },
        limits: {
          rateLimitRemaining: 90,
          resetTime: new Date().toISOString(),
        },
      };
    }
  }

  return { PerplexityService: MockPerplexityService };
});

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
    const getCategorySuggestionsUseCase = new GetCategorySuggestionsUseCase({
      aiService: container.aiService,
    });
    const bulkCategorizeUseCase = (container as any)._bulkCategorizeProducts;
    const aiController = new AIController(
      getCategorySuggestionsUseCase,
      bulkCategorizeUseCase
    );
    const dependencies = {
      authController: container.authController,
      invitationController: container.invitationController,
      adminController: container.adminController,
      aiController,
      authMiddleware: container.authMiddleware,
      listController: container.listController,
      productController: container.productController,
      categoryController: container.categoryController
    };
    app = await createServer(dependencies);

    // Registrar usuarios de prueba
    const userRegisterResponse = await request(app)
      .post('/api/v1/auth/register')
      .send(testUser);
    if (userRegisterResponse.status !== 201) {
      console.error('Error registrando usuario de pruebas', userRegisterResponse.body);
    }
    expect(userRegisterResponse.status).toBe(201);

    const adminRegisterResponse = await request(app)
      .post('/api/v1/auth/register')
      .send(adminUser);
    if (adminRegisterResponse.status !== 201) {
      console.error('Error registrando usuario admin', adminRegisterResponse.body);
    }
    expect(adminRegisterResponse.status).toBe(201);

    const adminEmail = Email.create(adminUser.email);
    if (adminEmail.isFailure) {
      throw new Error(`Email inválido para admin: ${adminUser.email}`);
    }

    const adminEntityResult = await container.usuarioRepository.findByEmail(adminEmail.value);
    if (adminEntityResult.isFailure || !adminEntityResult.value) {
      throw new Error('No se pudo recuperar el usuario admin para promoción');
    }

    const promoteResult = adminEntityResult.value.promoverAAdmin();
    if (promoteResult.isFailure) {
      throw new Error('No se pudo promover al usuario a administrador');
    }

    const updateResult = await container.usuarioRepository.update(adminEntityResult.value);
    if (updateResult.isFailure) {
      throw new Error('No se pudo actualizar el usuario admin promovido');
    }

    // Autenticar usuarios
    const authResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: testUser.email,
        password: testUser.password
      });
    authToken = authResponse.body.data.tokens.accessToken;

    const adminAuthResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: adminUser.email,
        password: adminUser.password
      });
    adminToken = adminAuthResponse.body.data.tokens.accessToken;
    expect(adminAuthResponse.body.data.user.rol).toBe('ADMIN');

    // Crear lista para pruebas
    const listaResponse = await request(app)
      .post('/api/v1/lists')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        nombre: 'Lista para IA',
        descripcion: 'Lista para probar funcionalidades de IA'
      });
    const listaData = listaResponse.body.data;
    listaId = Array.isArray(listaData)
      ? listaData[0]?.id
      : listaData?.id ?? listaData?.lista?.id ?? listaData?.items?.[0]?.id;
  });

  describe('Sugerencias de Categorización', () => {
    it('1. Debe obtener sugerencias para producto de alimentación', async () => {
      const response = await request(app)
        .post('/api/v1/ai/category-suggestions')
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
      expect(typeof response.body.data.suggestions[0].confidence).toBe('number');

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
        .post('/api/v1/ai/category-suggestions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productName: 'Detergente para ropa'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.suggestions.length).toBeGreaterThan(0);

      // Verificar que al menos una sugerencia sea relacionada con limpieza
      const hasCleaning = response.body.data.suggestions.some(
        (s: any) => s.category.toLowerCase().includes('limp') || 
                   s.category.toLowerCase().includes('hogar')
      );
      expect(hasCleaning).toBe(true);
    });

    it('3. Debe obtener sugerencias para producto de tecnología', async () => {
      const response = await request(app)
        .post('/api/v1/ai/category-suggestions')
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
                   s.category.toLowerCase().includes('electr')
      );
      expect(hasTech).toBe(true);
    });

    it('4. Debe rechazar productos con nombres vacíos', async () => {
      const response = await request(app)
        .post('/api/v1/ai/category-suggestions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productName: ''
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('VALIDATION_ERROR');
      const details = Array.isArray(response.body.details) ? response.body.details : [];
      const hasNombreDetail = details.some((detail: any) =>
        typeof detail.message === 'string' && detail.message.toLowerCase().includes('nombre')
      );
      expect(hasNombreDetail).toBe(true);
    });

    it('5. Debe rechazar productos con nombres muy largos', async () => {
      const longName = 'A'.repeat(256); // Más de 255 caracteres
      
      const response = await request(app)
        .post('/api/v1/ai/category-suggestions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productName: longName
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('VALIDATION_ERROR');
      const details = Array.isArray(response.body.details) ? response.body.details : [];
      const hasLengthDetail = details.some((detail: any) =>
        typeof detail.message === 'string' && detail.message.toLowerCase().includes('exced')
      );
      expect(hasLengthDetail).toBe(true);
    });

    it('6. Debe detectar patrones sospechosos en nombres de productos', async () => {
      const response = await request(app)
        .post('/api/v1/ai/category-suggestions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productName: '<script>alert("hack")</script>'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      const message = (response.body.message ?? response.body.error ?? '').toLowerCase();
      expect(message).toContain('válid');
    });

    it('7. Debe manejar productos con nombres únicos o poco comunes', async () => {
      const response = await request(app)
        .post('/api/v1/ai/category-suggestions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          productName: 'Producto Inventado XYZ123'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.suggestions.length).toBeGreaterThan(0);
      const confidences = response.body.data.suggestions.map((s: any) => s.confidence);
      confidences.forEach((confidence: number) => expect(typeof confidence).toBe('number'));
      // Para productos desconocidos, la confianza debería ser menor
      expect(Math.max(...confidences)).toBeLessThan(0.8);
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
          .post('/api/v1/ai/category-suggestions')
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
        .get('/api/v1/ai/health')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('status');
      expect(response.body.data).toHaveProperty('timestamp');
      expect(response.body.data).toHaveProperty('features');
      
      // Verificar estructura de servicios
      expect(response.body.data.features).toHaveProperty('categorySuggestions');
      expect(response.body.data.features.categorySuggestions).toBe(true);
    });

    it('2. Admin debe obtener información de uso de IA', async () => {
      const response = await request(app)
        .get('/api/v1/ai/usage')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(response.status).toBe(200);

      expect(response.body.success).toBe(true);
      const data = response.body.data;

      if (data.usage) {
        const usage = data.usage;
        const cacheStats = data.cache;
        const limits = data.limits;

        expect(usage).toHaveProperty('totalRequests');
        expect(usage).toHaveProperty('successRate');
        expect(usage).toHaveProperty('tokensUsed');
        expect(cacheStats).toHaveProperty('hitRatio');
        expect(cacheStats).toHaveProperty('savedRequests');
        expect(limits).toHaveProperty('rateLimitRemaining');

        expect(typeof usage.totalRequests).toBe('number');
        expect(typeof usage.successRate).toBe('number');
        expect(typeof cacheStats.hitRatio).toBe('number');
      } else {
        expect(data).toHaveProperty('provider');
        expect(data).toHaveProperty('tokensUsed');
        expect(data).toHaveProperty('tokensRemaining');
        expect(data).toHaveProperty('requestsThisMonth');
        expect(typeof data.tokensUsed).toBe('number');
        expect(typeof data.tokensRemaining).toBe('number');
      }
    });

    it('3. Usuario normal NO debe acceder a métricas de administrador', async () => {
      const response = await request(app)
        .get('/api/v1/ai/usage')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);

      expect((response.body.error ?? '').toLowerCase()).toContain('rol');
    });
  });

  describe('Rate Limiting y Rendimiento', () => {
    it('1. Debe respetar límites de velocidad para solicitudes de IA', async () => {
      // Hacer múltiples solicitudes rápidas para probar rate limiting
      const requests = Array.from({ length: 5 }, () =>
        request(app)
          .post('/api/v1/ai/category-suggestions')
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
        .post('/api/v1/ai/category-suggestions')
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
        .post('/api/v1/ai/category-suggestions')
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
          .post('/api/v1/ai/category-suggestions')
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
        .post('/api/v1/ai/category-suggestions')
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
        .post('/api/v1/ai/category-suggestions')
        .send({
          productName: 'Producto sin auth'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('UNAUTHORIZED');
    });
  });
});
