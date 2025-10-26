/**
 * Error para recursos no encontrados en la capa de aplicación
 */

export class NotFoundError extends Error {
  public readonly code = 'NOT_FOUND';
  public readonly resource: string;
  public readonly identifier: string;

  constructor(resource: string, identifier: string) {
    super(`${resource} con identificador "${identifier}" no encontrado`);
    this.name = 'NotFoundError';
    this.resource = resource;
    this.identifier = identifier;
  }

  static user(id: string): NotFoundError {
    return new NotFoundError('Usuario', id);
  }

  static userByEmail(email: string): NotFoundError {
    return new NotFoundError('Usuario', email);
  }

  static lista(id: string): NotFoundError {
    return new NotFoundError('Lista', id);
  }

  static producto(id: string): NotFoundError {
    return new NotFoundError('Producto', id);
  }

  static categoria(id: string): NotFoundError {
    return new NotFoundError('Categoría', id);
  }

  static tienda(id: string): NotFoundError {
    return new NotFoundError('Tienda', id);
  }

  toJSON(): Record<string, unknown> {
    return {
      code: this.code,
      message: this.message,
      resource: this.resource,
      identifier: this.identifier,
    };
  }
}