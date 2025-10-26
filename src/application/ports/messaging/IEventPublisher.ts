/**
 * Puerto para publicar eventos de dominio
 * Abstrae la implementación específica de mensajería (RabbitMQ, Kafka, etc.)
 */
export interface IEventPublisher {
  /**
   * Publica un evento en el sistema de mensajería
   * @param exchange - Nombre del exchange donde publicar
   * @param routingKey - Clave de enrutamiento del mensaje
   * @param message - Contenido del mensaje a publicar
   */
  publish(exchange: string, routingKey: string, message: any): Promise<void>;
}