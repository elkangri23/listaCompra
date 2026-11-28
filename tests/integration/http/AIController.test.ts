/**
 * Tests de integración para AIController
 * Verifica los endpoints de IA con mocks
 */

import request from 'supertest';
import express from 'express';
import { AIController } from '../../../src/infrastructure/http/controllers/AIController';
// import { GetCategorySuggestionsUseCase } from '../../../src/application/use-cases/ai/GetCategorySuggestions';
// import { IAIService } from '../../../src/application/ports/external/IAIService';
import { success, failure } from '../../../src/shared/result';
import { ValidationError } from '../../../src/application/errors/ValidationError';

// Mock del servicio de IA (no usado directamente en estos tests)
/*
const _mockAIService: jest.Mocked<IAIService> = {
  suggestCategories: jest.fn(),
  analyzePurchaseHabits: jest.fn(),
  recommendProducts: jest.fn(),
  analyzeWithAI: jest.fn(),
  isAvailable: jest.fn(),
  getUsageInfo: jest.fn()
};
*/

// Mock del caso de uso
const mockGetCategorySuggestionsUseCase = {
  execute: jest.fn()
};

describe('AIController Integration Tests', () => {
  let app: express.Application;
  let controller: AIController;

  beforeEach(() => {
    jest.clearAllMocks();
    
    controller = new AIController(
      mockGetCategorySuggestionsUseCase as any
    );

    app = express();
    app.use(express.json());

    // Middleware simple para simular autenticación
    app.use((req: any, _res, next) => {
      req.user = {
        userId: 'test-user-id',
        email: 'test@example.com',
        role: 'user'
      };
      next();
    });

    // Rutas
    app.post('/api/ai/category-suggestions', controller.suggestCategories.bind(controller));
    app.get('/api/ai/health', controller.healthCheck.bind(controller));
    app.get('/api/ai/usage', controller.getUsageInfo.bind(controller));
  });

  describe('POST /api/ai/category-suggestions', () => {
    it('debe devolver sugerencias exitosamente', async () => {
      // Arrange
      const requestBody = {
        productName: 'Leche desnatada',
        storeName: 'Mercadona',
        existingCategories: ['Lácteos']
      };

      const mockResponse = {
        productName: 'Leche desnatada',
        suggestions: [
          {
            category: 'Lácteos',
            confidence: 0.95,
            reasoning: 'La leche es un producto lácteo'
          }
        ],
        cached: false,
        requestId: 'test-request-id',
        timestamp: new Date().toISOString(),
        personalized: true,
        examplesUsed: 1
      };

      mockGetCategorySuggestionsUseCase.execute.mockResolvedValue(
        success(mockResponse)
      );

      // Act
      const response = await request(app)
        .post('/api/ai/category-suggestions')
        .send(requestBody)
        .expect(200);

      // Assert
      expect(response.body).toEqual({
        success: true,
        data: {
          productName: 'Leche desnatada',
          suggestions: [
            {
              category: 'Lácteos',
              confidence: 0.95,
              reasoning: 'La leche es un producto lácteo'
            }
          ],
          cached: false,
          requestId: 'test-request-id',
          timestamp: mockResponse.timestamp,
          personalized: true,
          examplesUsed: 1
        }
      });

      expect(mockGetCategorySuggestionsUseCase.execute).toHaveBeenCalledWith({
        productName: 'Leche desnatada',
        storeName: 'Mercadona',
        existingCategories: ['Lácteos'],
        userId: 'test-user-id'
      });
    });

    it('debe devolver error 400 para nombre de producto vacío', async () => {
      // Arrange
      const requestBody = {
        productName: '',
        storeName: 'Mercadona'
      };

      // Act
      const response = await request(app)
        .post('/api/ai/category-suggestions')
        .send(requestBody)
        .expect(400);

      // Assert
      expect(response.body).toEqual({
        success: false,
        error: 'El nombre del producto es requerido',
        code: 'INVALID_PRODUCT_NAME'
      });

      expect(mockGetCategorySuggestionsUseCase.execute).not.toHaveBeenCalled();
    });

    it('debe devolver error 400 para nombre de producto muy largo', async () => {
      // Arrange
      const requestBody = {
        productName: 'a'.repeat(101) // 101 caracteres
      };

      // Act
      const response = await request(app)
        .post('/api/ai/category-suggestions')
        .send(requestBody)
        .expect(400);

      // Assert
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('PRODUCT_NAME_TOO_LONG');

      expect(mockGetCategorySuggestionsUseCase.execute).not.toHaveBeenCalled();
    });

    it('debe manejar errores de validación del caso de uso', async () => {
      // Arrange
      const requestBody = {
        productName: 'Producto test'
      };

      mockGetCategorySuggestionsUseCase.execute.mockResolvedValue(
        failure(new ValidationError('Error de validación', 'field', 'value'))
      );

      // Act
      const response = await request(app)
        .post('/api/ai/category-suggestions')
        .send(requestBody)
        .expect(400);

      // Assert
      expect(response.body).toEqual({
        success: false,
        error: 'Error de validación',
        code: 'VALIDATION_ERROR'
      });
    });

    it('debe manejar errores internos del servidor', async () => {
      // Arrange
      const requestBody = {
        productName: 'Producto test'
      };

      mockGetCategorySuggestionsUseCase.execute.mockRejectedValue(
        new Error('Error interno')
      );

      // Act
      const response = await request(app)
        .post('/api/ai/category-suggestions')
        .send(requestBody)
        .expect(500);

      // Assert
      expect(response.body).toEqual({
        success: false,
        error: 'Error interno del servidor',
        code: 'UNEXPECTED_ERROR'
      });
    });
  });

  describe('GET /api/ai/health', () => {
    it('debe devolver estado saludable', async () => {
      // Act
      const response = await request(app)
        .get('/api/ai/health')
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('healthy');
      expect(response.body.data.provider).toBe('perplexity');
      expect(response.body.data.features.categorySuggestions).toBe(true);
    });
  });

  describe('GET /api/ai/usage', () => {
    it('debe responder 503 sin seguimiento real para administrador', async () => {
      // Arrange - Crear nueva app con middleware admin
      const adminApp = express();
      adminApp.use(express.json());
      
      // Middleware para simular usuario admin
      adminApp.use((req: any, _res, next) => {
        req.user = {
          userId: 'admin-user-id',
          email: 'admin@example.com',
          role: 'admin'
        };
        next();
      });

      // Registrar las rutas con el controlador
      adminApp.get('/api/ai/usage', (req, res) => controller.getUsageInfo(req, res));

      // Act — sin seguimiento real, el endpoint responde 503 en vez de datos inventados
      const response = await request(adminApp)
        .get('/api/ai/usage')
        .expect(503);

      // Assert
      expect(response.body).toEqual({
        success: false,
        error: 'El seguimiento de uso de IA aún no está disponible.',
        code: 'AI_USAGE_NOT_AVAILABLE'
      });
    });

    it('debe denegar acceso a usuarios no administradores', async () => {
      // Act
      const response = await request(app)
        .get('/api/ai/usage')
        .expect(403);

      // Assert
      expect(response.body).toEqual({
        success: false,
        error: 'Acceso denegado. Solo administradores pueden ver esta información.',
        code: 'ACCESS_DENIED'
      });
    });
  });

  describe('GET /api/ai/health con AIHealthChecker (fase 3)', () => {
    const healthyResult = {
      status: 'healthy',
      provider: 'freellmapi',
      model: 'qwen3.8-27b',
      latencyMs: 123,
      checkedAt: '2026-11-28T10:00:00.000Z',
      cached: false,
    };

    const buildAppWithChecker = (checkResult: unknown) => {
      const checker = { check: jest.fn().mockResolvedValue(checkResult) };
      const ctrl = new AIController(undefined, undefined, undefined, undefined, checker as any);
      const testApp = express();
      testApp.use(express.json());
      testApp.get('/api/ai/health', ctrl.healthCheck.bind(ctrl));
      return { testApp, checker };
    };

    it('debe devolver el resultado real del checker (healthy)', async () => {
      const { testApp, checker } = buildAppWithChecker(healthyResult);

      const response = await request(testApp).get('/api/ai/health').expect(200);

      expect(response.body).toEqual({ success: true, data: healthyResult });
      expect(checker.check).toHaveBeenCalledTimes(1);
    });

    it('debe devolver 200 con degraded cuando el proveedor falla', async () => {
      const degraded = { ...healthyResult, status: 'degraded', latencyMs: null, reason: 'PROVIDER_ERROR' };
      const { testApp } = buildAppWithChecker(degraded);

      const response = await request(testApp).get('/api/ai/health').expect(200);

      expect(response.body.data.status).toBe('degraded');
      expect(response.body.data.reason).toBe('PROVIDER_ERROR');
    });
  });

  describe('GET /api/ai/usage con GetAIUsage (fase 3)', () => {
    const usageResult = {
      provider: 'freellmapi',
      model: 'qwen3.8-27b',
      today: {
        total: 3,
        byOperation: { 'category-suggestions': 2, 'bulk-categorize': 1, 'config-test': 0 },
        success: 2,
        failed: 1,
        avgLatencyMs: 200,
        cached: 1,
        cachedPercentage: 33,
      },
      last7Days: [
        { date: '2026-11-28', total: 3, success: 2, failed: 1, byOperation: { 'category-suggestions': 2, 'bulk-categorize': 1, 'config-test': 0 } },
      ],
      hasData: true,
    };

    const buildAdminAppWithUsage = (result: unknown) => {
      const getAIUsage = { execute: jest.fn().mockResolvedValue(result) };
      const ctrl = new AIController(undefined, undefined, undefined, getAIUsage as any);
      const testApp = express();
      testApp.use(express.json());
      testApp.use((req: any, _res, next) => {
        req.user = { userId: 'admin-user-id', email: 'admin@example.com', role: 'admin' };
        next();
      });
      testApp.get('/api/ai/usage', ctrl.getUsageInfo.bind(ctrl));
      return { testApp, getAIUsage };
    };

    it('debe responder 200 con los agregados reales para administrador', async () => {
      const { testApp, getAIUsage } = buildAdminAppWithUsage(usageResult);

      const response = await request(testApp).get('/api/ai/usage').expect(200);

      expect(response.body).toEqual({ success: true, data: usageResult });
      expect(getAIUsage.execute).toHaveBeenCalledTimes(1);
    });

    it('sin eventos debe responder 200 con ceros y hasData false', async () => {
      const empty = {
        provider: 'freellmapi',
        model: 'qwen3.8-27b',
        today: {
          total: 0,
          byOperation: { 'category-suggestions': 0, 'bulk-categorize': 0, 'config-test': 0 },
          success: 0,
          failed: 0,
          avgLatencyMs: null,
          cached: 0,
          cachedPercentage: null,
        },
        last7Days: [],
        hasData: false,
      };
      const { testApp } = buildAdminAppWithUsage(empty);

      const response = await request(testApp).get('/api/ai/usage').expect(200);

      expect(response.body.data.hasData).toBe(false);
      expect(response.body.data.today.avgLatencyMs).toBeNull();
      expect(response.body.data.today.cachedPercentage).toBeNull();
    });

    it('debe denegar acceso a usuarios no administradores aunque haya caso de uso', async () => {
      const getAIUsage = { execute: jest.fn().mockResolvedValue(usageResult) };
      const ctrl = new AIController(undefined, undefined, undefined, getAIUsage as any);
      const testApp = express();
      testApp.use(express.json());
      testApp.use((req: any, _res, next) => {
        req.user = { userId: 'user-id', email: 'user@example.com', role: 'user' };
        next();
      });
      testApp.get('/api/ai/usage', ctrl.getUsageInfo.bind(ctrl));

      const response = await request(testApp).get('/api/ai/usage').expect(403);

      expect(response.body.code).toBe('ACCESS_DENIED');
      expect(getAIUsage.execute).not.toHaveBeenCalled();
    });
  });
});