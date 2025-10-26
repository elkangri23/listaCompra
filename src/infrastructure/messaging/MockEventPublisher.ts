import { IEventPublisher } from '../../application/ports/messaging/IEventPublisher';

/**
 * Mock implementation del Event Publisher para desarrollo
 * Simula el comportamiento de RabbitMQ sin requerir instalación
 */
export class MockEventPublisher implements IEventPublisher {
  private events: Array<{ exchange: string; routingKey: string; message: any; timestamp: Date }> = [];

  async publish(exchange: string, routingKey: string, message: any): Promise<void> {
    console.log(`📨 [MOCK] Evento publicado: ${exchange}/${routingKey}`, {
      message,
      timestamp: new Date().toISOString()
    });

    // Guardar el evento en memoria para propósitos de desarrollo/debugging
    this.events.push({
      exchange,
      routingKey,
      message,
      timestamp: new Date()
    });

    // Simular delay de red
    await new Promise(resolve => setTimeout(resolve, 10));
  }

  /**
   * Método adicional para desarrollo: obtener eventos publicados
   */
  getPublishedEvents(): Array<{ exchange: string; routingKey: string; message: any; timestamp: Date }> {
    return [...this.events];
  }

  /**
   * Método adicional para desarrollo: limpiar eventos
   */
  clearEvents(): void {
    this.events = [];
  }

  /**
   * Método adicional para desarrollo: obtener estadísticas
   */
  getStats(): { totalEvents: number; lastEvent: Date | null } {
    const lastEvent = this.events.length > 0 ? this.events[this.events.length - 1] : null;
    return {
      totalEvents: this.events.length,
      lastEvent: lastEvent ? lastEvent.timestamp : null
    };
  }
}