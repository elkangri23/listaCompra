/**
 * Utilidades generales para toda la aplicación
 */

import { v4 as uuidv4 } from 'uuid';
import type { UUID, PaginationParams, PaginationResult } from './types';

// Generación de UUIDs
export const generateUUID = (): UUID => uuidv4();

// Validación de UUID
export const isValidUUID = (uuid: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

// Validación de email
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Normalización de email
export const normalizeEmail = (email: string): string => {
  return email.toLowerCase().trim();
};

// Utilidades de paginación
export const calculatePagination = (params: PaginationParams): {
  skip: number;
  take: number;
} => {
  const page = Math.max(1, params.page);
  const limit = Math.min(Math.max(1, params.limit), 100); // Máximo 100 elementos por página
  
  return {
    skip: (page - 1) * limit,
    take: limit,
  };
};

export const createPaginationResult = <T>(
  data: T[],
  total: number,
  params: PaginationParams
): PaginationResult<T> => {
  const totalPages = Math.ceil(total / params.limit);
  
  return {
    data,
    total,
    page: params.page,
    limit: params.limit,
    totalPages,
    hasNext: params.page < totalPages,
    hasPrevious: params.page > 1,
  };
};

// Sanitización de strings
export const sanitizeString = (input: string): string => {
  return input.trim().replace(/\s+/g, ' ');
};

// Capitalización
export const capitalize = (str: string): string => {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

// Validación de contraseñas
export const isValidPassword = (password: string): boolean => {
  // Al menos 8 caracteres, una mayúscula, una minúscula, un número
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/;
  return passwordRegex.test(password);
};

// Delay para testing o rate limiting
export const delay = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

// Función para crear objetos de fecha seguros
export const createDate = (date?: string | Date): Date => {
  if (!date) return new Date();
  return date instanceof Date ? date : new Date(date);
};

// Validación de nombres
export const isValidName = (name: string): boolean => {
  // Solo letras, espacios, guiones y apostrofes, entre 2 y 50 caracteres
  const nameRegex = /^[a-zA-ZÀ-ÿ\u00f1\u00d1\s'-]{2,50}$/;
  return nameRegex.test(name.trim());
};

// Formatear respuesta de error
export const formatError = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Error desconocido';
};

// Función para seleccionar campos de un objeto
export const pick = <T extends Record<string, unknown>, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> => {
  const result = {} as Pick<T, K>;
  for (const key of keys) {
    if (key in obj) {
      result[key] = obj[key];
    }
  }
  return result;
};

// Función para omitir campos de un objeto
export const omit = <T extends Record<string, unknown>, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> => {
  const result = { ...obj };
  for (const key of keys) {
    delete result[key];
  }
  return result;
};