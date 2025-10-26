// Configuración global para tests
// Este archivo se ejecuta antes de todos los tests

import dotenv from 'dotenv';

// Cargar variables de entorno para testing
dotenv.config({ path: '.env.test' });

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