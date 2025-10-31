/**
 * Collector de métricas de performance en tiempo real
 * Rastrea response time, throughput, error rate por endpoint
 */

export interface EndpointMetrics {
  path: string;
  method: string;
  totalRequests: number;
  successRequests: number;
  errorRequests: number;
  totalResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  avgResponseTime: number;
  lastUpdated: Date;
}

export interface SystemMetrics {
  totalEndpoints: number;
  globalRequestCount: number;
  globalSuccessRate: number;
  globalAvgResponseTime: number;
  uptime: number;
  startTime: Date;
}

export class MetricsCollector {
  private metrics: Map<string, EndpointMetrics> = new Map();
  private startTime: Date = new Date();

  /**
   * Registra una nueva request y su tiempo de respuesta
   */
  recordRequest(
    method: string,
    path: string,
    responseTime: number,
    statusCode: number
  ): void {
    const key = `${method.toUpperCase()}:${this.normalizePath(path)}`;
    const isSuccess = statusCode >= 200 && statusCode < 400;

    let existing = this.metrics.get(key);
    if (!existing) {
      existing = {
        path: this.normalizePath(path),
        method: method.toUpperCase(),
        totalRequests: 0,
        successRequests: 0,
        errorRequests: 0,
        totalResponseTime: 0,
        minResponseTime: responseTime,
        maxResponseTime: responseTime,
        avgResponseTime: 0,
        lastUpdated: new Date()
      };
    }

    // Actualizar métricas
    existing.totalRequests++;
    existing.totalResponseTime += responseTime;
    existing.minResponseTime = Math.min(existing.minResponseTime, responseTime);
    existing.maxResponseTime = Math.max(existing.maxResponseTime, responseTime);
    existing.avgResponseTime = existing.totalResponseTime / existing.totalRequests;
    existing.lastUpdated = new Date();

    if (isSuccess) {
      existing.successRequests++;
    } else {
      existing.errorRequests++;
    }

    this.metrics.set(key, existing);
  }

  /**
   * Obtiene métricas de un endpoint específico
   */
  getEndpointMetrics(method: string, path: string): EndpointMetrics | null {
    const key = `${method.toUpperCase()}:${this.normalizePath(path)}`;
    return this.metrics.get(key) || null;
  }

  /**
   * Obtiene todas las métricas de endpoints
   */
  getAllEndpointMetrics(): EndpointMetrics[] {
    return Array.from(this.metrics.values()).sort((a, b) => 
      b.totalRequests - a.totalRequests
    );
  }

  /**
   * Obtiene métricas globales del sistema
   */
  getSystemMetrics(): SystemMetrics {
    const allMetrics = Array.from(this.metrics.values());
    
    const totalRequests = allMetrics.reduce((sum, m) => sum + m.totalRequests, 0);
    const totalSuccessRequests = allMetrics.reduce((sum, m) => sum + m.successRequests, 0);
    const totalResponseTime = allMetrics.reduce((sum, m) => sum + m.totalResponseTime, 0);

    return {
      totalEndpoints: this.metrics.size,
      globalRequestCount: totalRequests,
      globalSuccessRate: totalRequests > 0 ? (totalSuccessRequests / totalRequests) * 100 : 0,
      globalAvgResponseTime: totalRequests > 0 ? totalResponseTime / totalRequests : 0,
      uptime: Date.now() - this.startTime.getTime(),
      startTime: this.startTime
    };
  }

  /**
   * Obtiene los endpoints más lentos
   */
  getSlowestEndpoints(limit: number = 10): EndpointMetrics[] {
    return Array.from(this.metrics.values())
      .sort((a, b) => b.avgResponseTime - a.avgResponseTime)
      .slice(0, limit);
  }

  /**
   * Obtiene los endpoints con más errores
   */
  getEndpointsWithMostErrors(limit: number = 10): EndpointMetrics[] {
    return Array.from(this.metrics.values())
      .filter(m => m.errorRequests > 0)
      .sort((a, b) => (b.errorRequests / b.totalRequests) - (a.errorRequests / a.totalRequests))
      .slice(0, limit);
  }

  /**
   * Obtiene estadísticas de error por endpoint
   */
  getErrorRateStats(): Array<{path: string; method: string; errorRate: number; totalErrors: number}> {
    return Array.from(this.metrics.values())
      .filter(m => m.totalRequests > 0)
      .map(m => ({
        path: m.path,
        method: m.method,
        errorRate: (m.errorRequests / m.totalRequests) * 100,
        totalErrors: m.errorRequests
      }))
      .sort((a, b) => b.errorRate - a.errorRate);
  }

  /**
   * Reset de todas las métricas
   */
  reset(): void {
    this.metrics.clear();
    this.startTime = new Date();
  }

  /**
   * Reset de métricas de un endpoint específico
   */
  resetEndpoint(method: string, path: string): void {
    const key = `${method.toUpperCase()}:${this.normalizePath(path)}`;
    this.metrics.delete(key);
  }

  /**
   * Normaliza paths para agrupar rutas dinámicas
   * Ejemplo: /api/users/123 -> /api/users/:id
   */
  private normalizePath(path: string): string {
    return path
      // UUIDs
      .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
      // Números
      .replace(/\/\d+/g, '/:id')
      // Query parameters
      .split('?')[0] || path;
  }

  /**
   * Exporta métricas en formato JSON para persistencia
   */
  exportMetrics(): string {
    const data = {
      metrics: Array.from(this.metrics.entries()),
      systemMetrics: this.getSystemMetrics(),
      exportedAt: new Date().toISOString()
    };
    return JSON.stringify(data, null, 2);
  }

  /**
   * Importa métricas desde JSON
   */
  importMetrics(jsonData: string): void {
    try {
      const data = JSON.parse(jsonData);
      this.metrics = new Map(data.metrics);
    } catch (error) {
      throw new Error(`Failed to import metrics: ${error}`);
    }
  }
}