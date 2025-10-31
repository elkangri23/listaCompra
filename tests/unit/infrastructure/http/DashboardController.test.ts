import { DashboardController } from '../../../../src/infrastructure/http/controllers/DashboardController';

describe('DashboardController', () => {
  let dashboardController: DashboardController;
  let mockMetricsCollector: any;
  let mockCachedAIService: any;
  let mockRequest: any;
  let mockResponse: any;

  beforeEach(() => {
    // Create mocks
    mockMetricsCollector = {
      getSystemMetrics: jest.fn(),
      getAllEndpointMetrics: jest.fn(),
      getSlowestEndpoints: jest.fn(),
      getEndpointsWithMostErrors: jest.fn(),
      getErrorRateStats: jest.fn()
    };

    mockCachedAIService = {
      getCacheAnalytics: jest.fn()
    };

    mockRequest = {};
    mockResponse = {
      json: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis()
    };

    dashboardController = new DashboardController(
      mockMetricsCollector,
      mockCachedAIService
    );

    // Setup default successful responses
    mockMetricsCollector.getSystemMetrics.mockReturnValue({
      totalEndpoints: 10,
      globalRequestCount: 1000,
      globalSuccessRate: 0.98,
      globalAvgResponseTime: 150,
      uptime: 3600000,
      startTime: new Date('2024-01-01')
    });

    mockMetricsCollector.getAllEndpointMetrics.mockReturnValue([
      {
        path: '/api/users',
        method: 'GET',
        totalRequests: 100,
        successRequests: 98,
        errorRequests: 2,
        avgResponseTime: 120
      }
    ]);

    mockCachedAIService.getCacheAnalytics.mockResolvedValue({
      hitRatio: 0.85,
      totalOperations: 100,
      cacheHits: 85,
      cacheMisses: 15,
      categoryStats: {
        'categorization': { hitRatio: 0.9, operations: 50 }
      }
    });
  });

  describe('getMetrics', () => {
    it('debería devolver métricas del dashboard exitosamente', async () => {
      await dashboardController.getMetrics(mockRequest, mockResponse);

      expect(mockResponse.json).toHaveBeenCalledWith({
        status: 'success',
        data: {
          systemMetrics: expect.objectContaining({
            totalEndpoints: 10,
            globalRequestCount: 1000,
            globalSuccessRate: 0.98
          }),
          endpointMetrics: expect.arrayContaining([
            expect.objectContaining({
              path: '/api/users',
              method: 'GET'
            })
          ]),
          cacheMetrics: expect.objectContaining({
            hitRatio: 0.85,
            totalOperations: 100
          })
        },
        timestamp: expect.any(String)
      });
    });

    it('debería manejar errores del cache analytics gracefully', async () => {
      mockCachedAIService.getCacheAnalytics.mockRejectedValue(new Error('Cache error'));

      await dashboardController.getMetrics(mockRequest, mockResponse);

      expect(mockResponse.json).toHaveBeenCalledWith({
        status: 'success',
        data: {
          systemMetrics: expect.any(Object),
          endpointMetrics: expect.any(Array),
          cacheMetrics: { error: 'Cache analytics unavailable' }
        },
        timestamp: expect.any(String)
      });
    });
  });

  describe('getHealth', () => {
    it('debería devolver estado de salud exitosamente', async () => {
      await dashboardController.getHealth(mockRequest, mockResponse);

      expect(mockResponse.json).toHaveBeenCalledWith({
        status: 'success',
        data: {
          overall: 'healthy',
          services: {
            api: 'healthy',
            cache: 'healthy',
            metrics: 'healthy'
          },
          uptime: expect.any(Number),
          timestamp: expect.any(String)
        }
      });
    });

    it('debería detectar problemas cuando el error rate es alto', async () => {
      mockMetricsCollector.getSystemMetrics.mockReturnValue({
        totalEndpoints: 10,
        globalRequestCount: 1000,
        globalSuccessRate: 0.85, // Below threshold
        globalAvgResponseTime: 150,
        uptime: 3600000,
        startTime: new Date('2024-01-01')
      });

      await dashboardController.getHealth(mockRequest, mockResponse);

      expect(mockResponse.json).toHaveBeenCalledWith({
        status: 'success',
        data: {
          overall: 'degraded',
          services: {
            api: 'degraded',
            cache: 'healthy',
            metrics: 'healthy'
          },
          uptime: expect.any(Number),
          timestamp: expect.any(String)
        }
      });
    });
  });

  describe('getAlerts', () => {
    it('debería devolver alertas activas', async () => {
      // Setup conditions for alerts
      mockMetricsCollector.getSystemMetrics.mockReturnValue({
        globalSuccessRate: 0.85, // Low success rate (15% error rate - medium severity)
        globalAvgResponseTime: 3000 // High response time (medium severity)
      });

      mockCachedAIService.getCacheAnalytics.mockResolvedValue({
        hitRatio: 0.5 // Low hit ratio (medium severity)
      });

      await dashboardController.getAlerts(mockRequest, mockResponse);

      expect(mockResponse.json).toHaveBeenCalledWith({
        status: 'success',
        data: {
          activeAlerts: expect.arrayContaining([
            expect.objectContaining({
              type: 'error_rate',
              severity: 'medium'
            }),
            expect.objectContaining({
              type: 'response_time',
              severity: 'medium'
            }),
            expect.objectContaining({
              type: 'cache_hit_ratio',
              severity: 'medium'
            })
          ]),
          alertCount: 3,
          timestamp: expect.any(String)
        }
      });
    });

    it('debería devolver sin alertas cuando todo está bien', async () => {
      await dashboardController.getAlerts(mockRequest, mockResponse);

      expect(mockResponse.json).toHaveBeenCalledWith({
        status: 'success',
        data: {
          activeAlerts: [],
          alertCount: 0,
          timestamp: expect.any(String)
        }
      });
    });
  });

  describe('getPerformance', () => {
    it('debería devolver métricas de performance', async () => {
      mockMetricsCollector.getSlowestEndpoints.mockReturnValue([
        { path: '/api/slow', avgResponseTime: 500 }
      ]);
      mockMetricsCollector.getEndpointsWithMostErrors.mockReturnValue([
        { path: '/api/error', errorRequests: 10 }
      ]);
      mockMetricsCollector.getErrorRateStats.mockReturnValue([
        { path: '/api/error', errorRate: 0.1 }
      ]);

      await dashboardController.getPerformance(mockRequest, mockResponse);

      expect(mockResponse.json).toHaveBeenCalledWith({
        status: 'success',
        data: {
          slowestEndpoints: expect.arrayContaining([
            expect.objectContaining({ path: '/api/slow' })
          ]),
          errorProneEndpoints: expect.arrayContaining([
            expect.objectContaining({ path: '/api/error' })
          ]),
          errorRateStats: expect.arrayContaining([
            expect.objectContaining({ path: '/api/error' })
          ]),
          timestamp: expect.any(String)
        }
      });
    });
  });

  describe('Error handling', () => {
    it('debería manejar errores inesperados', async () => {
      mockMetricsCollector.getSystemMetrics.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      await dashboardController.getMetrics(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Error al obtener métricas del dashboard',
        error: 'Unexpected error'
      });
    });
  });
});