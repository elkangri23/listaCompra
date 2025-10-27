/**
 * Puertos de mensajería y eventos
 */

export { IEventPublisher } from './IEventPublisher';
export { 
  IOutboxService,
  OutboxEvent,
  OutboxEventFilters,
  PaginationOptions,
  PaginatedResult,
  OutboxStats,
  OutboxError,
  OutboxEventNotFoundError,
  OutboxTransactionError
} from './IOutboxService';