import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { PrismaClient } from '@prisma/client';

describe('Database Integration', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = new PrismaClient();
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test('should connect to PostgreSQL database', async () => {
    // Verificar que podemos ejecutar una consulta básica
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });

  test('should have all required tables', async () => {
    // Verificar que las tablas principales existen
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
    ` as Array<{ table_name: string }>;

    const tableNames = tables.map(t => t.table_name);
    
    expect(tableNames).toContain('usuarios');
    expect(tableNames).toContain('listas');
    expect(tableNames).toContain('productos');
    expect(tableNames).toContain('categorias');
    expect(tableNames).toContain('tiendas');
    expect(tableNames).toContain('invitaciones');
    expect(tableNames).toContain('permisos');
    expect(tableNames).toContain('blueprints');
    expect(tableNames).toContain('outbox_events');
  });
});