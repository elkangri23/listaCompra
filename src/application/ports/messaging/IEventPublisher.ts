/**
 * Puerto para publicar eventos de dominio
 * Abstrae la implementación específica de mensajería (RabbitMQ, Kafka, etc.)
 */

import type { DomainEvent } from '@domain/events/DomainEvent';
import type { Result } from '@shared/result';

export interface IEventPublisher {
  /**
   * Publica un evento de dominio en el sistema de mensajería
   * @param event - Evento de dominio a publicar
   */
  publish(event: DomainEvent): Promise<Result<void, Error>>;

  /**
   * Publica múltiples eventos de forma batch
   * @param events - Array de eventos de dominio a publicar
   */
  publishBatch?(events: DomainEvent[]): Promise<Result<void, Error>>;

  /**
   * Obtiene las estadísticas del publisher
   */
  getStats?(): any;

  /**
   * Realiza un health check del publisher
   */
  healthCheck?(): Promise<Result<any, Error>>;

  /**
   * Cierra el publisher y libera recursos
   */
  close?(): Promise<Result<void, Error>>;
}