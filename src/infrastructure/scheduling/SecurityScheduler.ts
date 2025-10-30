/**
 * Security Scheduler - Simplified Version
 * Cron jobs básicos para seguridad y cleanup
 */

import * as cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { Logger } from '../observability/logger/Logger';

export class SecurityScheduler {
  private prisma: PrismaClient;
  private logger: Logger;
  private jobs: Map<string, cron.ScheduledTask> = new Map();

  constructor(
    prisma: PrismaClient,
    logger: Logger
  ) {
    this.prisma = prisma;
    this.logger = logger;
  }

  /**
   * Inicializar scheduled jobs de seguridad
   */
  public initializeSecurityJobs(): void {
    this.logger.info('🕐 Inicializando scheduled jobs de seguridad...');

    // Job 1: Cleanup de invitaciones expiradas (cada hora)
    this.scheduleExpiredInvitationsCleanup();

    // Job 2: Cleanup de outbox events antiguos (diario)
    this.scheduleOutboxCleanup();

    this.logger.info(`✅ ${this.jobs.size} scheduled jobs de seguridad inicializados`);
  }

  /**
   * Job 1: Cleanup de invitaciones expiradas
   */
  private scheduleExpiredInvitationsCleanup(): void {
    const job = cron.schedule('0 * * * *', async () => { // Cada hora
      try {
        this.logger.info('🧹 Iniciando cleanup de invitaciones expiradas...');

        const now = new Date();
        
        // Buscar invitaciones expiradas usando nombres correctos de Prisma
        const expiredCount = await this.prisma.invitacion.count({
          where: {
            fechaExpiracion: {
              lt: now
            },
            activa: true // Solo las activas
          }
        });

        if (expiredCount === 0) {
          this.logger.debug('No hay invitaciones expiradas para limpiar');
          return;
        }

        // Marcar como inactivas
        const updateResult = await this.prisma.invitacion.updateMany({
          where: {
            fechaExpiracion: {
              lt: now
            },
            activa: true
          },
          data: {
            activa: false
          }
        });

        this.logger.info(`🧹 Cleanup completado: ${updateResult.count} invitaciones marcadas como inactivas`);

        // Métricas básicas
        this.logSecurityMetrics('invitation_cleanup', {
          expired_count: updateResult.count,
          cleanup_timestamp: now.toISOString()
        });

      } catch (error) {
        this.logger.error('❌ Error en cleanup de invitaciones expiradas:', error);
      }
    });

    this.jobs.set('expired-invitations-cleanup', job);
  }

  /**
   * Job 2: Cleanup de eventos del outbox antiguos
   */
  private scheduleOutboxCleanup(): void {
    const job = cron.schedule('0 2 * * *', async () => { // 2 AM diario
      try {
        this.logger.info('�️ Iniciando cleanup de outbox events...');

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        // Solo contar por ahora, ya que el modelo OutboxEvent puede no tener 'status'
        const oldEventsCount = await this.prisma.outboxEvent.count({
          where: {
            createdAt: {
              lt: sevenDaysAgo
            }
          }
        });

        this.logger.info(`🗑️ Outbox events antiguos encontrados: ${oldEventsCount}`);

        this.logSecurityMetrics('outbox_cleanup', {
          old_events_count: oldEventsCount,
          cleanup_date: sevenDaysAgo.toISOString()
        });

      } catch (error) {
        this.logger.error('❌ Error en cleanup de outbox:', error);
      }
    });

    this.jobs.set('outbox-cleanup', job);
  }

  /**
   * Iniciar todos los jobs programados
   */
  public startAllJobs(): void {
    let startedCount = 0;

    for (const [name, job] of this.jobs.entries()) {
      try {
        job.start();
        startedCount++;
        this.logger.debug(`▶️ Job iniciado: ${name}`);
      } catch (error) {
        this.logger.error(`❌ Error iniciando job ${name}:`, error);
      }
    }

    this.logger.info(`🚀 Security jobs iniciados: ${startedCount}/${this.jobs.size}`);
  }

  /**
   * Detener todos los jobs
   */
  public stopAllJobs(): void {
    let stoppedCount = 0;

    for (const [name, job] of this.jobs.entries()) {
      try {
        job.stop();
        stoppedCount++;
        this.logger.debug(`⏹️ Job detenido: ${name}`);
      } catch (error) {
        this.logger.error(`❌ Error deteniendo job ${name}:`, error);
      }
    }

    this.logger.info(`⏹️ Security jobs detenidos: ${stoppedCount}/${this.jobs.size}`);
  }

  /**
   * Obtener estado de todos los jobs
   */
  public getJobsStatus(): Array<{ name: string; running: boolean }> {
    const status: Array<{ name: string; running: boolean }> = [];

    for (const [name, job] of this.jobs.entries()) {
      status.push({
        name,
        running: job.getStatus() === 'scheduled'
      });
    }

    return status;
  }

  /**
   * Destructor: limpiar recursos
   */
  public async destroy(): Promise<void> {
    this.stopAllJobs();
    this.jobs.clear();
    this.logger.info('🧹 SecurityScheduler destruido correctamente');
  }

  /**
   * Helper para logging de métricas de seguridad
   */
  private logSecurityMetrics(operation: string, data: Record<string, any>): void {
    this.logger.info(`📊 [SECURITY_METRICS] ${operation}`, {
      operation,
      ...data,
      timestamp: new Date().toISOString()
    });
  }
}

export default SecurityScheduler;