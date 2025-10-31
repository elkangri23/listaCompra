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
        timestamp: new Date().toISOString()
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
          timestamp: mockResponse.timestamp
        }
      });

      expect(mockGetCategorySuggestionsUseCase.execute).toHaveBeenCalledWith({
        productName: 'Leche desnatada',
        storeName: 'Mercadona',
        existingCategories: ['Lácteos']
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
    it('debe devolver información de uso para administrador', async () => {
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

      // Act
      const response = await request(adminApp)
        .get('/api/ai/usage')
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data.provider).toBe('perplexity');
      expect(response.body.data).toHaveProperty('tokensUsed');
      expect(response.body.data).toHaveProperty('rateLimitRemaining');
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
});