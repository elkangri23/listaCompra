import { Request, Response } from 'express';
import { CacheIntegrityService, ValidatableDataType, IntegrityCheckResult } from '../../cache/CacheIntegrityService';
import { Logger } from '../../observability/logger/Logger';

/**
 * Controlador para monitoreo y gestión de integridad de cache
 * Endpoints administrativos para validar y mantener la integridad de datos
 */
export class CacheIntegrityController {
  constructor(
    private readonly integrityService: CacheIntegrityService,
    private readonly redisClient: any, // Redis client interface
    private readonly logger: Logger
  ) {}

  /**
   * GET /api/v1/admin/cache/integrity/scan
   * Escanea y valida integridad de datos en cache
   */
  scanIntegrity = async (req: Request, res: Response): Promise<void> => {
    try {
      const { pattern = '*', dataType } = req.query;
      
      this.logger.info('Iniciando escaneo de integridad de cache', {
        adminId: (req as any).user?.id,
        pattern,
        dataType
      });

      const results = await this.integrityService.scanIntegrity(
        this.redisClient,
        pattern as string,
        dataType as ValidatableDataType
      );

      const stats = this.integrityService.getIntegrityStats(results);
      
      res.json({
        success: true,
        scan: {
          timestamp: new Date().toISOString(),
          pattern,
          dataType: dataType || 'all',
          results: results.map((r: IntegrityCheckResult) => ({
            key: r.key,
            dataType: r.dataType,
            isValid: r.isValid,
            corruptionLevel: r.corruptionLevel,
            details: r.details
          }))
        },
        statistics: stats,
        recommendations: this.generateRecommendations(results)
      });

    } catch (error) {
      this.logger.error('Error en escaneo de integridad', {
        error: error instanceof Error ? error.message : String(error),
        adminId: (req as any).user?.id
      });

      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        code: 'INTEGRITY_SCAN_FAILED'
      });
    }
  };

  /**
   * POST /api/v1/admin/cache/integrity/validate
   * Valida integridad de una clave específica
   */
  validateKey = async (req: Request, res: Response): Promise<void> => {
    try {
      const { key, dataType } = req.body;

      if (!key || !dataType) {
        res.status(400).json({
          success: false,
          error: 'Key y dataType son requeridos',
          code: 'MISSING_PARAMETERS'
        });
        return;
      }

      this.logger.info('Validando integridad de clave específica', {
        adminId: (req as any).user?.id,
        key,
        dataType
      });

      const result = await this.integrityService.retrieveWithIntegrity(
        this.redisClient,
        key,
        dataType as ValidatableDataType
      );

      if (result.isFailure()) {
        res.status(400).json({
          success: false,
          error: result.error.message,
          code: 'VALIDATION_FAILED'
        });
        return;
      }

      res.json({
        success: true,
        validation: {
          key,
          dataType,
          isValid: true,
          timestamp: new Date().toISOString(),
          hasData: !!result.value
        }
      });

    } catch (error) {
      this.logger.error('Error validando clave específica', {
        error: error instanceof Error ? error.message : String(error),
        adminId: (req as any).user?.id
      });

      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        code: 'KEY_VALIDATION_FAILED'
      });
    }
  };

  /**
   * DELETE /api/v1/admin/cache/integrity/cleanup
   * Limpia datos corruptos del cache
   */
  cleanupCorrupted = async (req: Request, res: Response): Promise<void> => {
    try {
      const { pattern = '*', dataType, dryRun = true } = req.body;

      this.logger.warn('Solicitud de limpieza de datos corruptos', {
        adminId: (req as any).user?.id,
        pattern,
        dataType,
        dryRun
      });

      // Primero escanear para identificar datos corruptos
      const results = await this.integrityService.scanIntegrity(
        this.redisClient,
        pattern,
        dataType as ValidatableDataType
      );

      const corruptedResults = results.filter((r: IntegrityCheckResult) => !r.isValid);
      
      if (corruptedResults.length === 0) {
        res.json({
          success: true,
          message: 'No se encontraron datos corruptos',
          cleaned: 0,
          dryRun
        });
        return;
      }

      // Si es dry run, solo mostrar lo que se limpiaría
      if (dryRun) {
        res.json({
          success: true,
          message: 'Simulación de limpieza completada',
          wouldClean: corruptedResults.length,
          corruptedKeys: corruptedResults.map((r: IntegrityCheckResult) => ({
            key: r.key,
            dataType: r.dataType,
            corruptionLevel: r.corruptionLevel,
            details: r.details
          })),
          dryRun: true
        });
        return;
      }

      // Limpiar datos corruptos
      await this.integrityService.cleanupCorruptedData(this.redisClient, corruptedResults);

      res.json({
        success: true,
        message: 'Limpieza de datos corruptos completada',
        cleaned: corruptedResults.length,
        cleanedKeys: corruptedResults.map((r: IntegrityCheckResult) => r.key),
        dryRun: false
      });

    } catch (error) {
      this.logger.error('Error en limpieza de datos corruptos', {
        error: error instanceof Error ? error.message : String(error),
        adminId: (req as any).user?.id
      });

      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        code: 'CLEANUP_FAILED'
      });
    }
  };

  /**
   * GET /api/v1/admin/cache/integrity/stats
   * Obtiene estadísticas generales de integridad
   */
  getIntegrityStats = async (req: Request, res: Response): Promise<void> => {
    try {
      this.logger.info('Obteniendo estadísticas de integridad', {
        adminId: (req as any).user?.id
      });

      // Escanear todos los datos
      const results = await this.integrityService.scanIntegrity(this.redisClient);
      const stats = this.integrityService.getIntegrityStats(results);

      // Información adicional del cache
      const cacheInfo = await this.redisClient.info('memory');
      const keyCount = await this.redisClient.dbsize();

      res.json({
        success: true,
        integrity: stats,
        cache: {
          totalKeys: keyCount,
          memoryInfo: this.parseRedisMemoryInfo(cacheInfo),
          timestamp: new Date().toISOString()
        },
        health: {
          status: stats.corrupted === 0 ? 'healthy' : stats.corrupted < stats.total * 0.1 ? 'warning' : 'critical',
          corruptionRate: stats.total > 0 ? (stats.corrupted / stats.total) * 100 : 0,
          recommendation: this.getHealthRecommendation(stats)
        }
      });

    } catch (error) {
      this.logger.error('Error obteniendo estadísticas de integridad', {
        error: error instanceof Error ? error.message : String(error),
        adminId: (req as any).user?.id
      });

      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        code: 'STATS_FAILED'
      });
    }
  };

  /**
   * POST /api/v1/admin/cache/integrity/repair
   * Intenta reparar datos corruptos recalculando checksums
   */
  repairIntegrity = async (req: Request, res: Response): Promise<void> => {
    try {
      const { keys, dataType } = req.body;

      if (!keys || !Array.isArray(keys) || !dataType) {
        res.status(400).json({
          success: false,
          error: 'Keys (array) y dataType son requeridos',
          code: 'MISSING_PARAMETERS'
        });
        return;
      }

      this.logger.warn('Iniciando reparación de integridad', {
        adminId: (req as any).user?.id,
        keys: keys.length,
        dataType
      });

      const repairedKeys: string[] = [];
      const failedKeys: { key: string; error: string }[] = [];

      for (const key of keys) {
        try {
          // Obtener datos sin validación de integridad
          const rawData = await this.redisClient.get(key);
          if (!rawData) {
            failedKeys.push({ key, error: 'Key not found' });
            continue;
          }

          const data = JSON.parse(rawData);
          
          // Re-almacenar con nueva integridad
          const result = await this.integrityService.storeWithIntegrity(
            this.redisClient,
            key,
            data,
            dataType as ValidatableDataType
          );

          if (result.isSuccess()) {
            repairedKeys.push(key);
          } else {
            failedKeys.push({ key, error: result.error.message });
          }

        } catch (error) {
          failedKeys.push({ 
            key, 
            error: error instanceof Error ? error.message : String(error) 
          });
        }
      }

      res.json({
        success: true,
        repair: {
          requested: keys.length,
          repaired: repairedKeys.length,
          failed: failedKeys.length,
          repairedKeys,
          failedKeys,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      this.logger.error('Error en reparación de integridad', {
        error: error instanceof Error ? error.message : String(error),
        adminId: (req as any).user?.id
      });

      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        code: 'REPAIR_FAILED'
      });
    }
  };

  /**
   * Genera recomendaciones basadas en resultados de integridad
   */
  private generateRecommendations(results: IntegrityCheckResult[]): string[] {
    const recommendations: string[] = [];
    const stats = this.integrityService.getIntegrityStats(results);

    if (stats.corrupted === 0) {
      recommendations.push('✅ Todos los datos tienen integridad válida');
    } else {
      const corruptionRate = (stats.corrupted / stats.total) * 100;
      
      if (corruptionRate > 20) {
        recommendations.push('🚨 Alta tasa de corrupción - considerar limpieza completa del cache');
        recommendations.push('🔍 Investigar posibles problemas de red o almacenamiento');
      } else if (corruptionRate > 5) {
        recommendations.push('⚠️ Tasa de corrupción moderada - revisar datos críticos');
        recommendations.push('🛠️ Considerar reparación de claves específicas');
      } else {
        recommendations.push('ℹ️ Tasa de corrupción baja - monitoreo regular recomendado');
      }

      if (stats.byCorruptionLevel.CRITICAL > 0) {
        recommendations.push('🔥 Datos críticos corruptos detectados - acción inmediata requerida');
      }
    }

    return recommendations;
  }

  /**
   * Parsea información de memoria de Redis
   */
  private parseRedisMemoryInfo(memoryInfo: string): Record<string, any> {
    const info: Record<string, any> = {};
    const lines = memoryInfo.split('\r\n');
    
    for (const line of lines) {
      const [key, value] = line.split(':');
      if (key && value) {
        info[key] = isNaN(Number(value)) ? value : Number(value);
      }
    }
    
    return info;
  }

  /**
   * Obtiene recomendación de salud basada en estadísticas
   */
  private getHealthRecommendation(stats: any): string {
    if (stats.corrupted === 0) {
      return 'Cache integrity is healthy. Continue regular monitoring.';
    }
    
    const corruptionRate = (stats.corrupted / stats.total) * 100;
    
    if (corruptionRate > 20) {
      return 'Critical: High corruption rate detected. Immediate cache cleanup recommended.';
    } else if (corruptionRate > 5) {
      return 'Warning: Moderate corruption detected. Schedule maintenance window for cleanup.';
    } else {
      return 'Minor corruption detected. Monitor closely and clean specific keys.';
    }
  }
}