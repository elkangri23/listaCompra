import { Request, Response } from 'express';
import { Container } from '../../../composition/container';
import { MockEventPublisher } from '../../messaging/MockEventPublisher';

/**
 * Controlador para endpoints de desarrollo y debugging
 * Solo disponible en modo development
 */
export class DevController {
  
  /**
   * GET /dev/events - Obtener eventos publicados (solo MockEventPublisher)
   */
  public async getPublishedEvents(_req: Request, res: Response): Promise<void> {
    try {
      const container = Container.getInstance();
      const eventPublisher = container.eventPublisher;

      // Solo funciona con MockEventPublisher
      if (eventPublisher instanceof MockEventPublisher) {
        const events = eventPublisher.getPublishedEvents();
        const stats = eventPublisher.getStats();

        res.json({
          success: true,
          data: {
            events,
            stats,
            message: 'Eventos del MockEventPublisher'
          }
        });
      } else {
        res.json({
          success: false,
          message: 'Este endpoint solo funciona con MockEventPublisher'
        });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error obteniendo eventos',
        error: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  }

  /**
   * DELETE /dev/events - Limpiar eventos (solo MockEventPublisher)
   */
  public async clearEvents(_req: Request, res: Response): Promise<void> {
    try {
      const container = Container.getInstance();
      const eventPublisher = container.eventPublisher;

      if (eventPublisher instanceof MockEventPublisher) {
        eventPublisher.clearEvents();
        res.json({
          success: true,
          message: 'Eventos limpiados correctamente'
        });
      } else {
        res.json({
          success: false,
          message: 'Este endpoint solo funciona con MockEventPublisher'
        });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error limpiando eventos',
        error: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  }

  /**
   * POST /dev/events/test - Publicar evento de prueba
   */
  public async publishTestEvent(req: Request, res: Response): Promise<void> {
    try {
      const { exchange = 'test_exchange', routingKey = 'test.event', message } = req.body;
      
      const container = Container.getInstance();
      const eventPublisher = container.eventPublisher;

      const testMessage = message || {
        type: 'test_event',
        timestamp: new Date().toISOString(),
        data: 'Evento de prueba desde DevController'
      };

      await eventPublisher.publish(exchange, routingKey, testMessage);

      res.json({
        success: true,
        message: 'Evento de prueba publicado correctamente',
        data: {
          exchange,
          routingKey,
          message: testMessage
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