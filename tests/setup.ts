// Configuración global para tests
// Este archivo se ejecuta antes de todos los tests

import dotenv from 'dotenv';

// Configurar NODE_ENV para tests si no está configurado
if (!process.env['NODE_ENV']) {
  process.env['NODE_ENV'] = 'test';
}

// Secretos JWT mínimos para entorno de tests
if (!process.env['JWT_SECRET']) {
  process.env['JWT_SECRET'] = 'test-secret-should-be-long-and-unique-1234567890';
}

// Mock global de bcrypt para evitar dependencias nativas en entornos de CI/Windows
jest.mock('bcrypt', () => {
  const hash = async (value: string) => `hashed:${value}`;
  const compare = async (value: string, hashed: string) => hashed === `hashed:${value}`;
  return { hash, compare };
});

// Cargar variables de entorno para testing
dotenv.config({ path: '.env' });

// Fallback a .env.example: en un checkout limpio no hay .env y los tests
// que solo comprueban la presencia de variables (p. ej. DATABASE_URL)
// fallarían sin motivo. Solo rellena las que sigan sin definir, así un
// .env real o las variables del CI siempre tienen prioridad.
dotenv.config({ path: '.env.example' });

// Variables obligatorias para servicios críticos
if (!process.env['JWT_SECRET']) {
  process.env['JWT_SECRET'] = 'test-jwt-secret-that-is-long-enough-1234567890';
}

// Configuración global para Jest
global.beforeAll(async () => {
  // Setup global antes de todos los tests
  console.log('🧪 Configurando entorno de testing...');
});

global.afterAll(async () => {
  // Cleanup global después de todos los tests
  console.log('🧹 Limpiando entorno de testing...');
});

// Configuración de timeouts para tests
jest.setTimeout(30000);

// Mock console para evitar ruido en tests
const originalConsole = console;
global.console = {
  ...originalConsole,
  log: jest.fn(),
  warn: jest.fn(),
  error: originalConsole.error, // Mantener errors para debugging
};
