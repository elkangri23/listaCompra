import { createHash } from 'crypto';
import { Result, success, failure } from '../../shared/result';
import { Logger } from '../observability/logger/Logger';
import { SecurityAuditService } from '../observability/audit/SecurityAuditService';

/**
 * Tipos de datos que pueden ser validados
 */
export type ValidatableDataType = 
  | 'ai_suggestion' 
  | 'user_session' 
  | 'blueprint_metadata' 
  | 'category_cache'
  | 'product_analytics';

/**
 * Resultado de validación de integridad
 */
export interface IntegrityCheckResult {
  isValid: boolean;
  dataType: ValidatableDataType;
  key: string;
  storedChecksum?: string;
  calculatedChecksum?: string;
  timestamp: Date;
  corruptionLevel: 'NONE' | 'MINOR' | 'SEVERE' | 'CRITICAL';
  details?: string;
}

/**
 * Configuración de integridad por tipo de dato
 */
interface IntegrityConfig {
  enabled: boolean;
  checksumAlgorithm: 'md5' | 'sha256' | 'sha512';
  validateOnRead: boolean;
  validateOnWrite: boolean;
  maxAge: number; // segundos
  criticalData: boolean;
}

/**
 * Servicio para validar integridad de datos en cache
 * Protege contra corrupción de datos y manipulación maliciosa
 */
export class CacheIntegrityService {
  private readonly configs: Map<ValidatableDataType, IntegrityConfig>;
  private readonly checksumPrefix = 'integrity:checksum:';
  private readonly metadataPrefix = 'integrity:meta:';

  constructor(
    private readonly logger: Logger,
    private readonly auditService: SecurityAuditService
  ) {
    this.configs = new Map([
      ['ai_suggestion', {
        enabled: true,
        checksumAlgorithm: 'sha256',
        validateOnRead: true,
        validateOnWrite: true,
        maxAge: 3600, // 1 hora
        criticalData: false
      }],
      ['user_session', {
        enabled: true,
        checksumAlgorithm: 'sha512',
        validateOnRead: true,
        validateOnWrite: true,
        maxAge: 1800, // 30 minutos
        criticalData: true
      }],
      ['blueprint_metadata', {
        enabled: true,
        checksumAlgorithm: 'sha256',
        validateOnRead: true,
        validateOnWrite: true,
        maxAge: 7200, // 2 horas
        criticalData: true
      }],
      ['category_cache', {
        enabled: true,
        checksumAlgorithm: 'md5',
        validateOnRead: false,
        validateOnWrite: true,
        maxAge: 3600,
        criticalData: false
      }],
      ['product_analytics', {
        enabled: true,
        checksumAlgorithm: 'sha256',
        validateOnRead: false,
        validateOnWrite: true,
        maxAge: 3600,
        criticalData: false
      }]
    ]);
  }

  /**
   * Calcula checksum para datos
   */
  private calculateChecksum(data: any, algorithm: 'md5' | 'sha256' | 'sha512'): string {
    const serialized = typeof data === 'string' ? data : JSON.stringify(data);
    return createHash(algorithm).update(serialized, 'utf8').digest('hex');
  }

  /**
   * Crea metadata de integridad para datos
   */
  private createIntegrityMetadata(
    dataType: ValidatableDataType,
    checksum: string
  ): string {
    const metadata = {
      dataType,
      checksum,
      algorithm: this.configs.get(dataType)?.checksumAlgorithm || 'sha256',
      timestamp: new Date().toISOString(),
      version: '1.0'
    };
    return JSON.stringify(metadata);
  }

  /**
   * Almacena datos con validación de integridad
   */
  async storeWithIntegrity(
    redisClient: any,
    key: string,
    data: any,
    dataType: ValidatableDataType,
    ttl?: number
  ): Promise<Result<void, Error>> {
    try {
      const config = this.configs.get(dataType);
      if (!config?.enabled || !config?.validateOnWrite) {
        // Si no está habilitado, almacenar normalmente
        await redisClient.setex(key, ttl || config?.maxAge || 3600, JSON.stringify(data));
        return success(undefined);
      }

      // Calcular checksum
      const checksum = this.calculateChecksum(data, config.checksumAlgorithm);
      
      // Crear metadata de integridad
      const metadata = this.createIntegrityMetadata(dataType, checksum);
      
      // Almacenar datos y metadata en pipeline
      const pipeline = redisClient.pipeline();
      pipeline.setex(key, ttl || config.maxAge, JSON.stringify(data));
      pipeline.setex(
        this.checksumPrefix + key, 
        ttl || config.maxAge, 
        checksum
      );
      pipeline.setex(
        this.metadataPrefix + key,
        ttl || config.maxAge,
        metadata
      );
      
      await pipeline.exec();

      this.logger.debug('Datos almacenados con integridad', {
        key,
        dataType,
        checksumAlgorithm: config.checksumAlgorithm,
        checksum: checksum.substring(0, 8) + '...'
      });

      return success(undefined);

    } catch (error) {
      this.logger.error('Error al almacenar datos con integridad', {
        key,
        dataType,
        error: error instanceof Error ? error.message : String(error)
      });

      await this.auditService.logSecurityViolation(
        'cache_integrity_store_failure',
        {
          key,
          dataType,
          error_type: 'storage_failure'
        }
      );

      return failure(
        error instanceof Error ? error : new Error('Error almacenando datos con integridad')
      );
    }
  }

