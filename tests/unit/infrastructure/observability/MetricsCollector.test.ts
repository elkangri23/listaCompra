/**
 * Tests unitarios para MetricsCollector
 * Verifica la recolección y análisis de métricas de performance
 */

import { MetricsCollector } from '../../../../src/infrastructure/observability/metrics/MetricsCollector';

describe('MetricsCollector', () => {
  let collector: MetricsCollector;

  beforeEach(() => {
    collector = new MetricsCollector();
  });

  describe('recordRequest', () => {
    test('debe registrar una nueva request correctamente', () => {
      collector.recordRequest('GET', '/api/users', 150, 200);

      const metrics = collector.getEndpointMetrics('GET', '/api/users');
      expect(metrics).toBeDefined();
      expect(metrics?.totalRequests).toBe(1);
      expect(metrics?.successRequests).toBe(1);
      expect(metrics?.errorRequests).toBe(0);
      expect(metrics?.avgResponseTime).toBe(150);
      expect(metrics?.minResponseTime).toBe(150);
      expect(metrics?.maxResponseTime).toBe(150);
    });

    test('debe acumular múltiples requests del mismo endpoint', () => {
      collector.recordRequest('GET', '/api/users', 100, 200);
      collector.recordRequest('GET', '/api/users', 200, 200);
      collector.recordRequest('GET', '/api/users', 300, 500);

      const metrics = collector.getEndpointMetrics('GET', '/api/users');
      expect(metrics?.totalRequests).toBe(3);
      expect(metrics?.successRequests).toBe(2);
      expect(metrics?.errorRequests).toBe(1);
      expect(metrics?.avgResponseTime).toBe(200); // (100+200+300)/3
      expect(metrics?.minResponseTime).toBe(100);
      expect(metrics?.maxResponseTime).toBe(300);
    });

    test('debe normalizar paths con IDs dinámicos', () => {
      collector.recordRequest('GET', '/api/users/123', 100, 200);
      collector.recordRequest('GET', '/api/users/456', 150, 200);

      const metrics = collector.getEndpointMetrics('GET', '/api/users/:id');
      expect(metrics?.totalRequests).toBe(2);
      expect(metrics?.avgResponseTime).toBe(125);
    });

    test('debe normalizar paths con UUIDs', () => {
      const uuid1 = '550e8400-e29b-41d4-a716-446655440000';
      const uuid2 = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
      
      collector.recordRequest('DELETE', `/api/lists/${uuid1}`, 80, 204);
      collector.recordRequest('DELETE', `/api/lists/${uuid2}`, 120, 204);

      const metrics = collector.getEndpointMetrics('DELETE', '/api/lists/:id');
      expect(metrics?.totalRequests).toBe(2);
      expect(metrics?.avgResponseTime).toBe(100);
    });

    test('debe manejar query parameters correctamente', () => {
      collector.recordRequest('GET', '/api/users?page=1&limit=10', 90, 200);
      collector.recordRequest('GET', '/api/users?sort=name', 110, 200);

      const metrics = collector.getEndpointMetrics('GET', '/api/users');
      expect(metrics?.totalRequests).toBe(2);
      expect(metrics?.avgResponseTime).toBe(100);
    });
  });

  describe('getSystemMetrics', () => {
    test('debe devolver métricas del sistema correctas', () => {
      collector.recordRequest('GET', '/api/users', 100, 200);
      collector.recordRequest('POST', '/api/users', 200, 201);
      collector.recordRequest('GET', '/api/products', 150, 500);

      const systemMetrics = collector.getSystemMetrics();
      expect(systemMetrics.totalEndpoints).toBe(3); // GET:/api/users, POST:/api/users, GET:/api/products (3 endpoints diferentes)
      expect(systemMetrics.globalRequestCount).toBe(3);
      expect(systemMetrics.globalSuccessRate).toBeCloseTo(66.67, 2); // 2 success, 1 error
      expect(systemMetrics.globalAvgResponseTime).toBe(150); // (100+200+150)/3
    });

    test('debe manejar sistema sin requests', () => {
      const systemMetrics = collector.getSystemMetrics();
      expect(systemMetrics.totalEndpoints).toBe(0);
      expect(systemMetrics.globalRequestCount).toBe(0);
      expect(systemMetrics.globalSuccessRate).toBe(0);
      expect(systemMetrics.globalAvgResponseTime).toBe(0);
    });
  });

  describe('getSlowestEndpoints', () => {
    test('debe devolver endpoints ordenados por tiempo de respuesta', () => {
      collector.recordRequest('GET', '/api/slow', 500, 200);
      collector.recordRequest('GET', '/api/fast', 50, 200);
      collector.recordRequest('GET', '/api/medium', 200, 200);

      const slowest = collector.getSlowestEndpoints(2);
      expect(slowest).toHaveLength(2);
      expect(slowest[0]?.path).toBe('/api/slow');
      expect(slowest[1]?.path).toBe('/api/medium');
    });
  });

  describe('getEndpointsWithMostErrors', () => {
    test('debe devolver endpoints con mayor tasa de error', () => {
      // Endpoint con 50% error rate
      collector.recordRequest('GET', '/api/buggy', 100, 500);
      collector.recordRequest('GET', '/api/buggy', 100, 200);
      
      // Endpoint con 100% error rate
      collector.recordRequest('POST', '/api/broken', 100, 500);
      
      // Endpoint sin errores
      collector.recordRequest('GET', '/api/stable', 100, 200);

      const mostErrors = collector.getEndpointsWithMostErrors();
      expect(mostErrors[0]?.path).toBe('/api/broken');
      expect(mostErrors[1]?.path).toBe('/api/buggy');
    });
  });

  describe('getErrorRateStats', () => {
    test('debe calcular tasas de error correctamente', () => {
      collector.recordRequest('GET', '/api/test', 100, 500);
      collector.recordRequest('GET', '/api/test', 100, 200);
      collector.recordRequest('GET', '/api/test', 100, 200);

      const errorStats = collector.getErrorRateStats();
      const testEndpoint = errorStats.find(stat => stat.path === '/api/test');
      
      expect(testEndpoint?.errorRate).toBeCloseTo(33.33, 2); // 1 error de 3 requests
      expect(testEndpoint?.totalErrors).toBe(1);
    });
  });

  describe('reset functionality', () => {
    test('debe resetear todas las métricas', () => {
      collector.recordRequest('GET', '/api/users', 100, 200);
      collector.recordRequest('POST', '/api/users', 200, 201);

      collector.reset();

      const systemMetrics = collector.getSystemMetrics();
      expect(systemMetrics.totalEndpoints).toBe(0);
      expect(systemMetrics.globalRequestCount).toBe(0);
    });

    test('debe resetear métricas de endpoint específico', () => {
      collector.recordRequest('GET', '/api/users', 100, 200);
      collector.recordRequest('POST', '/api/products', 200, 201);

      collector.resetEndpoint('GET', '/api/users');

      expect(collector.getEndpointMetrics('GET', '/api/users')).toBeNull();
      expect(collector.getEndpointMetrics('POST', '/api/products')).not.toBeNull();
    });
  });

  describe('export/import functionality', () => {
    test('debe exportar e importar métricas correctamente', () => {
      collector.recordRequest('GET', '/api/test', 100, 200);
      collector.recordRequest('POST', '/api/test', 150, 201);

      const exported = collector.exportMetrics();
      const newCollector = new MetricsCollector();
      newCollector.importMetrics(exported);

      const originalMetrics = collector.getEndpointMetrics('GET', '/api/test');
      const importedMetrics = newCollector.getEndpointMetrics('GET', '/api/test');

      expect(importedMetrics?.totalRequests).toBe(originalMetrics?.totalRequests);
      expect(importedMetrics?.avgResponseTime).toBe(originalMetrics?.avgResponseTime);
    });

    test('debe manejar JSON inválido en import', () => {
      expect(() => collector.importMetrics('invalid json')).toThrow('Failed to import metrics');
    });
  });

  describe('edge cases', () => {
    test('debe manejar paths vacíos', () => {
      collector.recordRequest('GET', '', 100, 200);
      const metrics = collector.getEndpointMetrics('GET', '');
      expect(metrics?.totalRequests).toBe(1);
    });

    test('debe manejar métodos en minúsculas', () => {
      collector.recordRequest('get', '/api/test', 100, 200);
      const metrics = collector.getEndpointMetrics('GET', '/api/test');
      expect(metrics?.totalRequests).toBe(1);
    });

    test('debe manejar response times de cero', () => {
      collector.recordRequest('GET', '/api/fast', 0, 200);
      const metrics = collector.getEndpointMetrics('GET', '/api/fast');
      expect(metrics?.avgResponseTime).toBe(0);
      expect(metrics?.minResponseTime).toBe(0);
    });
  });
});