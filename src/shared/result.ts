/**
 * Implementación del patrón Result para manejo funcional de errores
 * Evita el uso de excepciones para casos de negocio
 */

export type Result<T, E = Error> = Success<T> | Failure<E>;

export class Success<T> {
  public readonly isSuccess = true;
  public readonly isFailure = false;

  constructor(public readonly value: T) {}

  static create<T>(value: T): Success<T> {
    return new Success(value);
  }

  // Métodos de compatibilidad
  getValue(): T {
    return this.value;
  }

  getError(): never {
    throw new Error('Success result has no error');
  }
}

export class Failure<E> {
  public readonly isSuccess = false;
  public readonly isFailure = true;

  constructor(public readonly error: E) {}

  static create<E>(error: E): Failure<E> {
    return new Failure(error);
  }

  // Métodos de compatibilidad
  getValue(): never {
    throw new Error('Failure result has no value');
  }

  getError(): E {
    return this.error;
  }
}

// Funciones de utilidad para crear Results
export const success = <T>(value: T): Success<T> => Success.create(value);
export const failure = <E>(error: E): Failure<E> => Failure.create(error);

// Type guards
export const isSuccess = <T, E>(result: Result<T, E>): result is Success<T> => 
  result.isSuccess;

export const isFailure = <T, E>(result: Result<T, E>): result is Failure<E> => 
  result.isFailure;

// Funciones de utilidad para mapear y transformar Results
export const map = <T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => U
): Result<U, E> => {
  if (isSuccess(result)) {
    return success(fn(result.value));
  }
  return result;
};

export const flatMap = <T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>
): Result<U, E> => {
  if (isSuccess(result)) {
    return fn(result.value);
  }
  return result;
};

export const mapError = <T, E, F>(
  result: Result<T, E>,
  fn: (error: E) => F
): Result<T, F> => {
  if (isFailure(result)) {
    return failure(fn(result.error));
  }
  return result as Success<T>;
};

// Función para combinar múltiples Results
export const combine = <T, E>(
  results: Array<Result<T, E>>
): Result<T[], E> => {
  const values: T[] = [];
  
  for (const result of results) {
    if (isFailure(result)) {
      return result;
    }
    values.push(result.value);
  }
  
  return success(values);
};