  /**
   * Recupera datos con validación de integridad
   */
  async retrieveWithIntegrity(
    redisClient: any,
    key: string,
    dataType: ValidatableDataType
  ): Promise<Result<any, Error>> {
    try {
      const config = this.configs.get(dataType);
      if (!config?.enabled) {
        // Si no está habilitado, recuperar normalmente
        const data = await redisClient.get(key);
        return data ? success(JSON.parse(data)) : failure(new Error('Key not found'));
      }

      // Recuperar datos y metadata
      const pipeline = redisClient.pipeline();
      pipeline.get(key);
      pipeline.get(this.checksumPrefix + key);
      pipeline.get(this.metadataPrefix + key);
      
      const results = await pipeline.exec();
      const [dataResult, checksumResult, metadataResult] = results;

      if (!dataResult[1]) {
        return failure(new Error('Key not found'));
      }

      const data = JSON.parse(dataResult[1]);
      
      // Si no se requiere validación en lectura, devolver datos
      if (!config.validateOnRead) {
        return success(data);
      }

      const storedChecksum = checksumResult[1];
      const metadata = metadataResult[1] ? JSON.parse(metadataResult[1]) : null;

      if (!storedChecksum || !metadata) {
        this.logger.warn('Datos sin metadata de integridad', { key, dataType });
        
        await this.auditService.logSecurityViolation(
          'cache_integrity_missing_metadata',
          {
            key,
            dataType,
            has_checksum: !!storedChecksum,
            has_metadata: !!metadata
          }
        );

        return success(data); // Permitir acceso pero registrar
      }

      // Validar integridad
      const validation = await this.validateIntegrity(
        data,
        storedChecksum,
        metadata,
        key,
        dataType
      );

      if (!validation.isValid) {
        this.logger.error('Integridad de datos comprometida', {
          key,
          dataType,
          corruptionLevel: validation.corruptionLevel,
          storedChecksum: validation.storedChecksum,
          calculatedChecksum: validation.calculatedChecksum
        });

        await this.auditService.logSecurityViolation(
          'cache_integrity_corruption_detected',
          {
            key,
            dataType,
            corruption_level: validation.corruptionLevel,
            stored_checksum: validation.storedChecksum,
            calculated_checksum: validation.calculatedChecksum
          }
        );

        if (config.criticalData || validation.corruptionLevel === 'CRITICAL') {
          return failure(new Error('Data integrity compromised'));
        }
      }

      return success(data);

    } catch (error) {
      this.logger.error('Error al recuperar datos con integridad', {
        key,
        dataType,
        error: error instanceof Error ? error.message : String(error)
      });

      return failure(
        error instanceof Error ? error : new Error('Error recuperando datos con integridad')
      );
    }
  }

  /**
   * Valida integridad de datos específicos
   */
  async validateIntegrity(
    data: any,
    storedChecksum: string,
    metadata: any,
    key: string,
    dataType: ValidatableDataType
  ): Promise<IntegrityCheckResult> {
    const config = this.configs.get(dataType);
    if (!config) {
      return {
        isValid: false,
        dataType,
        key,
        timestamp: new Date(),
        corruptionLevel: 'CRITICAL',
        details: 'Unknown data type'
      };
    }

    // Calcular checksum actual
    const calculatedChecksum = this.calculateChecksum(data, config.checksumAlgorithm);
    
    const result: IntegrityCheckResult = {
      isValid: storedChecksum === calculatedChecksum,
      dataType,
      key,
      storedChecksum,
      calculatedChecksum,
      timestamp: new Date(),
      corruptionLevel: 'NONE'
    };

    if (!result.isValid) {
      // Determinar nivel de corrupción
      if (config.criticalData) {
        result.corruptionLevel = 'CRITICAL';
      } else if (metadata?.timestamp) {
        const age = Date.now() - new Date(metadata.timestamp).getTime();
        if (age > config.maxAge * 1000) {
          result.corruptionLevel = 'MINOR'; // Posible expiración
        } else {
          result.corruptionLevel = 'SEVERE'; // Corrupción activa
        }
      } else {
        result.corruptionLevel = 'SEVERE';
      }

      result.details = `Checksum mismatch: expected ${storedChecksum}, got ${calculatedChecksum}`;
    }

    return result;
  }

