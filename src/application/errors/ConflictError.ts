/**
 * Error de conflicto en la capa de aplicación (HTTP 409): la operación no
 * se puede hacer porque el estado actual del recurso lo impide (p. ej. ya
 * hay una copia PENDING o una restauración RESTORING en curso).
 */
export class ConflictError extends Error {
  public readonly code = 'CONFLICT';

  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}
