import { Request, Response } from 'express';
import { Container } from '../../../composition/container';
import { RabbitMQEventPublisher } from '../../messaging/RabbitMQEventPublisher';

/**
 * Controlador para endpoints de desarrollo y debugging
 * Solo disponible en modo development
 */
export class DevController {
  
  /**
   * GET /dev/events - Información del sistema de eventos
   */
  public async getPublishedEvents(_req: Request, res: Response): Promise<void> {
    try {
      const container = Container.getInstance();
      const eventPublisher = container.eventPublisher;

      // Verificar el tipo de EventPublisher en uso
      if (eventPublisher instanceof RabbitMQEventPublisher) {
        res.json({
          success: true,
          data: {
            type: 'RabbitMQEventPublisher',
            status: 'active',
            message: 'Sistema de eventos usando RabbitMQ'
          }
        });
      } else {
        res.json({
          success: true,
          data: {
            type: 'FallbackEventPublisher',
            message: 'Sistema de eventos usando fallback (RabbitMQ no disponible)'
          }
        });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error obteniendo información del sistema de eventos',
        error: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  }

  /**
   * DELETE /dev/events - Reset del sistema de eventos
   */
  public async clearEvents(_req: Request, res: Response): Promise<void> {
    try {
      const container = Container.getInstance();
      const eventPublisher = container.eventPublisher;

      if (eventPublisher instanceof RabbitMQEventPublisher) {
        // Para RabbitMQ no hay concepto de "limpiar eventos" ya que son persistentes
        res.json({
          success: true,
          message: 'RabbitMQ no requiere limpieza de eventos (son persistentes en el broker)'
        });
      } else {
        res.json({
          success: true,
          message: 'Sistema de eventos usando fallback (no hay eventos que limpiar)'
        });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error en operación de limpieza',
        error: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  }

  /**
   * POST /dev/events/test - Publicar evento de prueba
   */
  public async publishTestEvent(req: Request, res: Response): Promise<void> {
    try {
      const { eventType = 'TestEvent', data } = req.body;
      
      const container = Container.getInstance();
      const eventPublisher = container.eventPublisher;

      const testData = data || {
        type: 'test_event',
        timestamp: new Date().toISOString(),
        message: 'Evento de prueba desde DevController'
      };

      // Crear un evento de dominio para la nueva interfaz
      const testEvent = {
        eventId: `test-${Date.now()}`,
        eventType: eventType,
        aggregateId: 'dev-test',
        aggregateType: 'Test',
        eventData: testData,
        occurredOn: new Date(),
        eventVersion: 1,
        eventContext: {
          userId: 'dev-user',
          correlationId: `dev-${Date.now()}`,
        }
      };

      const result = await eventPublisher.publish(testEvent);

      if (result && 'isSuccess' in result && !result.isSuccess) {
        throw new Error(`Error publicando evento: ${result.error?.message}`);
      }

      res.json({
        success: true,
        message: 'Evento de prueba publicado correctamente',
        data: {
          eventType,
          data: testData
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error publicando evento de prueba',
        error: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  }
}