  /**
   * Escanea y valida integridad de múltiples claves
   */
  async scanIntegrity(
    redisClient: any,
    pattern: string = '*',
    dataType?: ValidatableDataType
  ): Promise<IntegrityCheckResult[]> {
    const results: IntegrityCheckResult[] = [];
    
    try {
      const keys = await redisClient.keys(pattern);
      
      for (const key of keys) {
        // Saltar claves de metadata
        if (key.startsWith(this.checksumPrefix) || key.startsWith(this.metadataPrefix)) {
          continue;
        }

        // Si se especifica tipo, obtenerlo de metadata o asumir
        const keyDataType = dataType || 'ai_suggestion'; // default
        
        const result = await this.retrieveWithIntegrity(redisClient, key, keyDataType);
        
        if (!result.isSuccess) {
          results.push({
            isValid: false,
            dataType: keyDataType,
            key,
            timestamp: new Date(),
            corruptionLevel: 'SEVERE',
            details: result.error.message
          });
        } else {
          results.push({
            isValid: true,
            dataType: keyDataType,
            key,
            timestamp: new Date(),
            corruptionLevel: 'NONE'
          });
        }
      }

      this.logger.info('Escaneo de integridad completado', {
        totalKeys: keys.length,
        validKeys: results.filter(r => r.isValid).length,
        corruptedKeys: results.filter(r => !r.isValid).length
      });

    } catch (error) {
      this.logger.error('Error en escaneo de integridad', {
        pattern,
        error: error instanceof Error ? error.message : String(error)
      });
    }

    return results;
  }

  /**
   * Limpia datos corruptos del cache
   */
  async cleanupCorruptedData(
    redisClient: any,
    corruptionResults: IntegrityCheckResult[]
  ): Promise<void> {
    const keysToDelete = corruptionResults
      .filter(r => !r.isValid && r.corruptionLevel === 'CRITICAL')
      .map(r => r.key);

    if (keysToDelete.length === 0) {
      return;
    }

    try {
      const pipeline = redisClient.pipeline();
      
      for (const key of keysToDelete) {
        pipeline.del(key);
        pipeline.del(this.checksumPrefix + key);
        pipeline.del(this.metadataPrefix + key);
      }
      
      await pipeline.exec();

      this.logger.warn('Datos corruptos eliminados del cache', {
        deletedKeys: keysToDelete.length,
        keys: keysToDelete
      });

      await this.auditService.logSecurityViolation(
        'cache_integrity_cleanup_performed',
        {
          deleted_keys_count: keysToDelete.length,
          deleted_keys: keysToDelete
        }
      );

    } catch (error) {
      this.logger.error('Error limpiando datos corruptos', {
        keysToDelete,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Obtiene estadísticas de integridad
   */
  getIntegrityStats(results: IntegrityCheckResult[]): {
    total: number;
    valid: number;
    corrupted: number;
    byCorruptionLevel: Record<string, number>;
    byDataType: Record<string, { valid: number; corrupted: number }>;
  } {
    const stats = {
      total: results.length,
      valid: results.filter(r => r.isValid).length,
      corrupted: results.filter(r => !r.isValid).length,
      byCorruptionLevel: {} as Record<string, number>,
      byDataType: {} as Record<string, { valid: number; corrupted: number }>
    };

    // Estadísticas por nivel de corrupción
    for (const result of results.filter(r => !r.isValid)) {
      stats.byCorruptionLevel[result.corruptionLevel] = 
        (stats.byCorruptionLevel[result.corruptionLevel] || 0) + 1;
    }

    // Estadísticas por tipo de datos
    for (const result of results) {
      const type = result.dataType;
      if (!stats.byDataType[type]) {
        stats.byDataType[type] = { valid: 0, corrupted: 0 };
      }
      
      if (result.isValid) {
        stats.byDataType[type].valid++;
      } else {
        stats.byDataType[type].corrupted++;
      }
    }

    return stats;
  }
}